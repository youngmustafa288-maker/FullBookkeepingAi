import type { ReactNode } from 'react'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function ConfidenceBadge({ value }: { value: number }) {
  const tone = value > 90 ? 'success' : value >= 70 ? 'warning' : 'danger'
  return <Badge tone={tone}>{value}% confidence</Badge>
}
