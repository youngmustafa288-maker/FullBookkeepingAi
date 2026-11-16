/**
 * Human-reviewed operational subledgers and internal-GL reconciliation.
 * Values remain integer minor units; currencies and company state are never mixed.
 * A matching operational balance is not proof of complete source coverage.
 */
import { openAmount } from './engine.mjs'
import { parseChart } from './ledger.mjs'

const invoiceKinds = {customer:'sales-invoice', supplier:'purchase-invoice'}
const paymentKinds = {customer:'customer-receipt', supplier:'supplier-payment'}
const cashKinds = new Set(['customer-receipt','supplier-payment','expense-receipt','employee-reimbursement','customer-refund','supplier-refund','miscellaneous'])

export function partyBalances(state, role, asOf = '9999-12-31', currency = 'MYR') {
  if (!Object.hasOwn(invoiceKinds, role)) throw Error('Choose customer or supplier balances.')
  const docs = (state.documents || []).filter(d => d.status === 'approved' && d.date <= asOf && d.currency === currency && (d.kind === invoiceKinds[role] || d.kind === paymentKinds[role]))
  const parties = new Map()
  for (const d of docs) {
    const key = d.party.trim().toLocaleLowerCase('en')
    const current = parties.get(key) || {party:d.party,currency,invoiceCount:0,openInvoices:0,unallocatedPayments:0,overdue:0,aging:{current:0,days1to30:0,days31to60:0,days61plus:0},documents:[]}
    const amount = openAmount(state,d.id,asOf)
    if (amount < 0) throw Error(`Negative open amount for ${d.reference}.`)
    current.documents.push({id:d.id,kind:d.kind,reference:d.reference,date:d.date,dueDate:d.dueDate,open:amount})
    if (d.kind === invoiceKinds[role]) {
      current.invoiceCount++
      current.openInvoices += amount
      const cutoff = d.dueDate || d.date
      const days = Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(cutoff))/86400000))
      if (cutoff >= asOf) current.aging.current += amount
      else if (days <= 30) current.aging.days1to30 += amount
      else if (days <= 60) current.aging.days31to60 += amount
      else current.aging.days61plus += amount
      if (cutoff < asOf) current.overdue += amount
    } else current.unallocatedPayments += amount
    parties.set(key,current)
  }
  const rows = [...parties.values()].sort((a,b)=>a.party.localeCompare(b.party))
  const sum = field => rows.reduce((v,p)=>v+p[field],0)
  return {role,currency,asOf,rows,openInvoices:sum('openInvoices'),unallocatedPayments:sum('unallocatedPayments'),net:sum('openInvoices') - sum('unallocatedPayments'),overdue:sum('overdue')}
}

export function settlementOptions(state, asOf = '9999-12-31') {
  const invoices = (state.documents||[]).filter(d=>d.status==='approved'&&['sales-invoice','purchase-invoice'].includes(d.kind)&&d.date<=asOf&&openAmount(state,d.id,asOf)>0)
  const payments = (state.documents||[]).filter(d=>d.status==='approved'&&['customer-receipt','supplier-payment'].includes(d.kind)&&d.date<=asOf&&openAmount(state,d.id,asOf)>0)
  return invoices.flatMap(invoice=>payments.filter(payment=>payment.party.trim().toLowerCase()===invoice.party.trim().toLowerCase()&&payment.currency===invoice.currency&&payment.date<=asOf&&((invoice.kind==='sales-invoice'&&payment.kind==='customer-receipt')||(invoice.kind==='purchase-invoice'&&payment.kind==='supplier-payment'))).map(payment=>({invoiceId:invoice.id,paymentId:payment.id,party:invoice.party,currency:invoice.currency,invoiceRef:invoice.reference,paymentRef:payment.reference,invoiceOpen:openAmount(state,invoice.id,asOf),paymentAvailable:openAmount(state,payment.id,asOf),maxAmount:Math.min(openAmount(state,invoice.id,asOf),openAmount(state,payment.id,asOf)),earliestDate:invoice.date>payment.date?invoice.date:payment.date})))
}

export function cashbook(state, asOf='9999-12-31', currency='MYR', account) {
  const journals=new Set((state.journals||[]).filter(j=>j.currency===currency&&j.date<=asOf&&j.sourceDocumentId).map(j=>j.sourceDocumentId))
  return (state.documents||[]).filter(d=>d.status==='approved'&&cashKinds.has(d.kind)&&d.currency===currency&&d.date<=asOf&&(!account||d.bankAccount===account)).map(d=>({id:d.id,reference:d.reference,date:d.date,party:d.party,kind:d.kind,bankAccount:d.bankAccount,currency:d.currency,signedAmount:(d.direction==='out'?-1:1)*d.amount,posted:journals.has(d.id),matched:(state.matches||[]).some(m=>m.documentId===d.id)})).sort((a,b)=>a.date.localeCompare(b.date)||a.reference.localeCompare(b.reference))
}

export function glNet(state, code, currency, asOf='9999-12-31') {
  if (!code) return null
  let net=0
  for(const j of state.journals||[]){if(j.currency!==currency||j.date>asOf)continue;for(const line of j.lines){if(line.code!==code)continue;net+=line.debit-line.credit;if(!Number.isSafeInteger(net))throw Error('GL account exceeds safe monetary precision.')}}
  return net
}

/** Current account control amounts use NET balances including unallocated cash. */
export function controlReconciliation(state, role, asOf='9999-12-31', currency='MYR') {
  const controlCode=state.controlAccounts?.[role]||''
  const operational=partyBalances(state,role,asOf,currency)
  const gl=glNet(state,controlCode,currency,asOf)
  const posted=new Set((state.journals||[]).filter(j=>j.currency===currency&&j.date<=asOf&&j.sourceDocumentId).map(j=>j.sourceDocumentId))
  const relevant=role==='customer'?new Set(['sales-invoice','sales-credit','customer-receipt','customer-refund']):new Set(['purchase-invoice','purchase-credit','supplier-payment','supplier-refund'])
  const unposted=(state.documents||[]).filter(d=>d.status==='approved'&&d.currency===currency&&d.date<=asOf&&relevant.has(d.kind)&&!posted.has(d.id))
  const opening=(state.journals||[]).some(j=>j.kind==='opening'&&j.currency===currency&&j.date<=asOf)
  // A/R normally debit-positive; A/P normally credit-positive. A signed difference is meaningful even for a credit balance.
  const ledgerBalance=gl===null?null:role==='supplier'?-gl:gl
  const difference=ledgerBalance===null?null:ledgerBalance-operational.net
  const complete=Boolean(controlCode)&&opening&&unposted.length===0
  return {role,currency,asOf,controlCode,operationalBalance:operational.net,glBalance:ledgerBalance,difference,unposted:unposted.length,opening,complete,status:!controlCode?'unmapped':!complete?'incomplete':difference===0?'balanced':'difference'}
}

export function bankReconciliations(state, asOf='9999-12-31', currency='MYR') {
  const posted=new Set((state.journals||[]).filter(j=>j.currency===currency&&j.date<=asOf&&j.sourceDocumentId).map(j=>j.sourceDocumentId))
  const batches=(state.bankStatements||[]).filter(b=>b.currency===currency&&b.endDate<=asOf)
  return batches.map(b=>{
   const rows=(state.bankRows||[]).filter(r=>r.statementId===b.id)
   const matched=rows.map(r=>(state.matches||[]).find(m=>m.bankId===r.id)).filter(Boolean)
   const unmatched=rows.filter(r=>!(state.matches||[]).some(m=>m.bankId===r.id))
   const missingJournals=matched.filter(m=>!posted.has(m.documentId)).length
   const code=state.controlAccounts?.banks?.[b.account]||''
   const balance=glNet(state,code,currency,b.endDate)
   const difference=balance===null?null:b.closing-balance
   const opening=(state.journals||[]).some(j=>j.kind==='opening'&&j.currency===currency&&j.date<=b.endDate)
   const unmatchedCash=cashbook(state,b.endDate,currency,b.account).filter(d=>!d.matched).length
   const complete=Boolean(code)&&opening&&unmatched.length===0&&unmatchedCash===0&&missingJournals===0
   return {...b,matched:matched.length,unmatched:unmatched.length,unmatchedCash,missingJournals,glCode:code,glClosing:balance,difference,complete,status:!code?'unmapped':!complete?'incomplete':difference===0?'balanced':'difference'}
  })
}

export function validateControlMapping(state, role, code, account) {
  const chart=parseChart(state.contexts?.glCodes)
  if (!['customer','supplier','bank'].includes(role)) throw Error('Unknown control account role.')
  if (role==='bank' && (typeof account!=='string'||!account.trim()||account.length>200)) throw Error('A bank account identifier is required.')
  if (typeof code!=='string'||!code.trim()) throw Error('Select an active GL control account.')
  const gl=chart.get(code)
  if (!gl||!gl.active) throw Error('Choose an active account from the approved GL chart.')
  const expected=role==='supplier'?'Liability':'Asset'
  if (gl.type!==expected) throw Error(`${role} control GL account must be an ${expected}.`)
  const mapped=state.controlAccounts||{customer:'',supplier:'',banks:{}}
  const otherRole=role==='customer'?'supplier':'customer'
  if(role!=='customer'&&mapped.customer===code || role!=='supplier'&&mapped.supplier===code)throw Error('Different GL control balances must use different account codes.')
  for(const [bankId,bankCode] of Object.entries(mapped.banks||{}))if(bankCode===code&&(role!=='bank'||bankId!==account.trim()))throw Error('Each bank/control mapping must use a distinct GL account code.')
  return {code, account:role==='bank'?account.trim():null}
}
