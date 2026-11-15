/** A short, reviewable account of evidence and rules — NOT model chain-of-thought. */
import type { Context, ExtractedFields } from './engine'

export type DecisionExplanation = {
  version: 1
  ai_summary: string
  ai_evidence: string[]
  verified_rules: string[]
  deterministic_checks: string[]
  uncertainties: string[]
}
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : ''
}
function cleanList(value: unknown, maxItems: number): string[] {
  return Array.isArray(value) ? value.map(item => clean(item, 220)).filter(Boolean).slice(0, maxItems) : []
}
/** Only facts checked independently of the AI appear under verified_rules or deterministic_checks. */
export function buildDecisionExplanation(
  fields: ExtractedFields,
  context: Context,
  validationIssues: string[],
  modelExplanation: unknown,
): DecisionExplanation {
  const input = modelExplanation && typeof modelExplanation === 'object' && !Array.isArray(modelExplanation)
    ? modelExplanation as Record<string, unknown> : {}
  const vendorRule = context.vendorRules.find(rule => fields.vendor &&
    fields.vendor.toLowerCase().includes(rule.vendor_pattern.toLowerCase()))
  const gl = context.glCodes.find(code => code.code === fields.gl_code)
  const verified_rules: string[] = []
  if (gl) verified_rules.push(`Suggested GL ${gl.code} is present in this company's active chart of accounts (${gl.name}).`)
  else verified_rules.push('Suggested GL code has not been verified against the active chart of accounts.')
  if (vendorRule) {
    verified_rules.push(`Approved vendor rule "${vendorRule.vendor_pattern}" specifies default GL ${vendorRule.gl_code} (${vendorRule.default_category}).${fields.gl_code === vendorRule.gl_code ? ' The suggestion agrees with this rule.' : ' The suggestion differs from this rule.'}`)
  } else verified_rules.push('No approved vendor rule matched the extracted vendor name.')
  if (fields.amount !== null && fields.subtotal !== null && fields.tax_amount !== null &&
    Math.abs(fields.subtotal + fields.tax_amount - fields.amount) <= 0.02) {
    verified_rules.push('Extracted subtotal plus tax agrees with the extracted total within 0.02 currency-unit tolerance.')
  }
  const uncertainties = cleanList(input.uncertainties, 5)
  if (!vendorRule) uncertainties.push('Vendor classification needs manual verification against the original document.')
  if (validationIssues.length) uncertainties.push('Resolve all deterministic validation warnings before approving.')
  return {
    version: 1,
    ai_summary: clean(input.summary, 500) || 'AI suggested these accounting fields based on the extracted document and configured client context. No additional explanation was supplied.',
    ai_evidence: cleanList(input.evidence, 5),
    verified_rules,
    deterministic_checks: validationIssues.slice(0, 20).map(x => clean(x, 300)),
    uncertainties: [...new Set(uncertainties)].slice(0, 8),
  }
}
