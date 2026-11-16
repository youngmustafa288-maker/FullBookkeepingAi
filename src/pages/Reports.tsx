import {useState} from 'react'
import {Download} from 'lucide-react'
import {useApp} from '../context/AppContext'
import {useBookkeeping} from '../bookkeeping/context'
import {major,openAmount,summary} from '../bookkeeping/engine.mjs'
import {trialBalance} from '../bookkeeping/ledger.mjs'
import {balanceSheet,generalLedgerDetail,profitAndLoss,statementReadiness,type StatementReadiness} from '../bookkeeping/statements.mjs'
import {downloadCsv,money} from '../lib/format'
import {Badge} from '../components/Badge'

const tabs=['Trial Balance','Profit & Loss','Balance Sheet','General Ledger','Management Summary']
const todayMY=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const decimal=(value:number)=>major(value)

function ReadinessNote({readiness}:{readiness:StatementReadiness}){
 return <p style={{padding:'16px 24px',lineHeight:1.7}}>
  Internal approved journals only. {readiness.postedJournals} journal(s) through {readiness.asOf}.
  {' '}{readiness.opening?'Opening journal recorded.':'Opening journal missing.'}
  {' '}{readiness.unpostedSources?`${readiness.unpostedSources} approved source document(s) still require GL journals.`:'No missing GL journals among recorded, approved source documents.'}
  {' '}This is a draft internal report, not a statutory or independently audited statement. Review completeness and adjustments before relying on it.
 </p>
}

export function Reports(){
 const {clients,activeClientId}=useApp()
 const {state}=useBookkeeping()
 const client=clients.find(c=>c.id===activeClientId)!
 const [tab,setTab]=useState('Management Summary')
 const [asOf,setAsOf]=useState(todayMY)
 const [periodFrom,setPeriodFrom]=useState(()=>`${todayMY().slice(0,4)}-01-01`)
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(asOf)
 if(!validDate)return <div className="page-stack reports-page"><section className="panel statement-panel" style={{padding:24}}><h2>Financial reports</h2><label>Reporting date <input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label><p>Choose a reporting date to calculate ledger statements.</p></section></div>

 const currency=client.currency
 const totals=summary(state,asOf,currency)
 const tb=trialBalance(state,asOf,currency)
 const readiness=statementReadiness(state,asOf,currency)
 const profit=/^\d{4}-\d{2}-\d{2}$/.test(periodFrom)&&periodFrom<=asOf?profitAndLoss(state,periodFrom,asOf,currency):null
 const balance=balanceSheet(state,asOf,currency)
 const rows=state.documents.filter(d=>d.status==='approved'&&d.date<=asOf&&d.currency===currency).map(d=>({reference:d.reference,type:d.kind,party:d.party,date:d.date,currency:d.currency,amount:major(d.amount),open_amount:major(openAmount(state,d.id,asOf))}))
 const detail=generalLedgerDetail(state,asOf,currency)
 const exportLedger=()=>downloadCsv(`general-ledger-${client.id}-${currency}-${asOf}.csv`,detail.map(r=>({...r,debit:decimal(r.debit),credit:decimal(r.credit)})))
 const management=[
  {metric:'Receivables',value:decimal(totals.receivables),currency,as_of:asOf},
  {metric:'Payables',value:decimal(totals.payables),currency,as_of:asOf},
  {metric:'Unallocated collections',value:decimal(totals.unallocatedReceipts),currency,as_of:asOf},
  {metric:'Unallocated supplier payments',value:decimal(totals.unallocatedPayments),currency,as_of:asOf},
  {metric:'Pending reviews',value:String(state.cases.filter(c=>c.status==='pending').length+totals.pending),currency:'',as_of:asOf},
  {metric:'Unresolved goods claims',value:String(totals.disputes),currency:'',as_of:asOf}
 ]
 const exportProfit=()=>{
  if(!profit)return
  const period={from:periodFrom,through:asOf,currency}
  const accountRows=[...profit.revenues.map(r=>({section:'Revenue',...period,code:r.code,account:r.name,debit:decimal(r.debit),credit:decimal(r.credit),net:decimal(r.amount)})),...profit.expenses.map(r=>({section:'Expense',...period,code:r.code,account:r.name,debit:decimal(r.debit),credit:decimal(r.credit),net:decimal(r.amount)}))]
  downloadCsv(`profit-and-loss-${client.id}-${currency}-${periodFrom}-${asOf}.csv`,[
   ...accountRows,
   {section:'Total revenue',...period,code:'',account:'',debit:'',credit:'',net:decimal(profit.revenue)},
   {section:'Total expenses',...period,code:'',account:'',debit:'',credit:'',net:decimal(profit.expense)},
   {section:'Net profit / (loss)',...period,code:'',account:'',debit:'',credit:'',net:decimal(profit.netProfit)}
  ])
 }
 const exportBalance=()=>{
  const date={asOf,currency}
  const make=(section:string,entries:typeof balance.assets)=>entries.map(r=>({section,...date,code:r.code,account:r.name,debit:decimal(r.debit),credit:decimal(r.credit),net:decimal(r.balance)}))
  const summaryRow=(section:string,amount:number)=>({section,...date,code:'',account:'',debit:'',credit:'',net:decimal(amount)})
  downloadCsv(`balance-sheet-${client.id}-${currency}-${asOf}.csv`,[
   ...make('Assets',balance.assets),summaryRow('Total assets',balance.totalAssets),
   ...make('Liabilities',balance.liabilities),summaryRow('Total liabilities',balance.totalLiabilities),
   ...make('Posted equity',balance.equity),summaryRow('Unclosed cumulative earnings',balance.unclosedEarnings),
   summaryRow('Total equity incl. unclosed earnings',balance.totalEquity),summaryRow('Total liabilities and equity',balance.totalLiabilitiesAndEquity),summaryRow('Difference',balance.difference)
  ])
 }
 const journalBadge=<Badge tone={readiness.completeForRecordedSources?'success':'warning'}>{readiness.completeForRecordedSources?'Internal draft · coverage checked':'Partial ledger · review needed'}</Badge>
 return <div className="page-stack reports-page">
  <section className="page-intro page-intro--compact"><div><span className="eyebrow">Source-linked reporting</span><h2>Financial reports</h2><p>Select one report to view its figures and export its CSV for {client.name}.</p></div></section>
  <div className="report-controls"><div className="report-tabs">{tabs.map(t=><button className={tab===t?'active':''} key={t} onClick={()=>setTab(t)}>{t}</button>)}</div>
   {tab==='Profit & Loss'&&<label><span>Period from</span><input type="date" value={periodFrom} max={asOf} onChange={e=>setPeriodFrom(e.target.value)}/></label>}
   <label><span>As of</span><input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label>
  </div>

  {tab==='Management Summary'?<div className="analysis-stack"><section className="kpi-grid">{[{label:`${currency} receivables`,value:money(totals.receivables/100,false,currency)},{label:`${currency} payables`,value:money(totals.payables/100,false,currency)},{label:`${currency} unallocated collections`,value:money(totals.unallocatedReceipts/100,false,currency)},{label:`${currency} unallocated supplier payments`,value:money(totals.unallocatedPayments/100,false,currency)},{label:'Pending reviews',value:String(state.cases.filter(c=>c.status==='pending').length+totals.pending)},{label:'Unresolved goods claims',value:String(totals.disputes)}].map(k=><div className="kpi-card" key={k.label}><div><span>{k.label}</span></div><strong>{k.value}</strong><small>Recorded operational data</small></div>)}</section>
   <section className="panel variance-panel"><div className="panel__header"><div><span className="eyebrow">Supporting records</span><h3>Approved source documents</h3></div><button className="button button--secondary" onClick={()=>downloadCsv(`management-summary-${client.id}-${currency}-${asOf}.csv`,management)}><Download size={16}/>Export summary CSV</button></div><div className="variance-table"><div><span>Reference</span><span>Party</span><span>Currency</span><span>Amount</span><span>Open / available</span></div>{rows.map((r,i)=><div key={r.reference+i}><strong>{r.reference}</strong><span>{r.party}</span><span>{r.currency}</span><span>{r.amount}</span><span>{['sales-invoice','purchase-invoice','customer-receipt','supplier-payment','employee-claim','employee-reimbursement'].includes(r.type)?r.open_amount:'—'}</span></div>)}</div>{!rows.length&&<p style={{padding:20}}>No approved source documents for this date.</p>}</section>
  </div>:
  tab==='Trial Balance'&&tb.journalCount>0?<section className="panel statement-panel"><div className="statement-title"><div><span className="eyebrow">Reviewed internal journal entries · {currency}</span><h2>Trial Balance</h2></div>{journalBadge}</div><ReadinessNote readiness={readiness}/><div className="variance-table"><div><span>GL code</span><span>Account</span><span>Type</span><span>Debit ({currency})</span><span>Credit ({currency})</span></div>{tb.rows.map(r=><div key={r.code}><strong>{r.code}</strong><span>{r.name}</span><span>{r.type}</span><span>{decimal(r.debit)}</span><span>{decimal(r.credit)}</span></div>)}<div><strong>Totals</strong><span>—</span><span>—</span><strong>{decimal(tb.debitTotal)}</strong><strong>{decimal(tb.creditTotal)}</strong></div></div><div style={{padding:20}}><button className="button button--secondary" onClick={()=>downloadCsv(`trial-balance-${client.id}-${asOf}.csv`,tb.rows.map(r=>({code:r.code,account:r.name,type:r.type,currency,debit:decimal(r.debit),credit:decimal(r.credit)})))}><Download size={16}/>Export trial balance CSV</button></div></section>:
  tab==='Profit & Loss' && !profit?<section className="panel statement-panel"><div className="statement-title"><h2>Profit &amp; Loss</h2><Badge tone="warning">Invalid period</Badge></div><p style={{padding:24}}>Select a valid period start that is no later than the reporting date.</p></section>:
  tab==='Profit & Loss' && profit && tb.journalCount>0?<section className="panel statement-panel"><div className="statement-title"><div><span className="eyebrow">Period activity · {periodFrom} to {asOf} · {currency}</span><h2>Profit &amp; Loss</h2></div>{journalBadge}</div><ReadinessNote readiness={readiness}/><p style={{padding:'0 24px 12px',lineHeight:1.6}}>Only approved document journal activity within the selected period is included. Brought-forward opening balances are excluded.</p>
   <div className="statement-table"><div><span>Account</span><span>Debit ({currency})</span><span>Credit ({currency})</span><span>Net ({currency})</span></div>
    <div className="total"><strong>Revenue</strong><span>—</span><span>—</span><span>—</span></div>
    {profit.revenues.map(r=><div key={r.code}><span>{r.code} · {r.name}</span><span>{decimal(r.debit)}</span><span>{decimal(r.credit)}</span><span>{decimal(r.amount)}</span></div>)}
    <div className="total"><strong>Total revenue</strong><span/><span/><strong>{decimal(profit.revenue)}</strong></div>
    <div className="total"><strong>Expenses</strong><span>—</span><span>—</span><span>—</span></div>
    {profit.expenses.map(r=><div key={r.code}><span>{r.code} · {r.name}</span><span>{decimal(r.debit)}</span><span>{decimal(r.credit)}</span><span>{decimal(r.amount)}</span></div>)}
    <div className="total"><strong>Total expenses</strong><span/><span/><strong>{decimal(profit.expense)}</strong></div>
    <div className="total"><strong>Net profit / (loss)</strong><span/><span/><strong>{decimal(profit.netProfit)}</strong></div>
   </div><div style={{padding:20}}><button className="button button--secondary" onClick={exportProfit}><Download size={16}/>Export P&amp;L CSV</button></div></section>:
  tab==='Balance Sheet'&&tb.journalCount>0?<section className="panel statement-panel"><div className="statement-title"><div><span className="eyebrow">Cumulative ledger balances · {asOf} · {currency}</span><h2>Balance Sheet</h2></div>{journalBadge}</div><ReadinessNote readiness={readiness}/><p style={{padding:'0 24px 12px',lineHeight:1.6}}>Amounts retain signed contra balances. Unclosed cumulative earnings include all posted revenue and expense balances through this date; they are shown once in equity and may differ from selected-period P&amp;L.</p>
   <div className="statement-table"><div><span>Account</span><span>Debit ({currency})</span><span>Credit ({currency})</span><span>Net ({currency})</span></div>
    <div className="total"><strong>Assets</strong><span/><span/><span/></div>
    {balance.assets.map(r=><div key={r.code}><span>{r.code} · {r.name}</span><span>{decimal(r.debit)}</span><span>{decimal(r.credit)}</span><span>{decimal(r.balance)}</span></div>)}
    <div className="total"><strong>Total assets</strong><span/><span/><strong>{decimal(balance.totalAssets)}</strong></div>
    <div className="total"><strong>Liabilities</strong><span/><span/><span/></div>
    {balance.liabilities.map(r=><div key={r.code}><span>{r.code} · {r.name}</span><span>{decimal(r.debit)}</span><span>{decimal(r.credit)}</span><span>{decimal(r.balance)}</span></div>)}
    <div className="total"><strong>Total liabilities</strong><span/><span/><strong>{decimal(balance.totalLiabilities)}</strong></div>
    <div className="total"><strong>Equity</strong><span/><span/><span/></div>
    {balance.equity.map(r=><div key={r.code}><span>{r.code} · {r.name}</span><span>{decimal(r.debit)}</span><span>{decimal(r.credit)}</span><span>{decimal(r.balance)}</span></div>)}
    <div><strong>Unclosed cumulative earnings</strong><span/><span/><span>{decimal(balance.unclosedEarnings)}</span></div>
    <div className="total"><strong>Total equity</strong><span/><span/><strong>{decimal(balance.totalEquity)}</strong></div>
    <div className="total"><strong>Total liabilities and equity</strong><span/><span/><strong>{decimal(balance.totalLiabilitiesAndEquity)}</strong></div>
    <div className="total"><strong>Balance difference</strong><span/><span/><strong>{decimal(balance.difference)}</strong></div>
   </div><p style={{padding:'12px 24px',lineHeight:1.6}}>{balance.balanced?'Debits and credits agree mathematically.':'Assets do not equal liabilities and equity; investigate journal integrity.'} Mathematical agreement alone does not establish completeness.</p>
   <div style={{padding:20}}><button className="button button--secondary" onClick={exportBalance}><Download size={16}/>Export balance sheet CSV</button></div>
  </section>:
  tab==='General Ledger'?<section className="panel statement-panel"><div className="statement-title"><div><span className="eyebrow">Approved journal lines · through {asOf} · {currency}</span><h2>General Ledger</h2></div>{journalBadge}</div><ReadinessNote readiness={readiness}/>
   <div className="variance-table"><div><span>Date</span><span>Journal</span><span>Account</span><span>Debit ({currency})</span><span>Credit ({currency})</span></div>{detail.map(r=><div key={`${r.journal}-${r.line}`}><span>{r.date}</span><strong>{r.journal}</strong><span>{r.accountCode} · {r.accountName}</span><span>{decimal(r.debit)}</span><span>{decimal(r.credit)}</span></div>)}</div>{!detail.length&&<p style={{padding:24}}>No approved journal lines exist for this reporting date.</p>}
   <div style={{padding:20}}><button className="button button--secondary" disabled={!detail.length} onClick={exportLedger}><Download size={16}/>Export general ledger CSV</button></div>
  </section>:
  <section className="panel statement-panel"><div className="statement-title"><div><span className="eyebrow">Ledger source required</span><h2>{tab}</h2></div><Badge tone="warning">Not generated</Badge></div><p style={{padding:24,lineHeight:1.7}}>No approved journals exist for the reporting date. Upload the client records, approve source documents and post their reviewed journal entries first. This screen will not invent missing financial figures.</p></section>}
 </div>
}
