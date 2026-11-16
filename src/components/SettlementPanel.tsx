import {useMemo,useState} from 'react'
import {Download,Link2} from 'lucide-react'
import {useBookkeeping} from '../bookkeeping/context'
import {major} from '../bookkeeping/engine.mjs'
import {partyBalances,settlementOptions} from '../bookkeeping/reconciliation.mjs'
import {downloadCsv} from '../lib/format'
import {Badge} from './Badge'

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const fmt=(v:number,c:string)=>`${c} ${major(v)}`

/** Existing Accounts screen; allocations don't create journals or bank matches. */
export function SettlementPanel({currency}:{currency:string}){
 const {state,act,busy}=useBookkeeping()
 const [asOf,setAsOf]=useState(today),[role,setRole]=useState<'customer'|'supplier'>('customer')
 const [pairId,setPairId]=useState(''),[amount,setAmount]=useState(''),[when,setWhen]=useState(today),[note,setNote]=useState(''),[problem,setProblem]=useState(''),[notice,setNotice]=useState('')
 const ledger=useMemo(()=>partyBalances(state,role,asOf,currency),[state,role,asOf,currency])
 const options=useMemo(()=>settlementOptions(state,asOf).filter(x=>x.currency===currency&&(role==='customer'?state.documents.some(d=>d.id===x.invoiceId&&d.kind==='sales-invoice'):state.documents.some(d=>d.id===x.invoiceId&&d.kind==='purchase-invoice'))),[state,asOf,currency,role])
 const current=options.find(o=>`${o.invoiceId}::${o.paymentId}`===pairId)
 const assign=async()=>{
  setProblem('');setNotice('')
  if(!current){setProblem('Select a compatible invoice and receipt or payment.');return}
  if(!note.trim()){setProblem('Enter a short allocation evidence/reference note for audit review.');return}
  try{await act('allocate',{invoiceId:current.invoiceId,paymentId:current.paymentId,amount,date:when,reviewNote:note.trim()});setNotice(`Allocation recorded. No new cash movement or journal was created.`);setPairId('');setAmount('');setNote('')}
  catch(e){setProblem(e instanceof Error?e.message:'Allocation could not be recorded.')}
 }
 const exportRows=ledger.rows.flatMap(p=>p.documents.filter(d=>d.kind===(role==='customer'?'sales-invoice':'purchase-invoice')).map(d=>({party:p.party,currency,invoice:d.reference,invoice_date:d.date,due_date:d.dueDate||'',open_amount:major(d.open)})))
 return <section className="panel" style={{padding:22}}>
  <div className="panel__header" style={{padding:0,marginBottom:16}}><div><span className="eyebrow">Reviewed customer and supplier schedules</span><h3>Open balances & payment allocation</h3></div><button className="button button--secondary" disabled={!exportRows.length} onClick={()=>downloadCsv(`${role}-aging-${currency}-${asOf}.csv`,exportRows)}><Download size={15}/>Export open invoices</button></div>
  <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginBottom:16}}>Operational subledger from approved documents and allocations, not an automatically balanced GL. Separate currencies; future transactions are excluded.</p>
  <div className="report-controls" style={{marginBottom:16}}><div className="filter-tabs"><button className={role==='customer'?'active':''} onClick={()=>setRole('customer')}>Customers (AR)</button><button className={role==='supplier'?'active':''} onClick={()=>setRole('supplier')}>Suppliers (AP)</button></div><label><span>As of</span><input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label></div>
  <div className="preview-kpis" style={{marginBottom:16}}><div><span>Open invoices</span><strong>{fmt(ledger.openInvoices,currency)}</strong></div><div><span>Unallocated {role==='customer'?'receipts':'payments'}</span><strong>{fmt(ledger.unallocatedPayments,currency)}</strong></div><div><span>Net operational balance</span><strong>{fmt(ledger.net,currency)}</strong></div></div>
  <div className="variance-table"><div><span>Party</span><span>Open invoices</span><span>Overdue</span><span>Unallocated</span><span>61+ days</span></div>{ledger.rows.map(p=><div key={p.party}><strong>{p.party}</strong><span>{fmt(p.openInvoices,currency)}</span><span>{fmt(p.overdue,currency)}</span><span>{fmt(p.unallocatedPayments,currency)}</span><span>{fmt(p.aging.days61plus,currency)}</span></div>)}{!ledger.rows.length&&<p style={{padding:18}}>No approved {role} records for this date.</p>}</div>
  <div style={{borderTop:'1px solid var(--line)',marginTop:22,paddingTop:20}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><Link2 size={17}/><h3 style={{fontSize:16}}>Allocate an approved payment</h3><Badge tone="neutral">Bookkeeper review</Badge></div>
   <p style={{color:'var(--muted)',fontSize:12,marginBottom:12}}>Only matching parties, currencies, and customer/supplier document types are offered. Allocations reduce open balances but do not post additional journals.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
    <label style={{display:'grid',gap:5,fontSize:12}}>Invoice / payment pair<select value={pairId} onChange={e=>{setPairId(e.target.value);const opt=options.find(o=>`${o.invoiceId}::${o.paymentId}`===e.target.value);setAmount(opt?major(opt.maxAmount):'');if(opt&&when<opt.earliestDate)setWhen(opt.earliestDate)}} style={{padding:10,border:'1px solid var(--line)',borderRadius:6}}><option value="">Select compatible records</option>{options.map(o=><option key={`${o.invoiceId}-${o.paymentId}`} value={`${o.invoiceId}::${o.paymentId}`}>{o.party} · {o.invoiceRef} ← {o.paymentRef} ({fmt(o.maxAmount,currency)} available)</option>)}</select></label>
    <label style={{display:'grid',gap:5,fontSize:12}}>Amount ({currency})<input type="text" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label>
    <label style={{display:'grid',gap:5,fontSize:12}}>Allocation date<input type="date" value={when} min={current?.earliestDate} onChange={e=>setWhen(e.target.value)}/></label>
    <label style={{display:'grid',gap:5,fontSize:12}}>Review reference / evidence<input type="text" value={note} maxLength={200} onChange={e=>setNote(e.target.value)} placeholder="Payment advice / reviewer note"/></label>
   </div>
   {problem&&<div className="notice notice--warning" role="alert" style={{marginTop:12}}>{problem}</div>}{notice&&<div className="notice notice--success" role="status" style={{marginTop:12}}>{notice}</div>}
   <button className="button button--primary" disabled={busy||!current||!amount||!note.trim()} style={{marginTop:12}} onClick={()=>void assign()}>Confirm allocation</button>
  </div>
 </section>
}
