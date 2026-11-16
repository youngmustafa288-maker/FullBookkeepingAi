/**
 * Fail closed on a database read error. An empty result is only legitimate when
 * the query itself succeeded; do not display missing data as empty books.
 */
export function requireSuccessfulRead(result, label) {
  if (!result || result.error) {
    const error = new Error(`Could not load ${label}. Your saved bookkeeping records were not changed. Please retry.`)
    error.status = 503
    throw error
  }
  if (result.data != null && !Array.isArray(result.data)) {
    const error = new Error(`Invalid ${label} response from the database. Please retry.`)
    error.status = 503
    throw error
  }
  return result.data || []
}

/**
 * A missing workspace row is a legitimate brand-new company. A returned row
 * with a null, corrupt, or incompatible state is NOT a new company and must
 * never be replaced with empty books.
 */
export function requireWorkspaceState(row, createEmptyState) {
  if (row == null) return createEmptyState()
  const state = row.state
  const valid = state && typeof state === 'object' && !Array.isArray(state) &&
    state.version === 1 && Number.isSafeInteger(state.revision) && state.revision >= 0 &&
    Array.isArray(state.audit) && Array.isArray(state.documents) &&
    Array.isArray(state.cases) && Array.isArray(state.allocations) &&
    state.contexts && typeof state.contexts === 'object' && !Array.isArray(state.contexts)
  if (!valid) {
    const error = new Error('Saved workspace could not be validated. Your records were not changed. Please contact support before retrying.')
    error.status = 503
    throw error
  }
  return state
}
