import {resolveActionReferences} from './cases.mjs'
import {prepareJournal} from './ledger.mjs'

/**
 * Preview journal proposals using the *same* ledger validation used at posting.
 * Proposed documents are represented as temporary approved sources, but nothing
 * is written to the ledger. References such as @0 may only point backward.
 * Other operational actions are deliberately NOT simulated or approved here.
 */
export function journalProposalIssues(state, actions, caseId, toMinor) {
  if (!Array.isArray(actions) || !actions.some(a => a.type === 'journal')) return []
  const preview = {
    contexts: state.contexts,
    documents: [...(state.documents || [])],
    journals: [...(state.journals || [])]
  }
  const issues = []
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    if (action.type === 'document') {
      // Only the document fields consulted by prepareJournal are staged.
      try {
        const p = action.payload || {}
        preview.documents.push({
          id: `${caseId}:action:${i}`, status: 'approved',
          date: p.date, currency: String(p.currency || 'MYR').toUpperCase(),
          amount: toMinor(p.amount)
        })
      } catch (error) {
        issues.push(`Document action ${i + 1}: ${error.message}`)
      }
    }
    if (action.type !== 'journal') continue
    try {
      const payload = resolveActionReferences(action.payload, caseId, i)
      if (payload.kind !== 'document') throw Error('AI cases may propose document journals only. Opening balances use the reviewed import.')
      const prepared = prepareJournal(preview, payload, toMinor)
      preview.journals.push({date:payload.date,...prepared})
    } catch (error) {
      issues.push(`Journal action ${i + 1}: ${error.message}`)
    }
  }
  return issues
}
