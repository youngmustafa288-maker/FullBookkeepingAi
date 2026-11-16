import {useMemo,useState} from 'react'
import {Download,Landmark} from 'lucide-react'
import {useBookkeeping} from '../bookkeeping/context'
import {candidates,major} from '../bookkeeping/engine.mjs'
import {cashbook,bankReconciliations} from '../bookkeeping/reconciliation.mjs'
import {parseChart} from '../bookkeeping/ledger.mjs'
import {downloadCsv} from '../lib/format'
import {Badge} from './Badge'
const fmt=(n:number,c:string)=>`${c} ${major(n)}`
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

/** Only existing bank workflow panels are used; do not mark incomplete books as reconciled. */
export function BankReviewPanel({currency}:{currency:string}){
 const {state,act,busy}=useBookkeeping()
 const [asOf,setAsOf]=useState(today),[account,setAccount]=useState(''),[selected,setSelected]=useState<Record<string,string>>({}),[notes,setNotes]=useState<Record<string,string>>({}),[problem,setProblem]=useState(''),[notice,setNotice]=useState(''),[mappedCode,setMappedCode]=useState('')
 const bankAccounts=[...new Set([...state.bankRows.filter(r=>r.currency===currency).map(r=>r.account),...(state.bankStatements||[]).filter(r=>r.currency===currency).map(r=>r.account)])].sort()
 const chosenAccount=bankAccounts.includes(account)?account:(bankAccounts[0]||'')
 const statements=useMemo(()=>bankReconciliations(state,asOf,currency).filter(r=>!chosenAccount||r.account===chosenAccount),[state,asOf,currency,chosenAccount])
 const ledger=useMemo(()=>cashbook(state,asOf,currency,chosenAccount||undefined),[state,asOf,currency,chosenAccount])
 const chart=[...parseChart(state.contexts.glCodes).values()].filter(a=>a.active&&a.type==='Asset')
 const selectedCode=state.controlAccounts?.banks?.[chosenAccount]||''
 const unmatched=state.bankRows.filter(r=>r.account===chosenAccount&&r.currency===currency&&r.date<=asOf&&!state.matches.some(m=>m.bankId===r.id))
 const post=async(rowId:string,docId:string,manual:boolean)=>{
  setProblem('');setNotice('');const note=notes[rowId]?.trim()||''
  if(manual&&!note){setProblem('For a non-exact match, explain the reference or date discrepancy before confirming.');return}
  try{await act('bank-match',{bankId:rowId,documentId:docId,reviewNote:note||'Exact bank reference, date, currency and amount reviewed.'});setNotice('Cash movement matched to statement. The GL balance must still be reconciled.');setSelected(prev=>({...prev,[rowId]:''}))}catch(e){setProblem(e instanceof Error?e.message:'Could not record match.')}
 }
 const saveMapping=async()=>{setProblem('');setNotice('');try{await act('control-map',{role:'bank',account:chosenAccount,code:mappedCode||selectedCode});setNotice('Bank GL control account mapping saved for this company.')}catch(e){setProblem(e instanceof Error?e.message:'Could not save mapping.')}}
 return <section className="report-preview" style={{marginTop:16}}><header><div><span className="eyebrow">Human-reviewed statement matching</span><h3>Bank / cash reconciliation</h3></div><Landmark size={20}/></header>
  <div style={{padding:18}}>
   <p style={{fontSize:12,lineHeight:1.7,color:'var(--muted)'}}>Only approved cash movements can be matched. A confirmed statement-row match does not create a GL journal, and differences remain outstanding until separately investigated.</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'end',marginTop:12}}>
    <label style={{display:'grid',gap:4,fontSize:12}}>Bank account<select value={chosenAccount} onChange={e=>{setAccount(e.target.value);setMappedCode('')}} style={{padding:9,borderRadius:6}}>{bankAccounts.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
    <label style={{display:'grid',gap:4,fontSize:12}}>As of<input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)} style={{padding:9}}/></label>
    <label style={{display:'grid',gap:4,fontSize:12}}>Reviewed GL bank account<select value={mappedCode||selectedCode} onChange={e=>setMappedCode(e.target.value)} style={{padding:9,borderRadius:6}}><option value="">Select GL asset code</option>{chart.map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label>
    <button className="button button--secondary" disabled={!chosenAccount||busy||!(mappedCode||selectedCode)} onClick={()=>void saveMapping()}>Save bank GL mapping</button>
   </div>
   {statements.length>0&&<div className="variance-table" style={{marginTop:16,overflowX:'auto'}}><div><span>Statement end date</span><span>Statement closing</span><span>GL closing</span><span>Difference</span><span>Status</span></div>{statements.map(s=><div key={s.id}><span>{s.endDate}</span><span>{fmt(s.closing,currency)}</span><span>{s.glClosing===null?'Not mapped':fmt(s.glClosing,currency)}</span><span>{s.difference===null?'—':fmt(s.difference,currency)}</span><span><Badge tone={s.status==='balanced'?'success':'warning'}>{s.status==='balanced'?'Balanced':s.status==='difference'?'Difference':'Incomplete'}</Badge><small style={{display:'block',fontSize:10}}>{s.unmatched} bank rows unmatched · {s.unmatchedCash} cashbook entries unmatched · {s.missingJournals} matched without GL journal</small></span></div>)}</div>}
   {(state.bankRows.length>0&&!statements.length)&&<p style={{marginTop:14,fontSize:12}}>No saved statement closing totals for this date/account (older imports may contain only individual rows).</p>}
   <h4 style={{marginTop:22,marginBottom:10}}>Unmatched statement rows ({unmatched.length})</h4>
   {unmatched.slice(0,50).map(row=>{
    const exact=candidates(state,row), eligible=state.documents.filter(d=>d.status==='approved'&&d.bankAccount===row.account&&d.currency===row.currency&&d.date<=asOf&&(d.direction==='out'?-d.amount:d.amount)===row.amount&&['customer-receipt','supplier-payment','expense-receipt','employee-reimbursement','customer-refund','supplier-refund','miscellaneous'].includes(d.kind)&&!state.matches.some(m=>m.documentId===d.id))
    const choice=selected[row.id]||'',manual=Boolean(choice&&!exact.some(d=>d.id===choice))
    const journal=state.journals.find(j=>j.sourceDocumentId===choice)
    return <div key={row.id} style={{padding:'12px 0',borderTop:'1px solid var(--line)',display:'grid',gap:8}}><div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}><strong>{row.date} · {fmt(row.amount,row.currency)}</strong><span style={{fontSize:12}}>{row.reference||'(No bank reference)'}</span><Badge tone={exact.length===1?'info':'warning'}>{exact.length===1?'1 exact suggestion':exact.length>1?'Ambiguous':'Manual review'}</Badge></div>
     <select aria-label={`Match ${row.sourceId}`} value={choice} onChange={e=>setSelected(old=>({...old,[row.id]:e.target.value}))} style={{padding:10,borderRadius:6}}><option value="">Choose approved cash record</option>{eligible.map(d=><option key={d.id} value={d.id}>{d.reference} · {d.party} · {d.date} {exact.some(m=>m.id===d.id)?'(exact)':'(manual)'}</option>)}</select>
     <input aria-label={`Review reason for ${row.sourceId}`} value={notes[row.id]||''} maxLength={1000} placeholder="Review note / reason for non-exact match" onChange={e=>setNotes(old=>({...old,[row.id]:e.target.value}))}/>
     {choice&&!journal&&<p style={{fontSize:12,color:'var(--muted)'}}>The chosen cash document has no approved journal entry. Match stays operational only.</p>}
     <button className="button button--secondary" disabled={busy||!choice||(manual&&!notes[row.id]?.trim())} onClick={()=>void post(row.id,choice,manual)}>Confirm reviewed cash match</button>
    </div>
   })}
   {unmatched.length>50&&<p style={{fontSize:12,marginTop:8}}>Showing the first 50 unresolved rows. Resolve these before the next batch appears.</p>}
   {!unmatched.length&&<p style={{fontSize:12,color:'var(--muted)'}}>No unmatched imported statement rows in this bank/date selection.</p>}
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:18,flexWrap:'wrap'}}><h4>Cashbook ({ledger.length})</h4><button className="button button--ghost" disabled={!ledger.length} onClick={()=>downloadCsv(`cashbook-${currency}-${asOf}.csv`,ledger.map(d=>({...d,signedAmount:major(d.signedAmount)})))}><Download size={15}/>Export cashbook CSV</button></div>
   <div className="variance-table" style={{overflowX:'auto'}}><div><span>Date</span><span>Reference</span><span>Amount</span><span>Bank match</span><span>GL journal</span></div>{ledger.slice(0,30).map(d=><div key={d.id}><span>{d.date}</span><strong>{d.reference}</strong><span>{fmt(d.signedAmount,currency)}</span><span>{d.matched?'Matched':'Open'}</span><span>{d.posted?'Posted':'Missing'}</span></div>)}</div>
   {ledger.length>30&&<p style={{fontSize:12}}>First 30 cashbook rows shown; export CSV for all {ledger.length}.</p>}
   {problem&&<div className="notice notice--warning" role="alert" style={{marginTop:12}}>{problem}</div>}{notice&&<div className="notice notice--success" role="status" style={{marginTop:12}}>{notice}</div>}
  </div>
 </section>
}
