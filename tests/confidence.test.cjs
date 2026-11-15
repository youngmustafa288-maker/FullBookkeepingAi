const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = fs.readFileSync('src/lib/confidence.ts','utf8')
const compiled = ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020 }}).outputText
const moduleRef = { exports:{} }
Function('require','module','exports',compiled)(require,moduleRef,moduleRef.exports)
const { displayConfidence } = moduleRef.exports

test('SOP-CF-001 high/medium/low thresholds use the rounded display percentage', () => {
  assert.deepEqual(displayConfidence(0.9), { percentage:90, level:'High' })
  assert.deepEqual(displayConfidence(0.89), { percentage:89, level:'Medium' })
  assert.deepEqual(displayConfidence(0.7), { percentage:70, level:'Medium' })
  assert.deepEqual(displayConfidence(0.69), { percentage:69, level:'Low' })
  assert.deepEqual(displayConfidence(0), { percentage:0, level:'Low' })
  assert.deepEqual(displayConfidence(1), { percentage:100, level:'High' })
})
test('SOP-CF-001 never invents a confidence percentage', () => {
  for(const value of [null,undefined,NaN,Infinity,-0.01,1.1,'0.98',{},[]]) {
    assert.deepEqual(displayConfidence(value), {percentage:null,level:'Not provided'})
  }
})
