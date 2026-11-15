import {useEffect,useState} from 'react'
import {AlertTriangle,Check,ExternalLink,FileText,X,Save} from 'lucide-react'
import type {ReviewItem} from '../types'
import {ConfidenceBadge} from './Badge'
import {money,mytDate} from '../lib/format'
import {useApp} from '../context/AppContext'
import {supabase} from '../lib/supabase'
interface Props{item:ReviewItem|null;onClose:()=>void;onApprove:(id:string)=>Promise<void>;onReject:(id:string)=>Promise<void>}
export function ReviewDrawer({item,onClose,onApprove,onReject}:Props){
 const {editReview,recordDetails}=useApp(),[fields,setFields]=useState<Record<string,string|number>>({}),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[url,setUrl]=useState<string|undefined>()
 const current=item?(recordDetails.find(r=>r.id===item.id)||item):null
 useEffect(()=>{setFields(current?.fields||{});setAck(false);setError('')},[current?.id])
 useEffect(()=>{let active=true;setUrl(current?.attachmentUrl);const prefix='evidence://bookkeeping-evidence/';if(current?.evidence?.startsWith(prefix))void supabase.storage.from('bookkeeping-evidence').createSignedUrl(current.evidence.slice(prefix.length),300).then(({data,error})=>{if(active&&!error)setUrl(data?.signedUrl)});return()=>{active=false}},[current?.id,current?.evidence])
 if(!current)return null
 const readOnly=Boolean(current.readOnly),approvalBlocked=Boolean(current.exception)&&!ack
 const run=async(kind:'save'|'approve'|'reject')=>{setBusy(true);setError('');try{if(kind!=='reject')await editReview(current.id,fields,ack);if(kind==='approve'){await onApprove(current.id);onClose()}else if(kind==='reject'){await onReject(current.id);onClose()}}catch(e){setError(e instanceof Error?e.message:'Review failed.')}finally{setBusy(false)}}
 return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Review details">
 <header className="drawer__header"><div><span className="eyebrow">{readOnly?'Record details':'Full review'}</span><h2>{current.reference}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></header>
 <div className="drawer__body drawer__body--crosscheck"><section className="attachment-pane"><div className="attachment-pane__header"><div><span className="eyebrow">Original attachment</span><strong><FileText size={15}/>{current.filename}</strong></div>{url&&<a className="icon-button" href={url} target="_blank" rel="noreferrer" aria-label="Open original attachment"><ExternalLink size={15}/></a>}</div>
 {url&&current.attachmentMimeType?.startsWith('image/')?<div className="attachment-preview"><img src={url} alt={`Original ${current.filename}`}/></div>:url&&current.attachmentMimeType==='application/pdf'?<object className="attachment-preview attachment-preview--pdf" data={url} type="application/pdf"><a href={url}>Open original PDF</a></object>:<div className="attachment-preview" style={{padding:28,display:'block'}}><FileText size={32}/><p>{url?<a href={url} target="_blank" rel="noreferrer">Download original source</a>:'Original preview is unavailable for this source reference.'}</p><p style={{overflowWrap:'anywhere'}}>{current.evidence||'Attach or identify the original evidence before approval.'}</p></div>}
 <p className="attachment-pane__hint">Compare the original evidence with the proposed fields and actions.</p></section>
 <section className="proposal-pane"><div className="review-document"><div><span className="eyebrow">{readOnly?'Recorded document':'AI proposal'}</span><strong>{current.party}</strong></div><ConfidenceBadge value={current.confidence}/></div>
 {current.explanation&&<p style={{whiteSpace:'pre-wrap'}}>{current.explanation}</p>}{current.warning&&<div className="notice notice--warning"><AlertTriangle size={18}/><p>{current.warning}</p></div>}
 {error&&<div role="alert" className="notice notice--warning">{error}</div>}
 <section className="drawer-section"><div className="section-heading"><h3>{readOnly?'Recorded fields':'Proposed fields'}</h3><span>{readOnly?'Read only':'Editable before approval'}</span></div><div className="field-list">{Object.entries(fields).map(([key,value])=><label className="review-field" key={key}><span>{key}</span><input value={value} disabled={readOnly||busy||key==='kind'} onChange={e=>setFields(old=>({...old,[key]:e.target.value}))} aria-label={key}/></label>)}</div></section>
 {current.actions&&current.actions.length>0&&<section className="drawer-section"><h3>Changes proposed for approval</h3>{current.actions.map((a,i)=><details key={i}><summary>{i+1}. {a.type.replace(/-/g,' ')}</summary><pre style={{whiteSpace:'pre-wrap',fontSize:11}}>{JSON.stringify(a.payload,null,2)}</pre></details>)}</section>}
 <section className="drawer-section compact-grid"><div><span className="meta-label">Date</span><strong>{mytDate(current.date)}</strong></div><div><span className="meta-label">Amount</span><strong>{money(current.amount,false,current.currency)}</strong></div><div><span className="meta-label">Approval</span><strong>{readOnly?'Recorded':approvalBlocked?'Needs clarification':'Ready for review'}</strong></div><div><span className="meta-label">External posting</span><strong>Not connected</strong></div></section>
 {!readOnly&&current.exception&&(current.actions?.length||0)>0&&<label className="review-ack"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I have resolved or documented the flagged questions and checked the supporting evidence.</label>}
 {!readOnly&&current.exception&&!current.actions?.length&&<p className="form-hint">Continue the AI conversation to supply missing evidence and prepare an actionable proposal.</p>}
 </section></div>
 <footer className="drawer__footer">{readOnly?<button className="button button--secondary" onClick={onClose}>Close</button>:<><button className="button button--ghost" disabled={busy} onClick={()=>void run('reject')}><X size={16}/>Reject</button><button className="button button--secondary" disabled={busy} onClick={()=>void run('save')}><Save size={16}/>Save corrections</button><button className="button button--primary" disabled={busy||approvalBlocked} onClick={()=>void run('approve')}><Check size={16}/>{busy?'Saving…':'Approve'}</button></>}</footer>
 </aside></div>
}
