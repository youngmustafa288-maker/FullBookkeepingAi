/**
 * Read-only financial reports built solely from internally approved journal lines.
 * All money is integer minor units; statement rows preserve signed contra balances.
 * An opening journal represents brought-forward balances, not period activity.
 */
const ACCOUNT_TYPES = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'])

const checkDate = (value, label) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw Error(`${label} must be a real date in YYYY-MM-DD format.`)
  }
}
const safeAdd = (a, b) => {
  const n = a + b
  if (!Number.isSafeInteger(n)) throw Error('Financial statement amount exceeds safe integer precision.')
  return n
}

function collect(state, currency, through, from = null) {
  const balances = new Map()
  let journalCount = 0
  const journals = state.journals || []
  for (const journal of journals) {
    if (journal.currency !== currency || journal.date > through || (from !== null && (journal.date < from || journal.kind === 'opening'))) continue
    if (!Array.isArray(journal.lines)) throw Error(`Journal ${journal.reference} has no valid lines.`)
    journalCount++
    for (const line of journal.lines) {
      if (!ACCOUNT_TYPES.has(line.type)) throw Error(`GL ${line.code} has an unsupported account type.`)
      if (!Number.isSafeInteger(line.debit) || !Number.isSafeInteger(line.credit) || line.debit < 0 || line.credit < 0) throw Error(`Journal ${journal.reference} has an invalid amount.`)
      const previous = balances.get(line.code) || {code:line.code,name:line.name,type:line.type,debit:0,credit:0}
      if (previous.type !== line.type) throw Error(`GL account ${line.code} has inconsistent accounting types.`)
      previous.debit = safeAdd(previous.debit, line.debit)
      previous.credit = safeAdd(previous.credit, line.credit)
      balances.set(line.code, previous)
    }
  }
  return {rows:[...balances.values()].sort((a,b)=>a.code.localeCompare(b.code)),journalCount}
}

/** Completeness warning, never a statutory certification. */
export function statementReadiness(state, asOf, currency) {
  checkDate(asOf, 'Reporting date')
  const journals = (state.journals || []).filter(j=>j.currency===currency&&j.date<=asOf)
  const posted = new Set(journals.map(j=>j.sourceDocumentId).filter(Boolean))
  const approvedSources = (state.documents || []).filter(d=>d.status==='approved'&&d.currency===currency&&d.date<=asOf)
  const missing = approvedSources.filter(d=>!posted.has(d.id))
  const opening = journals.some(j=>j.kind==='opening')
  return {currency,asOf,opening,postedJournals:journals.length,approvedSources:approvedSources.length,unpostedSources:missing.length,missingReferences:missing.map(d=>d.reference),completeForRecordedSources:opening&&missing.length===0&&journals.length>0}
}

/** Signed income account activity from reviewed DOCUMENT journals within an inclusive period. */
export function profitAndLoss(state, from, through, currency='MYR') {
  checkDate(from, 'Period start')
  checkDate(through, 'Period end')
  if (from>through) throw Error('Period start cannot be after the end date.')
  const {rows,journalCount} = collect(state,currency,through,from)
  const revenues = rows.filter(r=>r.type==='Revenue').map(r=>({...r,amount:safeAdd(r.credit,-r.debit)}))
  const expenses = rows.filter(r=>r.type==='Expense').map(r=>({...r,amount:safeAdd(r.debit,-r.credit)}))
  const total = (rs)=>rs.reduce((n,r)=>safeAdd(n,r.amount),0)
  const revenue = total(revenues),expense=total(expenses)
  return {currency,from,through,revenues,expenses,revenue,expense,netProfit:safeAdd(revenue,-expense),journalCount,readiness:statementReadiness(state,through,currency)}
}

/**
 * Cumulative balance sheet at a date. The unclosed P&L is presented once, not
 * added into equity accounts; it is deliberately NOT the selected-period profit.
 */
export function balanceSheet(state,asOf,currency='MYR') {
  checkDate(asOf,'Balance sheet date')
  const {rows,journalCount}=collect(state,currency,asOf)
  const normal = (row)=>({...row,balance:row.type==='Asset'?safeAdd(row.debit,-row.credit):safeAdd(row.credit,-row.debit)})
  const assets=rows.filter(r=>r.type==='Asset').map(normal)
  const liabilities=rows.filter(r=>r.type==='Liability').map(normal)
  const equity=rows.filter(r=>r.type==='Equity').map(normal)
  const total = (rs)=>rs.reduce((n,r)=>safeAdd(n,r.balance),0)
  const totalAssets=total(assets),totalLiabilities=total(liabilities),postedEquity=total(equity)
  const revenue=rows.filter(r=>r.type==='Revenue').reduce((n,r)=>safeAdd(n,safeAdd(r.credit,-r.debit)),0)
  const expense=rows.filter(r=>r.type==='Expense').reduce((n,r)=>safeAdd(n,safeAdd(r.debit,-r.credit)),0)
  const unclosedEarnings=safeAdd(revenue,-expense)
  const totalEquity=safeAdd(postedEquity,unclosedEarnings)
  const totalLiabilitiesAndEquity=safeAdd(totalLiabilities,totalEquity)
  const difference=safeAdd(totalAssets,-totalLiabilitiesAndEquity)
  return {currency,asOf,assets,liabilities,equity,totalAssets,totalLiabilities,postedEquity,unclosedEarnings,totalEquity,totalLiabilitiesAndEquity,difference,balanced:difference===0,journalCount,readiness:statementReadiness(state,asOf,currency)}
}

/** Flat, source-traceable journal export; evidence URIs are intentionally omitted. */
export function generalLedgerDetail(state, asOf, currency='MYR') {
  checkDate(asOf,'Reporting date')
  return (state.journals||[]).filter(j=>j.currency===currency&&j.date<=asOf).flatMap(j=>j.lines.map((line,index)=>({date:j.date,journal:j.reference,kind:j.kind,sourceDocumentId:j.sourceDocumentId||'',description:j.description||'',line:index+1,accountCode:line.code,accountName:line.name,accountType:line.type,currency,debit:line.debit,credit:line.credit}))).sort((a,b)=>a.date.localeCompare(b.date)||a.journal.localeCompare(b.journal)||a.line-b.line)
}
