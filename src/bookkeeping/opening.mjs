/**
 * Deterministic, client-side opening trial-balance import.
 * The original file must be retained outside the app: import stores only a
 * reviewed opening journal, source filename and optional SHA-256 checksum.
 * No values are inferred by AI.
 */
const clean = value => String(value ?? '').replace(/^\uFEFF/, '').trim()
const headerKey = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
const codeLabels = new Set(['code','glcode','glaccount','accountcode','accountnumber','accountno'])
const debitLabels = new Set(['debit','dr','debitmyr','drmyr','debitamount'])
const creditLabels = new Set(['credit','cr','creditmyr','crmyr','creditamount'])
const currencyLabels = new Set(['currency','ccy'])
const kind = (v, labels) => labels.has(headerKey(v))

/** Decode RFC-style quoted CSV (also accepts semicolon-separated files). */
export function csvGrid(text) {
 if (typeof text !== 'string' || !text.trim() || text.length > 3_000_000) throw Error('Choose a non-empty CSV file below 3 MB.')
 const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/).slice(0, 15).find(row => row.includes(',') || row.includes(';')) || ''
 const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','
 const grid = []; let row = [], cell = '', inQuote = false, atStart = true
 const finishRow = () => { row.push(cell); if (row.some(v => v.trim())) grid.push(row); row = []; cell = ''; atStart = true; if (grid.length > 1500) throw Error('Opening trial balance has too many rows (maximum 1,500).') }
 for (let i = 0; i < text.length; i++) {
  const ch = text[i]
  if (inQuote) {
   if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
   else if (ch === '"') inQuote = false
   else cell += ch
  } else if (ch === '"' && atStart) { inQuote = true; atStart = false }
  else if (ch === delimiter) { row.push(cell); cell = ''; atStart = true }
  else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; finishRow() }
  else { if (ch === '"') throw Error('Invalid CSV: unexpected quote.'); cell += ch; atStart = false }
 }
 if (inQuote) throw Error('Invalid CSV: unfinished quoted cell.')
 if (cell.length || row.length) finishRow()
 return grid
}

function moneyCell(value, toMinor, label, rowNum) {
 const raw = clean(value)
 if (!raw || raw === '-' || raw === '—') return 0
 if (/^[+\-(]/.test(raw)) throw Error(`Row ${rowNum}: ${label} must be non-negative (use the correct debit or credit column).`)
 const formatted = raw.replace(/,/g, '')
 try { return toMinor(formatted) } catch { throw Error(`Row ${rowNum}: invalid ${label} amount "${raw}" (maximum two decimal places).`) }
}

/** Build verified proposed journal lines from an imported CSV or XLSX grid. */
export function reviewOpeningGrid(grid, chart, currency, toMinor) {
 if (!Array.isArray(grid) || !grid.length || grid.length > 1500) throw Error('The trial balance table is empty or too large.')
 if (!(chart instanceof Map) || !chart.size) throw Error('Approve the structured chart of accounts before importing opening balances.')
 if (!/^[A-Z]{3}$/.test(currency)) throw Error('Use a three-letter currency code.')
 const headerIndex = grid.findIndex((r,i) => i < 15 && Array.isArray(r) && r.some(v => kind(v,codeLabels)) && r.some(v => kind(v,debitLabels)) && r.some(v => kind(v,creditLabels)))
 if (headerIndex < 0) throw Error('Required columns: Code, Debit, Credit (optional Currency). Export the opening trial balance using this layout.')
 const header = grid[headerIndex], index = labels => header.findIndex(value => kind(value, labels))
 const codeI = index(codeLabels), debitI = index(debitLabels), creditI = index(creditLabels), currencyI = index(currencyLabels)
 if (new Set([codeI,debitI,creditI]).size !== 3) throw Error('Opening trial balance has ambiguous column headings.')
 const seen = new Set(), lines = []; let debitTotal = 0, creditTotal = 0, totalsRow = null
 for (let i = headerIndex + 1; i < grid.length; i++) {
  const record = grid[i]
  if (!Array.isArray(record) || record.every(v => !clean(v))) continue
  const rowNum = i + 1, code = clean(record[codeI])
  if (!code && record.every(v => !clean(v))) continue
  if (/^(grand\s*)?totals?$/i.test(code)) {
   if (totalsRow) throw Error('Multiple total rows in the imported file.')
   totalsRow = {debit: moneyCell(record[debitI],toMinor,'total debit',rowNum), credit:moneyCell(record[creditI],toMinor,'total credit',rowNum)}
   continue
  }
  if (!code) throw Error(`Row ${rowNum}: GL account code is missing.`)
  if (seen.has(code)) throw Error(`Row ${rowNum}: duplicate GL account ${code}. Consolidate it in the source trial balance.`)
  seen.add(code)
  const account = chart.get(code)
  if (!account || !account.active) throw Error(`Row ${rowNum}: ${code} is not an active account in the saved chart.`)
  const rowCurrency = currencyI >= 0 ? clean(record[currencyI]).toUpperCase() : ''
  if (rowCurrency && rowCurrency !== currency) throw Error(`Row ${rowNum}: currency ${rowCurrency} differs from selected ${currency}. Import currencies separately.`)
  const debit = moneyCell(record[debitI],toMinor,'debit',rowNum)
  const credit = moneyCell(record[creditI],toMinor,'credit',rowNum)
  if (!debit && !credit) continue
  if (debit && credit) throw Error(`Row ${rowNum}: account ${code} has both a debit and a credit.`)
  lines.push({code, debit: (debit/100).toFixed(2), credit:(credit/100).toFixed(2)})
  debitTotal += debit; creditTotal += credit
  if (![debitTotal,creditTotal].every(Number.isSafeInteger)) throw Error('Opening total is too large.')
  if (lines.length > 100) throw Error('Opening journal exceeds 100 non-zero accounts. Prepare separately reviewed evidence or adjust the import design before posting.')
 }
 if (lines.length < 2) throw Error('Opening balances need at least two non-zero accounts.')
 if (totalsRow && (totalsRow.debit !== debitTotal || totalsRow.credit !== creditTotal)) throw Error('Imported total row does not match the sum of account balances.')
 if (debitTotal !== creditTotal) throw Error(`Opening trial balance is unbalanced: debit ${(debitTotal/100).toFixed(2)} versus credit ${(creditTotal/100).toFixed(2)}.`)
 return {lines, debitTotal, creditTotal, count:lines.length}
}
