const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Compile isolated TypeScript helpers to validate their behavior without calling AI or Supabase.
function load(file, mockAuth = false) {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  if (mockAuth) source = source.replace("import { ApiError } from './auth'", 'class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports
}
const { toFields, parseJson, validateFields, verifyImage } = load('server/engine.ts', true)
const { csvCell } = load('server/csv.ts')
const context = {
  company: { name: 'Example Co', currency: 'MYR', tax_regime: 'unknown' },
  glCodes: [{ code: '6300', name: 'Office expenses', account_type: 'Expense' }],
  vendorRules: [{ vendor_pattern: 'OfficePro', gl_code: '6300', default_category: 'Office', tax_code: 'N/A' }],
  policies: [],
}
const valid = { vendor: 'OfficePro KL', reference: 'INV-012', date: '2026-11-14', amount: 112, subtotal: 100, tax_amount: 12, currency: 'MYR', gl_code: '6300', category: 'Office', tax_code: '', description: 'Pens' }

test('JSON OCR/model extraction can parse fenced JSON but fails closed for non-JSON', () => {
  assert.equal(parseJson('```json\n{"a":5}\n```').a, 5)
  assert.throws(() => parseJson('there is no json'))
})
test('missing values stay null instead of fabricated numbers', () => {
  const result = toFields({ vendor: 'Vendor A', amount: null })
  assert.equal(result.amount, null)
  assert.equal(result.date, '')
})
test('valid approved mapping and balanced totals produce no deterministic issues', () => {
  assert.deepEqual(validateFields(valid, context), [])
})
test('invalid date, GL, currency, and arithmetic are detected independently', () => {
  const messages = validateFields({ ...valid, date: '2026-02-30', gl_code: '9999', currency: 'USD', amount: 125 }, context)
  assert(messages.some(m => m.includes('Date')))
  assert(messages.some(m => m.includes('GL code')))
  assert(messages.some(m => m.includes('Currency')))
  assert(messages.some(m => m.includes('Subtotal')))
})
test('approved vendor GL conflict is flagged, not silently learned', () => {
  const messages = validateFields({ ...valid, gl_code: '6400' }, { ...context, glCodes: [...context.glCodes, { code: '6400', name: 'Other', account_type: 'Expense' }] })
  assert(messages.some(m => m.includes('differs from approved vendor')))
})
test('file signature check rejects PDF masquerading as an image', () => {
  assert.throws(() => verifyImage(Buffer.from('%PDF-1.5'), 'image/png'))
  assert.equal(verifyImage(Buffer.from([137,80,78,71,13,10,26,10,0]), 'image/png'), 'image/png')
})
test('CSV escapes dangerous leading formula characters and quotes', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"')
  assert.equal(csvCell('Safe, Vendor'), '"Safe, Vendor"')
  assert.equal(csvCell(-120.5), '"-120.5"')
})
