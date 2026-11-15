import { CheckCircle2 } from 'lucide-react'

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__mark"><CheckCircle2 size={28} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
