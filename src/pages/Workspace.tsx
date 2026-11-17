import {useRef,useState} from 'react'
import {AlertTriangle,Bot,Check,ChevronRight,FileText,HandCoins,Landmark,Paperclip,Send,ShoppingCart,Sparkles,UploadCloud,UsersRound,WalletCards} from 'lucide-react'
import {useApp} from '../context/AppContext'
import {useBookkeeping,localMode} from '../bookkeeping/context'
import type {WorkflowModeId,ReviewItem} from '../types'
import {ConfidenceBadge,Badge} from '../components/Badge'
import {ReviewDrawer} from '../components/ReviewDrawer'
import {BankReviewPanel} from '../components/BankReviewPanel'
import {money} from '../lib/format'
import {runOCR,processDocument,fileToBase64} from '../lib/api'
const workflowMeta:Array<{id:WorkflowModeId;name:string;description:string;accepts:string;intro:string;icon:typeof Bot}>=[
 {id:'purchase-expenses',name:'Purchase & Expenses',description:'Supplier costs and credits',accepts:'supplier invoices, receipts, utility bills or credit notes',intro:'supplier invoices, receipts, utility bills and credit notes',icon:ShoppingCart},
 {id:'sales-collections',name:'Sales & Collections',description:'Sales and incoming payments',accepts:'sales invoices, POS or marketplace settlement reports, or customer payment proofs',intro:'sales invoices, POS or marketplace settlement reports and customer payment proofs',icon:WalletCards},
 {id:'claims-petty-cash',name:'Claims & Petty Cash',description:'Staff claims and small spend',accepts:'staff receipts, claim forms, or mileage and travel claims',intro:'staff receipts, claim forms and mileage or travel claims',icon:HandCoins},
 {id:'payroll-inputs',name:'Payroll Inputs',description:'Payroll and statutory proofs',accepts:'payroll summaries, payslips, or EPF, SOCSO, EIS and PCB payment proofs',intro:'payroll summaries, payslips and EPF, SOCSO, EIS or PCB payment proofs',icon:UsersRound},
 {id:'bank-reconciliation',name:'Bank Reconciliation',description:'Monthly statements by account',accepts:'monthly statements for each bank account',intro:'monthly statements for each bank account',icon:Landmark},
]
interface Message{role:'user'|'assistant';content:string}
function mime(file:File){const ext=file.name.toLowerCase().split('.').pop();return ({pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain'}[ext||'']||file.type||'application/octet-stream')}
export function Workspace({workflow,setWorkflow}:{workflow:WorkflowModeId;setWorkflow:(w:WorkflowModeId)=>void}){
 const {clients,activeClientId,reviews,approveReview,rejectReview,stageCase}=useApp(),{state,busy}=useBookkeeping()
 const client=clients.find(c=>c.id===activeClientId)!,meta=workflowMeta.find(w=>w.id===workflow)!,Icon=meta.icon
 const [processing,setProcessing]=useState(false),[stage,setStage]=useState(''),[model,setModel]=useState(''),[message,setMessage]=useState(''),[messages,setMessages]=useState<Message[]>([]),[error,setError]=useState(''),[dragging,setDragging]=useState(false),[processed,setProcessed]=useState(0),[selected,setSelected]=useState<ReviewItem|null>(null)
 const fileRef=useRef<HTMLInputElement>(null),processingRef=useRef(false),sources=useRef<{filename:string;data:unknown;evidence:string}[]>([])
 const pending=reviews.filter(r=>r.clientId===activeClientId&&r.workflow===workflow)
 const ask=async(history:Message[],input?:unknown,source?:{evidence:string;filename:string;mimeType:string})=>{
  const response=await processDocument({task:workflow,companyId:activeClientId,ocrData:input,conversation:history})
  setModel(response.model_used||'Configured AI');const result=response.result
  if(!result||typeof result.message!=='string')throw Error('The assistant returned an incomplete response. No proposal was approved.')
  setMessages(old=>[...old,{role:'assistant',content:result.message}])
  if((Array.isArray(result.actions)&&result.actions.length)||(Array.isArray(result.missing_evidence)&&result.missing_evidence.length))await stageCase(workflow,{...result,confidence:response.confidence},source)
 }
 const upload=async(files:FileList|File[])=>{
  if(processingRef.current)return;const batch=Array.from(files);setError('')
  if(batch.length>20){setError('Choose up to 20 files per batch.');return}
  processingRef.current=true;setProcessing(true)
  try{for(let i=0;i<batch.length;i++){
   const file=batch[i];if(file.size>3_000_000){setError(`${file.name}: choose a file below 3 MB. Other supported files can still be processed.`);continue}
   if(!/\.(pdf|jpe?g|png|csv|xlsx|txt)$/i.test(file.name)){setError(`${file.name}: use PDF, JPG, PNG, CSV, XLSX or text.`);continue}
   try{
    setStage(`Reading ${file.name} (${i+1}/${batch.length})…`)
    const extracted=await runOCR(await fileToBase64(file),mime(file),activeClientId,file.name)
    sources.current=[...sources.current,{filename:file.name,data:extracted.data,evidence:extracted.evidence}].slice(-3)
    const user:Message={role:'user',content:`Uploaded ${file.name}. Please check the source against this client's records and prepare any supported changes for review.`}
    setMessages(old=>[...old,user]);setStage(`Applying client guidance to ${file.name}…`)
    await ask([...messages,user],{filename:file.name,extracted:extracted.data,evidence:extracted.evidence},{filename:file.name,evidence:extracted.evidence,mimeType:mime(file)})
    setProcessed(n=>n+1)
   }catch(e){setError(`${file.name}: ${e instanceof Error?e.message:'Processing failed.'}`)}
  }}finally{processingRef.current=false;setProcessing(false);setStage('');if(fileRef.current)fileRef.current.value=''}
 }
 const send=async()=>{
  if(!message.trim()||processingRef.current)return;const next:Message={role:'user',content:message.trim()},history=[...messages,next];setMessages(history);setMessage('');setError('');setProcessing(true);processingRef.current=true;setStage('Checking the case and related records…')
  try{await ask(history,{related_sources:sources.current})}catch(e){setError(e instanceof Error?e.message:'AI request failed.')}finally{processingRef.current=false;setProcessing(false);setStage('')}
 }
 return <div className="workspace">
 <aside className="workflow-rail"><div className="workflow-rail__title"><span className="eyebrow">AI workspace</span><h3>Choose workflow</h3><p>Upload documents and work with AI.</p></div><div className="workflow-list">{workflowMeta.map(({id,name,description,icon:TileIcon})=><button key={id} disabled={processing} onClick={()=>setWorkflow(id)} className={workflow===id?'active':''}><span className="workflow-list__icon"><TileIcon size={18}/></span><span><strong>{name}</strong><small>{description}</small></span>{workflow===id?<i className="pulse-dot"/>:<ChevronRight size={15}/>}</button>)}</div></aside>
 <section className="thread-panel"><div className="thread-panel__header"><div><span className="workflow-symbol"><Icon size={19}/></span><div><h3>{meta.name} workflow</h3><span><i className="status-dot status-dot--connected"/>{processing?'Working…':'Ready'}</span></div></div><Badge tone="neutral">{localMode?'Local workspace':'Company workspace'}</Badge></div>
 <div className="thread-body"><div className="message message--workflow"><span className="message__avatar"><Bot size={17}/></span><div><p>Upload {meta.intro} for {client.name}. I’ll extract the supported details, compare them with this client’s records and send any proposed accounting changes to review.</p><small>AI assistant · selected client only</small></div></div>
 <button className={`drop-zone ${dragging?'drop-zone--active':''}`} disabled={processing} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files)}} onClick={()=>fileRef.current?.click()}><span className="drop-zone__icon"><UploadCloud size={26}/></span><strong>Drop {meta.accepts} here</strong><span>PDF, JPG, PNG, CSV, XLSX or text · 3 MB per file · up to 20 files</span><em>Browse files</em></button><input ref={fileRef} hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.txt" onChange={e=>e.target.files&&void upload(e.target.files)}/>
 {messages.map((m,i)=><div className={`message ${m.role==='assistant'?'message--workflow':'message--user'}`} key={i}>{m.role==='assistant'&&<span className="message__avatar"><Bot size={17}/></span>}<div><p style={{whiteSpace:'pre-wrap'}}>{m.content}</p><small>{m.role==='assistant'?'AI assistant':'You'}</small></div>{m.role==='user'&&<span className="message__avatar">You</span>}</div>)}
 {processing&&<div className="processing-card"><span className="processing-orbit"><Sparkles size={20}/></span><div><strong>Processing</strong><p>{stage}</p></div><span className="loading-dots"><i/><i/><i/></span></div>}
 {error&&<div role="alert" className="notice notice--warning"><AlertTriangle size={17}/><div><strong>Review needed</strong><p>{error}</p></div></div>}
 {pending.map(review=><div className="inline-review" key={review.id}><header><div><span className="inline-review__icon"><FileText size={19}/></span><div><span className="eyebrow">Staged proposal</span><h3>{review.filename}</h3></div></div><ConfidenceBadge value={review.confidence}/></header>{review.warning&&<div className="notice notice--warning"><AlertTriangle size={17}/><p>{review.warning}</p></div>}<div className="inline-review__fields">{Object.entries(review.fields).filter(([k])=>['reference','party','date','amount','currency'].includes(k)).map(([key,value])=><div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div><p style={{padding:'0 18px'}}>{review.actions?.length||0} proposed action(s). {review.amount>0&&money(review.amount,false,review.currency)}</p><footer><button className="button button--ghost" onClick={()=>setSelected(review)}>Review source & proposal</button><button className="button button--primary" disabled={busy||Boolean(review.exception)||Boolean(review.actions?.some(a=>a.type==='journal'))} onClick={()=>void approveReview(review.id).catch(e=>setError(e.message))}><Check size={16}/>Approve</button></footer></div>)}
 {workflow==='bank-reconciliation'&&state.bankRows.length>0&&<section className="report-preview"><header><h3>Recorded statement activity</h3></header><div className="preview-kpis"><div><span>Statement rows</span><strong>{state.bankRows.length}</strong></div><div><span>Confirmed cash matches</span><strong>{state.matches.length}</strong></div><div><span>Unmatched</span><strong>{state.bankRows.length-state.matches.length}</strong></div></div><p style={{padding:18}}>Cash-row matches are separate from a complete bank-to-GL balance reconciliation. Unexplained differences remain unresolved.</p></section>}
 {workflow==='bank-reconciliation'&&<BankReviewPanel key={activeClientId} currency={client.currency}/>}
 </div>
 <div className="composer"><button className="icon-button" disabled={processing} onClick={()=>fileRef.current?.click()} aria-label="Attach documents"><Paperclip size={18}/></button><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} disabled={processing} placeholder="Ask AI, explain a discrepancy, or give more details…"/><button className="send-button" disabled={processing||!message.trim()} onClick={()=>void send()} aria-label="Send message"><Send size={17}/></button></div>
 </section>
 <aside className="session-panel"><div className="session-panel__client"><span className="client-avatar" style={{background:client.color}}>{client.shortName}</span><div><span className="eyebrow">Active client</span><strong>{client.name}</strong></div></div><div className="session-stats"><div><strong>{processed}</strong><span>Processed</span></div><div><strong>{pending.length}</strong><span>Pending</span></div><div><strong>{error?1:0}</strong><span>Errors</span></div></div>{model&&<p style={{fontSize:11,color:'var(--muted)',marginTop:18}}>AI model: {model}</p>}<p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginTop:18}}>Check the original evidence in the review queue. Invoice balances, payments, goods claims and bank matches stay linked.</p></aside>
 <ReviewDrawer item={selected} onClose={()=>setSelected(null)} onApprove={approveReview} onReject={rejectReview}/>
 </div>
}
