import {useMemo,useRef,useState} from 'react'
import {AlertTriangle,CheckCircle2,Download,FileSpreadsheet,ShieldCheck,UploadCloud} from 'lucide-react'
import {useBookkeeping} from '../bookkeeping/context'
import {major,minor} from '../bookkeeping/engine.mjs'
import {parseChart} from '../bookkeeping/ledger.mjs'
import {csvGrid,reviewOpeningGrid} from '../bookkeeping/opening.mjs'
import {downloadCsv} from '../lib/format'

type SourceFile = {name:string;grid:string[][];sha256:string}
const textValue = (value:unknown):string => {
 if(value==null)return ''
 if(value instanceof Date)return value.toISOString().slice(0,10)
 if(typeof value==='object'){
  if('formula' in value)throw Error('Spreadsheet formulas are not accepted. Export a checked, values-only trial balance.')
  if('richText' in value)return (value.richText as {text:string}[]).map(v=>v.text).join('')
  if('text' in value)return String(value.text)
  throw Error('Unsupported spreadsheet cell; export the trial balance as values-only CSV.')
 }
 return String(value)
}

async function readOpeningFile(file:File):Promise<SourceFile>{
 if(file.size===0||file.size>3_000_000)throw Error('Select a non-empty CSV/XLSX file below 3 MB.')
 const suffix=file.name.toLowerCase().split('.').pop()
 if(!['csv','xlsx'].includes(suffix||''))throw Error('Opening balances require a CSV or XLSX file.')
 let grid:string[][]
 const bytes=await file.arrayBuffer()
 if(suffix==='csv')grid=csvGrid(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 else{
  const ExcelJS=(await import('exceljs')).default
  const book=new ExcelJS.Workbook()
  await book.xlsx.load(new Uint8Array(bytes) as unknown as Parameters<typeof book.xlsx.load>[0])
  const sheet=book.worksheets[0]
  if(!sheet)throw Error('The workbook has no worksheets.')
  if(sheet.rowCount>1500)throw Error('Choose an opening trial balance with 1,500 rows or fewer.')
  grid=[]
  sheet.eachRow((row,index)=>{
   if(index>1500)throw Error('Opening trial balance has too many rows.')
   const cells:string[]=[]
   const limit=Math.min(50,row.cellCount)
   for(let column=1;column<=limit;column++)cells.push(textValue(row.getCell(column).value))
   grid.push(cells)
  })
 }
 let sha256=''
 // Not a replacement for retaining the original file. Browser hashing is optional
 // on older/non-secure environments; do not claim custody of the source document.
 if(globalThis.crypto?.subtle){
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes)
  sha256=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')
 }
 return {name:file.name,grid,sha256}
}

export function OpeningBalances({clientId,currency:clientCurrency}:{clientId:string;currency:string}){
 const {state,act,busy}=useBookkeeping()
 const [source,setSource]=useState<SourceFile|null>(null)
 const [openingDate,setOpeningDate]=useState('')
 const [currency,setCurrency]=useState(clientCurrency)
 const [evidenceNote,setEvidenceNote]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const [reading,setReading]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const fileInput=useRef<HTMLInputElement>(null)
 const existing=(state.journals||[]).find(j=>j.kind==='opening'&&j.currency===currency)
 const chart=useMemo(()=>{try{return {value:parseChart(state.contexts.glCodes),error:''}}catch(e){return {value:new Map(),error:e instanceof Error?e.message:'Invalid chart of accounts.'}}},[state.contexts.glCodes])
 const reviewed=useMemo(()=>{
  if(!source)return {value:null,error:''}
  try{return {value:reviewOpeningGrid(source.grid,chart.value,currency,minor),error:''}}
  catch(e){return {value:null,error:e instanceof Error?e.message:'Could not validate the trial balance.'}}
 },[source,chart,currency])
 const openingByCurrency=(state.journals||[]).filter(j=>j.kind==='opening')
 const progress=[
  {name:'Business profile',done:!!state.contexts.profile.trim()},
  {name:'Approved chart of accounts',done:[...chart.value.values()].some(a=>a.active)},
  {name:'Vendor mappings',done:!!state.contexts.vendors.trim()},
  {name:'Policies and rules',done:!!state.contexts.policies.trim()},
  {name:`Opening trial balance (${currency})`,done:!!existing},
 ]
 const completed=progress.filter(item=>item.done).length
 const importFile=async(file:File|undefined)=>{
  if(!file)return
  setError('');setNotice('');setSource(null);setConfirmed(false);setReading(true)
  try{setSource(await readOpeningFile(file))}catch(e){setError(e instanceof Error?e.message:'File could not be opened.')}finally{setReading(false);if(fileInput.current)fileInput.current.value=''}
 }
 const post=async()=>{
  if(!reviewed.value||!source||!openingDate||!evidenceNote.trim()||!confirmed||busy||existing)return
  setError('');setNotice('')
  try{
   const evidence=`Opening trial balance: ${source.name}${source.sha256?`; SHA-256 ${source.sha256}`:''}; Reviewer evidence: ${evidenceNote.trim()}`
   await act('journal',{
    kind:'opening',reference:`OPEN-${currency}-${openingDate}`,date:openingDate,currency,
    description:`Reviewed opening trial balance for ${clientId}`,evidence,lines:reviewed.value.lines
   })
   setSource(null);setEvidenceNote('');setConfirmed(false)
   setNotice('Opening balances approved and recorded in this client’s internal general ledger. Original evidence file must be retained separately.')
  }catch(e){setError(e instanceof Error?e.message:'Could not post opening journal.')}
 }
 const template=()=>{
  const rows=[...chart.value.values()].filter(a=>a.active).map(a=>({Code:a.code,Account:a.name,Debit:'',Credit:'',Currency:currency}))
  if(rows.length)downloadCsv(`opening-trial-balance-template-${clientId}-${currency}.csv`,rows)
 }
 return <section className="config-extracted" aria-label="Opening balances and client setup checklist">
  <div className="config-extracted__header"><ShieldCheck size={20}/><div><h3>One-time client setup checks</h3><p>{completed}/5 checks completed for {currency}. Financial opening balances require an independent review.</p></div></div>
  <div className="config-extracted__items">{progress.map(item=><div className="config-extracted__item" key={item.name}><div style={{display:'flex',alignItems:'center',gap:10}}>{item.done?<CheckCircle2 size={16} style={{color:'var(--forest)'}}/>:<span style={{color:'var(--amber)'}}><AlertTriangle size={16}/></span>}<span>{item.name}</span></div><small style={{color:'var(--muted)'}}>{item.done?'Saved / recorded':'Incomplete'}</small></div>)}</div>
  <div style={{paddingTop:20,display:'grid',gap:12}}>
   <div><h3>Opening trial balance</h3><p style={{color:'var(--muted)',fontSize:13,marginTop:4,lineHeight:1.7}}>Use a verified previous-period trial balance: one account code per row, with separate Debit and Credit columns. This is a manual, reviewer-approved ledger entry, not an AI guess. The original file is <strong>not stored</strong> by this import; retain it in your controlled records.</p></div>
   {openingByCurrency.length>0&&<p style={{fontSize:13,color:'var(--muted)'}}>Previously recorded: {openingByCurrency.map(j=>`${j.currency} · ${j.date} · ${j.reference}`).join(' | ')}</p>}
   <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
    <label style={{display:'grid',gap:5,fontSize:12,color:'var(--muted)'}}>Currency
     <input aria-label="Opening currency" value={currency} maxLength={3} onChange={e=>{setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g,''));setConfirmed(false)}} style={{padding:'9px 10px',maxWidth:110,border:'1px solid var(--line)',borderRadius:8}}/>
    </label>
    <label style={{display:'grid',gap:5,fontSize:12,color:'var(--muted)'}}>As-of date on source trial balance
     <input aria-label="Opening balance as-of date" type="date" value={openingDate} onChange={e=>{setOpeningDate(e.target.value);setConfirmed(false)}} style={{padding:'9px 10px',border:'1px solid var(--line)',borderRadius:8}}/>
    </label>
    <button className="button button--secondary" onClick={template} disabled={!chart.value.size}><Download size={15}/>CSV template</button>
    <button className="button button--secondary" onClick={()=>fileInput.current?.click()} disabled={reading||!!existing||busy||!chart.value.size}><UploadCloud size={15}/>{reading?'Reading file…':'Import CSV / XLSX'}</button>
    <input ref={fileInput} hidden aria-label="Opening balance import file" type="file" accept=".csv,.xlsx" onChange={e=>void importFile(e.target.files?.[0])}/>
   </div>
   {chart.error&&<div role="alert" className="notice notice--warning">{chart.error}</div>}
   {existing&&<div className="notice notice--success"><CheckCircle2 size={17}/>Opening journal already approved: {existing.reference}, {existing.date}, {existing.lines.length} lines. Changing it requires a separately audited reversal/adjustment; this import does not overwrite posted balances.</div>}
   {error&&<div role="alert" className="notice notice--warning"><AlertTriangle size={16}/>{error}</div>}
   {notice&&<div role="status" className="notice notice--success"><CheckCircle2 size={16}/>{notice}</div>}
   {source&&!existing&&<div style={{display:'grid',gap:12}}>
    <p style={{fontSize:13}}><FileSpreadsheet size={15} style={{verticalAlign:'middle',marginRight:6}}/><strong>{source.name}</strong>{source.sha256?' · SHA-256 calculated':' · file hash unavailable'} · Preview only — not posted</p>
    {reviewed.error&&<div role="alert" className="notice notice--warning"><AlertTriangle size={16}/>{reviewed.error}</div>}
    {reviewed.value&&<>
     <p style={{fontSize:13,lineHeight:1.6}}><strong>{reviewed.value.count} accounts</strong> · Debit {major(reviewed.value.debitTotal)} {currency} · Credit {major(reviewed.value.creditTotal)} {currency} · Balanced</p>
     <div style={{overflow:'auto',maxHeight:330,border:'1px solid var(--line)',borderRadius:10}}>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:12,textAlign:'left'}}><thead><tr>{['GL code','Account name','Debit','Credit'].map(label=><th key={label} style={{position:'sticky',top:0,background:'var(--paper)',padding:'10px 12px',borderBottom:'1px solid var(--line)'}}>{label}</th>)}</tr></thead><tbody>{reviewed.value.lines.map(line=><tr key={line.code}><td style={{padding:'7px 12px'}}>{line.code}</td><td style={{padding:'7px 12px'}}>{chart.value.get(line.code)?.name}</td><td style={{padding:'7px 12px'}}>{line.debit}</td><td style={{padding:'7px 12px'}}>{line.credit}</td></tr>)}</tbody></table>
     </div>
     <label style={{display:'grid',gap:6,fontSize:13}}>Source evidence / reviewer note (required)
      <textarea aria-label="Opening balance evidence" rows={2} value={evidenceNote} maxLength={700} placeholder="Example: Signed closing trial balance at 31 Oct 2026, approved by company accountant; original retained in finance records." onChange={e=>{setEvidenceNote(e.target.value);setConfirmed(false)}} style={{padding:12,border:'1px solid var(--line)',borderRadius:8}}/>
     </label>
     <label style={{display:'flex',alignItems:'flex-start',gap:9,fontSize:12,lineHeight:1.6}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} style={{marginTop:3}}/><span>I have checked all account codes, amounts, period and supporting evidence against the actual source trial balance. I understand the original file is not stored in this import.</span></label>
     <div><button className="button button--primary" disabled={busy||!confirmed||!openingDate||!evidenceNote.trim()||!reviewed.value} onClick={()=>void post()}><ShieldCheck size={16}/>{busy?'Saving…':'Approve and post opening balances'}</button></div>
    </>}
   </div>}
   <p style={{color:'var(--muted)',fontSize:12,lineHeight:1.65}}>Outstanding customer/supplier invoices and unpaid bills must be reviewed separately and reconciled with opening control-account balances; this import does not create invoices or allocate payments automatically. Each currency needs its own supported opening trial balance.</p>
  </div>
 </section>
}
