import {useState} from 'react'
import {Download} from 'lucide-react'
import {useBookkeeping} from '../bookkeeping/context'
import {closingReadiness,monthAfter,monthEnd} from '../bookkeeping/closing.mjs'
import {downloadCsv} from '../lib/format'
import {Badge} from './Badge'

const malaysiaToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
function latestCompletedMonth(){
 const [year,month]=malaysiaToday().slice(0,7).split('-').map(Number)
 const previous=new Date(Date.UTC(year,month-2,1))
 return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth()+1).padStart(2,'0')}`
}
export function MonthEndClosePanel({currency,companyId}:{currency:string;companyId:string}){
 const {state,act,busy}=useBookkeeping()
 const [month,setMonth]=useState(()=>state.closedThrough?monthAfter(state.closedThrough):latestCompletedMonth())
 const [reference,setReference]=useState(''),[reopenReason,setReopenReason]=useState('')
 const [controlsReviewed,setControlsReviewed]=useState(false),[adjustmentsReviewed,setAdjustmentsReviewed]=useState(false)
 const [notice,setNotice]=useState(''),[problem,setProblem]=useState('')
 const asOf=monthEnd(month)
 const pack=closingReadiness(state,asOf,currency,malaysiaToday())
 const closingAllowed=pack.ready&&controlsReviewed&&adjustmentsReviewed&&Boolean(reference.trim())&&!busy
 const close=async()=>{setNotice('');setProblem('');try{
  await act('close',{date:asOf,currency,reason:reference.trim(),controlsReviewed,adjustmentsReviewed})
  setNotice(`Month closed through ${asOf}. Historic journal and transaction dates are locked.`)
  setControlsReviewed(false);setAdjustmentsReviewed(false);setReference('');setMonth(monthAfter(asOf))
 }catch(e){setProblem(e instanceof Error?e.message:'Could not close the month.')}}
 const reopen=async()=>{setNotice('');setProblem('');try{
  await act('reopen',{reason:reopenReason.trim()})
  setNotice('Last close has been reopened; the reason and reviewer are in the audit log.')
  setReopenReason('')
 }catch(e){setProblem(e instanceof Error?e.message:'Could not reopen the close.')}}
 const exportPack=()=>downloadCsv(`month-end-review-${companyId}-${asOf}.csv`,pack.checks.map(c=>({companyId,asOf,baseCurrency:currency,recordCurrency:c.currency,check:c.label,status:c.status,details:c.detail,closedThrough:state.closedThrough||'',note:'Recorded data and manual review; not a statutory audit'})))
 const lastClose=[...(state.periodCloses||[])].reverse().find(c=>!c.reopenedAt)
 return <section className="panel variance-panel" style={{marginTop:16}}>
  <div className="panel__header"><div><span className="eyebrow">Monthly closing controls</span><h3>Month-end review &amp; period lock</h3></div><Badge tone={state.closedThrough?'success':'neutral'}>{state.closedThrough?`Closed through ${state.closedThrough}`:'Period open'}</Badge></div>
  <p style={{fontSize:12,padding:'0 20px 14px',lineHeight:1.7}}>A close checks posted journals, approvals, recorded control balances, statement matches and every recorded currency. It does not create missing entries or certify that all real-world source documents have been received. Check adjustments and statutory requirements separately.</p>
  <div style={{padding:'0 20px 14px',display:'flex',gap:12,alignItems:'end',flexWrap:'wrap'}}>
   <label style={{display:'grid',gap:5,fontSize:12}}>Month to review<input type="month" aria-label="Month to close" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}/></label>
   <div style={{fontSize:13,paddingBottom:7}}><strong>Cutoff: {asOf}</strong> · {pack.currencies.join(', ')}</div>
   <button className="button button--secondary" onClick={exportPack}><Download size={16}/>Export close checklist CSV</button>
  </div>
  <div className="variance-table"><div><span>Review check</span><span>Currency</span><span>Status</span><span>Findings</span><span>Action</span></div>
   {pack.checks.map(c=><div key={c.id}><strong>{c.label}</strong><span>{c.currency||'Company'}</span><span><Badge tone={c.status==='pass'?'success':c.status==='block'?'warning':'neutral'}>{c.status==='pass'?'Pass':c.status==='block'?'Blocked':'Manual review'}</Badge></span><span style={{gridColumn:'span 2',lineHeight:1.5}}>{c.detail}</span></div>)}
  </div>
  <div style={{padding:20,display:'grid',gap:12}}>
   <label style={{display:'grid',gap:5,fontSize:12}}>Close review reference / reviewer notes<input aria-label="Close review reference" value={reference} onChange={e=>setReference(e.target.value)} placeholder="e.g. Oct 2026 month-end review pack" maxLength={200}/></label>
   <label style={{display:'flex',gap:9,alignItems:'flex-start',fontSize:12,lineHeight:1.55}}><input type="checkbox" checked={controlsReviewed} onChange={e=>setControlsReviewed(e.target.checked)}/>I have reviewed the source records, GL reporting, mapped controls and bank evidence. No automatic test can prove all records were supplied.</label>
   <label style={{display:'flex',gap:9,alignItems:'flex-start',fontSize:12,lineHeight:1.55}}><input type="checkbox" checked={adjustmentsReviewed} onChange={e=>setAdjustmentsReviewed(e.target.checked)}/>I separately reviewed required accruals, depreciation, inventory, payroll, FX, SST/tax and other applicable period-end adjustments.</label>
   {pack.blocking.length>0&&<p style={{fontSize:12,lineHeight:1.55}}>Closing is disabled until {pack.blocking.length} recorded-data check(s) are resolved. See the findings above.</p>}
   <div><button className="button button--primary" onClick={()=>void close()} disabled={!closingAllowed}>Close month &amp; lock period</button></div>
   {lastClose&&<p style={{fontSize:12,lineHeight:1.55}}>Last recorded close: {lastClose.date} by {lastClose.closedBy} ({lastClose.closedAt}). Reference: {lastClose.reason}.</p>}
   {state.closedThrough&&<div style={{paddingTop:10,borderTop:'1px solid var(--line)',display:'grid',gap:8}}>
    <strong style={{fontSize:13}}>Reopen most recent month</strong>
    <p style={{fontSize:12,lineHeight:1.6}}>Reopening is audited and restores the previous lock date; it does not erase prior close history. Use only for an approved correction.</p>
    <label style={{display:'grid',gap:5,fontSize:12}}>Reason for reopening<input aria-label="Reopening reason" value={reopenReason} onChange={e=>setReopenReason(e.target.value)} placeholder="Explain the approved correction" maxLength={200}/></label>
    <div><button className="button button--secondary" disabled={busy||!reopenReason.trim()} onClick={()=>void reopen()}>Reopen last close</button></div>
   </div>}
   {problem&&<div className="notice notice--warning" role="alert">{problem}</div>}
   {notice&&<div className="notice notice--success" role="status">{notice}</div>}
  </div>
 </section>
}
