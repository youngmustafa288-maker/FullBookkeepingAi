/** SOP-CF-001: simple display only; score is NOT empirically calibrated accuracy. */
export function displayConfidence(value: unknown): { percentage: number | null; level: 'High' | 'Medium' | 'Low' | 'Not provided' } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    return { percentage: null, level: 'Not provided' }
  }
  const percentage = Math.round(value * 100)
  return { percentage, level: percentage >= 90 ? 'High' : percentage >= 70 ? 'Medium' : 'Low' }
}
