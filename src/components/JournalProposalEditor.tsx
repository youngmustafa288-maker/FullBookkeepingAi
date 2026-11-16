import {Plus,Trash2} from 'lucide-react'
import type {JournalCorrection} from '../context/AppContext'

export interface AccountChoice {code:string;name:string;type:string}

export function JournalProposalEditor({draft,index,accounts,disabled,onChange}:{
 draft:JournalCorrection;index:number;accounts:AccountChoice[];disabled:boolean;onChange:(updated:JournalCorrection)=>void
}){
 const change=(key:keyof Omit<JournalCorrection,'index'|'lines'>,value:string)=>onChange({...draft,[key]:value})
 const lineChange=(row:number,key:'code'|'debit'|'credit',value:string)=>onChange({...draft,lines:draft.lines.map((line,i)=>i===row?{...line,[key]:value}:line)})
 const totals=draft.lines.reduce((sum,line)=>({
  debit:sum.debit+(Number.isFinite(Number(line.debit))?Math.round(Number(line.debit)*100):0),
  credit:sum.credit+(Number.isFinite(Number(line.credit))?Math.round(Number(line.credit)*100):0)
 }),{debit:0,credit:0})
 const validLines=draft.lines.length>=2&&draft.lines.every(line=>{
  const valid=/^\d{1,11}(\.\d{1,2})?$/
  return valid.test(line.debit)&&valid.test(line.credit)&&((Number(line.debit)>0)!==(Number(line.credit)>0))
 })
 const equal=validLines&&totals.debit===totals.credit&&totals.debit>0
 const availableCodes=accounts.length>0
 return <section className="drawer-section" aria-label={`Journal action ${index+1}`}>
  <div className="section-heading"><h3>Journal {index+1} · GL coding</h3><span>Internal posting only</span></div>
  <p className="form-hint">Check the source document and approved chart before confirming. Both sides must balance in minor units.</p>
  <div className="field-list">
   <label className="review-field"><span>Journal reference</span><input value={draft.reference} disabled={disabled} onChange={e=>change('reference',e.target.value)}/></label>
   <label className="review-field"><span>Date</span><input type="date" value={draft.date} disabled={disabled} onChange={e=>change('date',e.target.value)}/></label>
   <label className="review-field"><span>Currency</span><input value={draft.currency} maxLength={3} disabled={disabled} onChange={e=>change('currency',e.target.value.toUpperCase())}/></label>
   <label className="review-field"><span>Accounting explanation</span><input value={draft.description} disabled={disabled} onChange={e=>change('description',e.target.value)}/></label>
  </div>
  <div className="review-field" style={{marginTop:10}}><label htmlFor={`journal-evidence-${index}`} style={{display:'block'}}>Evidence / reviewer source</label><input id={`journal-evidence-${index}`} style={{width:'100%'}} value={draft.evidence} disabled={disabled} onChange={e=>change('evidence',e.target.value)} /></div>
  <div style={{marginTop:14,display:'grid',gap:9}}>
   {draft.lines.map((line,row)=><div key={row} style={{border:'1px solid var(--line)',borderRadius:8,padding:9}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',marginBottom:7}}><strong style={{fontSize:11}}>GL line {row+1}</strong><button className="button button--ghost" type="button" disabled={disabled||draft.lines.length<=2} onClick={()=>onChange({...draft,lines:draft.lines.filter((_,i)=>i!==row)})} aria-label={`Remove journal line ${row+1}`}><Trash2 size={13}/></button></div>
    <label className="review-field" style={{display:'block'}}><span>Account code</span>
     <select style={{width:'100%'}} disabled={disabled||!availableCodes} aria-label={`GL code line ${row+1}`} value={line.code} onChange={e=>lineChange(row,'code',e.target.value)}>
      {!accounts.some(a=>a.code===line.code)&&<option value={line.code}>{line.code||'Select an approved GL code'} (not active in saved chart)</option>}
      {accounts.map(a=><option key={a.code} value={a.code}>{a.code} — {a.name} ({a.type})</option>)}
     </select>
    </label>
    <div className="field-list"><label className="review-field"><span>Debit</span><input inputMode="decimal" aria-label={`Debit line ${row+1}`} disabled={disabled} value={line.debit} onChange={e=>lineChange(row,'debit',e.target.value)}/></label><label className="review-field"><span>Credit</span><input inputMode="decimal" aria-label={`Credit line ${row+1}`} disabled={disabled} value={line.credit} onChange={e=>lineChange(row,'credit',e.target.value)}/></label></div>
   </div>)}
  </div>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:10}}>
   <button type="button" className="button button--ghost" disabled={disabled||draft.lines.length>=100} onClick={()=>onChange({...draft,lines:[...draft.lines,{code:accounts[0]?.code||'',debit:'0',credit:'0'}]})}><Plus size={14}/>Add GL line</button>
   <span style={{fontSize:10,color:equal?'var(--forest)':'var(--red)',textAlign:'right'}}>Debit {(totals.debit/100).toFixed(2)} · Credit {(totals.credit/100).toFixed(2)} {equal?'· Balanced':'· Not balanced'}</span>
  </div>
  {!availableCodes&&<p className="form-hint form-hint--danger">No active approved GL codes. Save a structured chart in Client Configuration before posting.</p>}
 </section>
}
