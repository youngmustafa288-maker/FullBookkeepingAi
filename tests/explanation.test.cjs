const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname,'..','server','explanation.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const mod = { exports: {} }
Function('require','module','exports',compiled)(require,mod,mod.exports)
const { buildDecisionExplanation } = mod.exports
const fields = { vendor:'FuelCo', gl_code:'6001', amount:108, subtotal:100, tax_amount:8 }
const ctx = { company: {name:'Test',currency:'MYR'}, glCodes: [{code:'6001',name:'Vehicle Fuel'}], vendorRules: [{ vendor_pattern:'FuelCo', gl_code:'6001',default_category:'Fuel',tax_code:'N/A'}], policies:[] }
test('company-approved mapping and arithmetic are documented separately from unverified model evidence',()=>{
  const result=buildDecisionExplanation(fields,ctx,[],{summary:'Fuel suggested from vendor mapping',evidence:['Invoice says diesel'],uncertainties:[]})
  assert.match(result.verified_rules.join(' '),/approved vendor rule/i)
  assert.match(result.verified_rules.join(' '),/agrees with this rule/i)
  assert.match(result.verified_rules.join(' '),/subtotal plus tax/i)
  assert.deepEqual(result.ai_evidence,['Invoice says diesel'])
  assert.equal(result.deterministic_checks.length,0)
})
test('AI text cannot erase a client rule conflict or deterministic warnings',()=>{
  const result=buildDecisionExplanation({...fields,gl_code:'9999'},ctx,['GL code not active'],{summary:'All verified', evidence:[], uncertainties:[]})
  assert.match(result.verified_rules.join(' '),/differs from this rule/i)
  assert.match(result.verified_rules.join(' '),/not been verified/i)
  assert(result.uncertainties.some(x=>x.includes('validation warnings')))
})
test('missing AI explanation is explicitly identified and oversized text is bounded',()=>{
  const result=buildDecisionExplanation(fields,ctx,[],{summary:'x'.repeat(1000),evidence:Array(20).fill('a'.repeat(400)),uncertainties:[]})
  assert.equal(result.ai_summary.length,500)
  assert.equal(result.ai_evidence.length,5)
  assert.equal(result.ai_evidence[0].length,220)
  const missing=buildDecisionExplanation(fields,ctx,[],null)
  assert.match(missing.ai_summary,/No additional explanation/)
})
