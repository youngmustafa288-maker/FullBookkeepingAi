import {useState} from 'react'
import {useBookkeeping} from '../bookkeeping/context'
import {controlReconciliation} from '../bookkeeping/reconciliation.mjs'
import {parseChart} from '../bookkeeping/ledger.mjs'
import {major} from '../bookkeeping/engine.mjs'
import {Badge} from './Badge'
const fmt=(n:number,c:string)=>`${c} ${major(n)}`
export function ControlReconciliation({asOf,currency}:{asOf:string;currency:string}) {
 const {state,act,busy}=useBookkeeping()
 const [drafts,setDrafts]=useState<Record<string,string>>({}),[notice,setNotice]=useState(''),[problem,setProblem]=useState('')
 const chart=[...parseChart(state.contexts.glCodes).values()].filter(a=>a.active)
 const save=async(role:'customer'|'supplier',code:string)=>{setNotice('');setProblem('');try{await act('control-map',{role,code});setNotice(`${role==='customer'?'Receivable':'Payable'} control account saved.`)}catch(e){setProblem(e instanceof Error?e.message:'Could not save mapping.')}}
 return <section className="panel variance-panel" style={{marginTop:16}}><div className="panel__header"><div><span className="eyebrow">GL control account reconciliation</span><h3>Receivables and payables vs ledger</h3></div><Badge tone="neutral">Reviewed account mapping</Badge></div>
  <p style={{fontSize:12,padding:'0 20px 15px',lineHeight:1.65}}>Choose the real control account from the approved chart. Changes to mappings require reopening a closed period. The operational balance nets open invoices against unallocated receipts/payments. A green balance requires an opening journal and GL journals for all relevant approved source records. Reconciliation is not proof that every external document was provided.</p>
  <div className="variance-table"><div><span>Schedule</span><span>Mapped GL account</span><span>Operational net</span><span>Internal GL</span><span>Difference / status</span></div>{(['customer','supplier'] as const).map(role=>{
   const r=controlReconciliation(state,role,asOf,currency)
   return <div key={role}><strong>{role==='customer'?'Customers / AR':'Suppliers / AP'}</strong><span style={{display:'flex',gap:5,flexWrap:'wrap'}}><select aria-label={`${role} GL account`} value={drafts[role]??r.controlCode} onChange={e=>setDrafts(old=>({...old,[role]:e.target.value}))}><option value="">Select control code</option>{chart.filter(a=>a.type===(role==='customer'?'Asset':'Liability')).map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select><button className="button button--ghost" disabled={busy||Boolean(state.closedThrough)||!(drafts[role]??r.controlCode)} onClick={()=>void save(role,drafts[role]??r.controlCode)}>Save</button></span><span>{fmt(r.operationalBalance,currency)}</span><span>{r.glBalance===null?'Not mapped':fmt(r.glBalance,currency)}</span><span><Badge tone={r.status==='balanced'?'success':'warning'}>{r.status==='balanced'?'Balanced':r.status==='difference'?'Difference':r.status==='unmapped'?'Unmapped':'Incomplete'}</Badge><small style={{display:'block',fontSize:11}}>{r.difference===null?'—':`Difference ${fmt(r.difference,currency)}`}; {r.unposted} unposted sources</small></span></div>
  })}</div>
  {problem&&<div className="notice notice--warning" role="alert" style={{margin:16}}>{problem}</div>}{notice&&<div className="notice notice--success" role="status" style={{margin:16}}>{notice}</div>}
 </section>
}
