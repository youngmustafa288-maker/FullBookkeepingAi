import type {VercelRequest,VercelResponse} from '@vercel/node'
import {authorise} from '../server/bookkeeping-auth'
import {askJson} from '../server/ai'
import {sourceText} from '../server/source-text'
const slots=['profile','vendors','glCodes','policies']
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'})
 try{
  const {clientId,mode,configType='all',documentBase64,mimeType,fileName,conversation}=req.body||{}
  if(typeof clientId!=='string'||(!slots.includes(configType)&&configType!=='all'))return res.status(400).json({error:'Select a valid client and configuration type.'})
  const {userDb}=await authorise(req,clientId);const {data,error}=await userDb.from('bookkeeping_workspaces').select('state').eq('company_id',clientId).maybeSingle();if(error)throw error
  const saved=data?.state?.contexts||{}
  const approved=(data?.state?.documents||[]).filter((d:{status:string})=>d.status==='approved')
  let source:string|null=null
  if(mode!=='conversation'){if(!documentBase64||!fileName)throw Error('Choose a source file.');source=await sourceText(documentBase64,mimeType||'',fileName)}
  const messages=Array.isArray(conversation)?conversation.slice(-24).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,15000)})):[]
  if(mode==='conversation'&&!messages.length)throw Error('Enter a configuration question or answer first.')
  const system=`Help the bookkeeper configure one Malaysian client in the existing AI configuration screen. Extract supported company profile, actual chart of accounts, counterparty/vendor mappings and approval/accounting policies from the source or conversation. Use saved context as evidence. Never invent GL codes, tax rates, registrations, payment terms or approval limits; use explicit unknowns and ask up to three focused clarification questions. Distinguish a supplier default from an approved rule. No e-Invoice integration. Return JSON: {message:string,configs:{profile?:markdown,vendors?:markdown,glCodes?:markdown,policies?:markdown},markdown?:string,questions:[{id:string,question:string,context:string}],confidence:{profile?:number,glCodes?:number,vendors?:number,policies?:number},confidence_reasoning:object,summary:{glCodesCount:number,vendorsCount:number}}. Return only supported changed configuration slots; do not replace other slots with empty content. ${configType==='all'?'Prepare supported relevant slots.':`Prepare only the ${configType} slot and include its Markdown as markdown.`} Describe any conflict with saved values; do not silently overwrite conflicting policies. All generated configuration stays draft until explicit human approval. Never claim it was saved.`
  const {result,model}=await askJson(system,{approved_examples:approved.slice(-200).map((d:{party:string;category:string;kind:string;currency:string;reference:string})=>({party:d.party,category:d.category,kind:d.kind,currency:d.currency,reference:d.reference})),approved_examples_are_complete:approved.length<=200,saved_context:saved,draft_context:req.body.draftContext||null,source,source_filename:fileName||null,conversation:messages})
  const raw=result.configs&&typeof result.configs==='object'?result.configs as Record<string,unknown>:{}
  const configs=Object.fromEntries(slots.filter(slot=>typeof raw[slot]==='string'&&(raw[slot] as string).trim()).map(slot=>[slot,String(raw[slot]).slice(0,524288)]))
  if(configType!=='all'&&typeof result.markdown==='string')configs[configType]=result.markdown
  return res.json({...result,configs,markdown:configType==='all'?undefined:configs[configType]||'',model_used:model,status:'draft',saved:false})
 }catch(e){const err=e as Error&{status?:number};return res.status(err.status||400).json({error:err.name==='AbortError'?'Configuration analysis timed out. Saved settings were not changed.':err.message})}
}
