/**
 * Internal, company-scoped bookkeeping ledger controls.
 * The GL chart is the reviewed Markdown stored in contexts.glCodes.
 * All journal values are integer minor units; no floating-point money.
 */
const accountTypes = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'])
const activeFlags = new Set(['yes', 'true', 'active', '1'])

export function parseChart(markdown = '') {
  const accounts = new Map()
  if (typeof markdown !== 'string') return accounts
  for (const row of markdown.split(/\r?\n/)) {
    if (!row.trim().startsWith('|')) continue
    const cols = row.split('|').slice(1, -1).map(cell => cell.trim())
    if (cols.length < 4) continue
    const [code, name, rawType, rawActive] = cols
    const type = [...accountTypes].find(t => t.toLowerCase() === rawType.toLowerCase())
    if (!type || !/^[a-z\d][\w.-]{1,29}$/i.test(code) || !name) continue
    const active = activeFlags.has(rawActive.toLowerCase())
    if (accounts.has(code)) throw Error(`Duplicate GL account code ${code} in the approved chart.`)
    accounts.set(code, { code, name, type, active })
  }
  return accounts
}

function nonEmpty(value, label, limit = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw Error(`${label} is required (maximum ${limit} characters).`)
  return value.trim()
}

/** Validate and normalize an approved journal. Throws before any state mutation. */
export function prepareJournal(state, payload, toMinor) {
  const chart = parseChart(state.contexts?.glCodes)
  if (!chart.size) throw Error('Approve a structured chart of accounts (Code | Name | Type | Active) before posting journals.')
  const reference = nonEmpty(payload.reference, 'Journal reference')
  const evidence = nonEmpty(payload.evidence, 'Journal evidence', 2000)
  const currency = String(payload.currency || 'MYR').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw Error('Use a three-letter journal currency code.')
  const kind = payload.kind || 'document'
  if (!['document', 'opening'].includes(kind)) throw Error('Unsupported journal kind.')
  if (!Array.isArray(payload.lines) || payload.lines.length < 2 || payload.lines.length > 100) throw Error('A journal requires 2–100 debit/credit lines.')
  const lines = payload.lines.map((line, index) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) throw Error(`Invalid journal line ${index + 1}.`)
    const code = nonEmpty(line.code, 'GL account code', 30)
    const account = chart.get(code)
    if (!account || !account.active) throw Error(`GL code ${code} is not an active approved account.`)
    const debit = toMinor(line.debit ?? '0'), credit = toMinor(line.credit ?? '0')
    if ((debit > 0) === (credit > 0)) throw Error(`Journal line ${index + 1} must have either a positive debit or a positive credit.`)
    return { code, name: account.name, type: account.type, debit, credit }
  })
  const debits = lines.reduce((total, line) => total + line.debit, 0)
  const credits = lines.reduce((total, line) => total + line.credit, 0)
  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits) || debits !== credits) throw Error('Journal debits and credits must balance exactly in minor units.')
  const journals = state.journals || []
  if (journals.some(j => j.currency === currency && j.reference.toLowerCase() === reference.toLowerCase())) throw Error('Duplicate journal reference in this currency.')
  let sourceDocumentId = null
  if (kind === 'document') {
    sourceDocumentId = nonEmpty(payload.sourceDocumentId, 'Approved source document ID')
    const document = state.documents.find(d => d.id === sourceDocumentId && d.status === 'approved')
    if (!document) throw Error('Post only from an approved source document.')
    if (document.currency !== currency) throw Error('Journal currency must match the approved source document.')
    if (document.date !== payload.date) throw Error('Journal date must match the approved source document date.')
    if (document.amount !== debits) throw Error('Journal total must equal the approved source document amount.')
    if (journals.some(j => j.sourceDocumentId === sourceDocumentId)) throw Error('Source document already has a posted journal.')
  } else {
    if (payload.sourceDocumentId) throw Error('Opening journals cannot be linked to transaction documents.')
    if (journals.some(j => j.kind === 'opening' && j.currency === currency)) throw Error('An opening journal already exists for this currency.')
    const dates = [...journals.filter(j => j.currency === currency).map(j => j.date), ...state.documents.filter(d => d.status === 'approved' && d.currency === currency).map(d => d.date)]
    if (dates.length && dates.some(d => d < payload.date)) throw Error('Opening balances must be dated no later than existing approved transactions or journals in this currency.')
  }
  return { reference, currency, kind, sourceDocumentId, evidence, description: String(payload.description || '').slice(0, 1000), lines, debitTotal: debits, creditTotal: credits }
}

/** A balanced trial balance built exclusively from approved internal journals. */
export function trialBalance(state, asOf = '9999-12-31', currency = 'MYR') {
  const balances = new Map()
  for (const journal of state.journals || []) {
    if (journal.currency !== currency || journal.date > asOf) continue
    for (const line of journal.lines) {
      const existing = balances.get(line.code) || { code: line.code, name: line.name, type: line.type, net: 0 }
      if (existing.type !== line.type) throw Error(`GL account ${line.code} has inconsistent accounting types.`)
      existing.net += line.debit - line.credit
      if (!Number.isSafeInteger(existing.net)) throw Error('Account balance exceeds safe integer precision.')
      balances.set(line.code, existing)
    }
  }
  const rows = [...balances.values()].sort((a, b) => a.code.localeCompare(b.code)).map(a => ({ code: a.code, name: a.name, type: a.type, debit: Math.max(0, a.net), credit: Math.max(0, -a.net) }))
  const debitTotal = rows.reduce((total, row) => total + row.debit, 0)
  const creditTotal = rows.reduce((total, row) => total + row.credit, 0)
  if (debitTotal !== creditTotal) throw Error('Internal journal trial balance is out of balance.')
  return { currency, asOf, rows, debitTotal, creditTotal, journalCount: (state.journals || []).filter(j => j.currency === currency && j.date <= asOf).length }
}
