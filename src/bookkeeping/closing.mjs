/**
 * Read-only month-end review checklist. Status 'pass' means only the specified
 * recorded-data check passed; it is never a statutory or audit opinion.
 * No journal, GL mapping, balance or bank match is created by this module.
 */
import {statementReadiness,balanceSheet} from './statements.mjs'
import {trialBalance} from './ledger.mjs'
import {controlReconciliation,bankReconciliations,cashbook} from './reconciliation.mjs'

export function monthEnd(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Choose a valid YYYY-MM month.')
  const [year,number] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(year,number,0)).getUTCDate()).padStart(2,'0')}`
}
export function monthAfter(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Previous close date is invalid.')
  const [year,number] = date.slice(0,7).split('-').map(Number)
  const next = new Date(Date.UTC(year,number,1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}`
}
const blocked = (id,label,detail,currency='')=>({id,label,detail,currency,status:'block'})
const passed = (id,label,detail,currency='')=>({id,label,detail,currency,status:'pass'})
const attention = (id,label,detail,currency='')=>({id,label,detail,currency,status:'review'})

/** Check every recorded currency; closing the company must not silently omit USD etc. */
export function closingReadiness(state, asOf, baseCurrency='MYR', today=null) {
  if (typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || monthEnd(asOf.slice(0,7)) !== asOf) throw Error('A close date must be the last calendar day of a real month.')
  if (typeof baseCurrency !== 'string' || !/^[A-Z]{3}$/.test(baseCurrency)) throw Error('A three-letter base currency is required.')
  const checks=[]
  const add=(condition,id,label,ok,bad,currency='')=>checks.push(condition?passed(id,label,ok,currency):blocked(id,label,bad,currency))
  if (today) add(asOf<=today,'cutoff','Completed month','Month end is not in the future.','Cannot close a future month.')
  if (state.closedThrough) {
    const next=monthEnd(monthAfter(state.closedThrough))
    add(asOf===next,'sequence','Closing sequence',`This is the month after ${state.closedThrough}.`,`Next permitted close is ${next}; no intervening months can be skipped.`)
  }
  const cases=(state.cases||[]).filter(c=>c.status==='pending')
  add(cases.length===0,'cases','AI review queue','No pending AI review cases.',`${cases.length} unresolved proposal(s).`)
  const pending=(state.documents||[]).filter(d=>d.status==='pending'&&d.date<=asOf)
  add(pending.length===0,'documents','Source approvals','No pending source documents through cutoff.',`${pending.length} source document(s) awaiting approval.`)
  const claims=(state.goods||[]).filter(g=>!g.resolved&&g.date<=asOf)
  add(claims.length===0,'claims','Goods and credit claims','No unresolved recorded goods claims.',`${claims.length} unresolved goods claim(s).`)
  const unmatchedRows=(state.bankRows||[]).filter(r=>r.date<=asOf&&!(state.matches||[]).some(m=>m.bankId===r.id))
  add(unmatchedRows.length===0,'unmatched-bank','Unmatched bank statement rows','Every imported row through cutoff is matched.',`${unmatchedRows.length} bank statement row(s) remain unmatched.`)
  const currencies = new Set([baseCurrency])
  for (const source of [...(state.documents||[]).filter(d=>d.status!=='rejected'),...(state.journals||[]),...(state.bankRows||[]),...(state.bankStatements||[])]) {
    if (source.date && source.date>asOf || source.endDate && source.endDate>asOf) continue
    if (typeof source.currency==='string'&&/^[A-Z]{3}$/.test(source.currency)) currencies.add(source.currency)
  }
  for (const currency of [...currencies].sort()) {
    const ready=statementReadiness(state,asOf,currency)
    add(ready.opening,`opening-${currency}`,'Opening journal',`Verified opening journal exists for ${currency}.`,`No posted opening journal for ${currency}.`,currency)
    add(ready.unpostedSources===0,`sources-${currency}`,'GL posting coverage',`${ready.approvedSources} approved source(s) have journal coverage.`,`${ready.unpostedSources} approved source(s) have no posted journal.`,currency)
    const tb=trialBalance(state,asOf,currency),bs=balanceSheet(state,asOf,currency)
    add(tb.journalCount>0&&tb.debitTotal===tb.creditTotal&&bs.difference===0,`ledger-${currency}`,'Financial statement arithmetic',`${tb.journalCount} internally balanced journal(s).`,`Trial balance or balance-sheet equation is not ready.`,currency)
    for (const role of ['customer','supplier']) {
      const kinds=role==='customer'?['sales-invoice','sales-credit','customer-receipt','customer-refund']:['purchase-invoice','purchase-credit','supplier-payment','supplier-refund']
      const recorded=(state.documents||[]).some(d=>d.status==='approved'&&d.date<=asOf&&d.currency===currency&&kinds.includes(d.kind))
      const mapped=Boolean(state.controlAccounts?.[role])
      if (!recorded && !mapped) {
        checks.push(attention(`${role}-${currency}`,`${role==='customer'?'Receivable':'Payable'} control account`,'No mapped account and no approved activity; confirm whether this control schedule applies.',currency))
      } else {
        const result=controlReconciliation(state,role,asOf,currency)
        add(result.status==='balanced',`${role}-${currency}`,`${role==='customer'?'Receivable':'Payable'} control account`,`${role} operational balance matches mapped GL.`,`${role} status: ${result.status}; difference ${result.difference===null?'unknown':result.difference} minor units; ${result.unposted} unposted source(s).`,currency)
      }
    }
    const banks=bankReconciliations(state,asOf,currency)
    const bankAccounts=[...new Set([...banks.map(b=>b.account),...Object.keys(state.controlAccounts?.banks||{})])]
    for (const account of bankAccounts) {
      const batches=banks.filter(b=>b.account===account)
      const failures=batches.filter(b=>b.status!=='balanced')
      add(batches.length>0&&failures.length===0,`bank-${currency}-${account}`,`Bank reconciliation: ${account}`,`${batches.length} imported statement(s) reconcile to reviewed GL.`,batches.length?`${failures.length} statement(s) are not reconciled to GL.`:'No imported and reconciled bank statement.',currency)
    }
    const unreviewedCash=cashbook(state,asOf,currency).filter(row=>row.bankAccount&&!row.matched)
    add(unreviewedCash.length===0,`cash-${currency}`,'Cash movements vs bank', 'All recorded bank-linked cash movements through cutoff have matches.',`${unreviewedCash.length} bank-linked cash movement(s) have no reviewed match.`,currency)
    if (!banks.length && !bankAccounts.length) checks.push(attention(`bank-evidence-${currency}`,'Bank statement coverage', 'No bank statements or mapped bank accounts recorded; reviewer must verify whether any statement is missing.',currency))
  }
  checks.push(attention('adjustments','Adjustments and statutory obligations','Reviewer must separately assess accruals, depreciation, inventory, payroll, FX, tax/SST, cut-off and other applicable obligations. This app does not calculate or certify these.'))
  const blocking=checks.filter(c=>c.status==='block')
  return {asOf,baseCurrency,currencies:[...currencies].sort(),checks,blocking,ready:blocking.length===0,closedThrough:state.closedThrough||null}
}
