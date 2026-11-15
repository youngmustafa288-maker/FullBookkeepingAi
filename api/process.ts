import type {VercelRequest,VercelResponse} from '@vercel/node'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {authorise} from '../server/bookkeeping-auth'
import {askJson} from '../server/ai'
import {allowedCaseActions,validateCaseActions} from '../src/bookkeeping/cases.mjs'
const taskFiles:Record<string,string>={receipt:'receipt',invoice:'invoice','bank-reconciliation':'bank-reconciliation',reporting:'reporting'}
const contract=`You are the bookkeeping assistant inside the user's existing drag-and-drop/chat workspace. Keep transaction subtypes internal and send changes to the Review Queue. Never instruct the user to navigate 16 new workflows.
Return {message:string,extracted_fields:object,confidence:number|null,warnings:string[],missing_evidence:string[],blocked:boolean,actions:[{type:string,payload:object}]}.
Explain the evidence, actual balance, proposed action and questions in plain language. If facts needed for an action are unknown, ask focused questions, return no unsupported actions, and set blocked true. Do not invent missing references, dates, opening balances, identities or tax rates. Do not claim an external system was queried or posted. No e-Invoice processing.
Allowed actions: document, allocate, unallocate, goods, resolve-goods, bank-import, bank-match, edit. Never propose approve/reject/context changes, tax filing, bank execution or period locking.
Document payload: {kind,reference,party,date,dueDate?,amount,currency,bankAccount?,category?,originalId?,evidence?,note?}. Kinds: sales-invoice,purchase-invoice,customer-receipt,supplier-payment,expense-receipt,employee-claim,employee-reimbursement,sales-credit,purchase-credit,customer-refund,supplier-refund,miscellaneous. amount is a major-unit decimal string ("1000.00"). Date is YYYY-MM-DD. Cash direction is fixed by kind; miscellaneous may use direction in/out. Distinguish purchase/sales invoices, collections and expense receipts. Link an existing invoice instead of creating a second expense.
Allocation payload {invoiceId,paymentId,amount,date}. Release payload {allocationId,amount?,date,reason}. Goods payload {invoiceId,item,delivered,accepted,faulty,date,evidence,goodsReceiptRef?}; accepted+faulty=delivered, whole units. Resolution payload {goodsId,resolution,documentId?,evidence,date}; resolution replacement-received/credit-received/refund-received/claim-rejected. Credit/refund financial resolutions require approved linked evidence, not a supplier promise.
Bank-import payload {account,currency,opening,closing,rows:[{sourceId,date,amount,reference}]} uses signed INTEGER MINOR UNITS for balances and rows, unlike document/allocations. Require source opening+movements=closing and preserve all rows; do not truncate a statement. Bank-match payload {bankId,documentId,date} requires exact same cash account,currency,direction and amount. Match each row/event once. An invoice is not a cash event. Unknown/grouped/net settlements require supported reviewed proposals; never force matches.
Use actual record IDs from the supplied state. To reference a document created by an earlier action within this proposal use "@0" for action index 0, "@1" for index 1, etc. The engine records approved case actions atomically after human review; new documents still have separate creation/approval audit events.
Propose at most 20 actions. For a later credit on a fully allocated paid invoice, release the affected allocation amount at the correct date before applying the credit; keep the original cash payment and available balance. A subsequent refund consumes the payment balance without reducing purchases twice. Unexplained underpayment stays outstanding. Treat supplier credit promises as claims pending evidence. Show claim-only and replacement outcomes separately.
All source amounts in existing state.documents[].amount, allocations[].amount and bankRows[].amount are INTEGER MINOR UNITS. Convert them correctly when explaining or proposing major-unit amounts. Confidence represents extraction uncertainty only; missing confidence is null.`
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'})
 try{
  const {task,companyId,ocrData,conversation}=req.body||{}
  if(typeof task!=='string'||!Object.hasOwn(taskFiles,task)||typeof companyId!=='string'||JSON.stringify({ocrData,conversation}).length>220000)return res.status(400).json({error:'Choose an existing workflow, company and supported input.'})
  const {userDb}=await authorise(req,companyId);const {data,error}=await userDb.from('bookkeeping_workspaces').select('state').eq('company_id',companyId).maybeSingle();if(error)throw error
  const state=data?.state,context=state?.contexts
  if(!context||['profile','vendors','glCodes','policies'].some(k=>!context[k]?.trim()))return res.status(422).json({error:'Use Client configuration → Configure with AI to review and save the four company context files first. Use explicit unknown/none notes instead of guessing.'})
  if((state.documents?.length||0)>1500||(state.allocations?.length||0)>3000)return res.status(422).json({error:'This workspace needs scoped ledger retrieval before reliable AI analysis. No partial balance check was performed.'})
  const [common,reference,decisions]=await Promise.all(['common',taskFiles[task],'case-decisions'].map(name=>readFile(join(process.cwd(),`workflow/references/${name}.md`),'utf8')))
  const history=Array.isArray(conversation)?conversation.slice(-20).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,15000)})):[]
  const {result,model}=await askJson([common,reference,decisions,contract].join('\n\n'),{company_context:context,source:ocrData||null,conversation:history,available_records:{documents:state.documents||[],allocations:state.allocations||[],releases:state.reversals||[],goods:state.goods||[],bankRows:state.bankRows||[],matches:state.matches||[],pending_cases:(state.cases||[]).filter((c:{status:string})=>c.status==='pending')},available_action_types:allowedCaseActions})
  const actions=validateCaseActions(result.actions||[])
  return res.json({task,result:{...result,actions},model_used:model,confidence:typeof result.confidence==='number'?Math.max(0,Math.min(1,result.confidence)):null,status:'draft',external_posted:false})
 }catch(e){const err=e as Error&{status?:number};return res.status(err.status||400).json({error:err.name==='AbortError'?'AI timed out. No records were approved.':err.message})}
}
