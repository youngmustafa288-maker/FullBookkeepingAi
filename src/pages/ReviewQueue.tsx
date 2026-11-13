import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpDown, Check, Clock3, FileText, Landmark, ReceiptText, WalletCards } from 'lucide-react'
import { clients } from '../data/mockData'
import { useApp } from '../context/AppContext'
import { money, mytDate, relativeQueueAge } from '../lib/format'
import type { ReviewItem } from '../types'
import { ConfidenceBadge } from '../components/Badge'
import { ReviewDrawer } from '../components/ReviewDrawer'
import { EmptyState } from '../components/EmptyState'

const workflowIcons = { receipt: ReceiptText, invoice: WalletCards, 'bank-reconciliation': Landmark }

export function ReviewQueue() {
  const { activeClientId, reviews, approveReview, rejectReview } = useApp()
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [sort, setSort] = useState('oldest')
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const activeClient = clients.find((client) => client.id === activeClientId)!
  const visible = useMemo(() => {
    const filtered = reviews.filter((item) => item.clientId === activeClientId && (workflowFilter === 'all' || item.workflow === workflowFilter))
    return [...filtered].sort((a, b) => sort === 'confidence' ? a.confidence - b.confidence : sort === 'amount' ? b.amount - a.amount : new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime())
  }, [reviews, activeClientId, workflowFilter, sort])

  return (
    <div className="page-stack review-page">
      <section className="page-intro page-intro--compact"><div><span className="eyebrow">Client review queue</span><h2>{visible.length} items need a decision</h2><p>Showing only {activeClient.name}. High-confidence, warning-free items can be approved here.</p></div><div className="scope-pill"><span className="client-avatar" style={{ background: activeClient.color }}>{activeClient.shortName}</span><span><strong>{activeClient.name}</strong><small>Current client only</small></span></div></section>
      <div className="queue-toolbar">
        <label><span>Workflow</span><select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)}><option value="all">All workflows</option><option value="receipt">Receipt</option><option value="invoice">Invoice</option><option value="bank-reconciliation">Bank reconciliation</option></select></label>
        <label><span><ArrowUpDown size={13} />Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="oldest">Oldest first</option><option value="confidence">Lowest confidence</option><option value="amount">Highest amount</option></select></label>
      </div>
      {visible.length ? <div className="queue-list">{visible.map((item) => {
        const Icon = workflowIcons[item.workflow]
        const canQuickApprove = item.confidence > 90 && !item.warning && !item.exception
        const ageHours = (Date.now() - new Date(item.queuedAt).getTime()) / 3_600_000
        return (
          <article className="queue-card" key={item.id}>
            <div className="queue-card__document"><span className="queue-card__icon"><Icon size={18} /></span><div><span>{item.workflow.replace('-', ' ')}</span><strong>{item.party}</strong><small><FileText size={12} />{item.reference} · {mytDate(item.date)}</small></div></div>
            <div className="queue-card__amount"><span>Proposed amount</span><strong>{money(item.amount)}</strong>{item.warning && <small><AlertTriangle size={13} />Warning attached</small>}</div>
            <div className="queue-card__confidence"><ConfidenceBadge value={item.confidence} /><span className={ageHours > 72 ? 'age age--danger' : ageHours > 24 ? 'age age--warning' : 'age'}><Clock3 size={13} />{relativeQueueAge(item.queuedAt)}</span></div>
            <div className="queue-card__actions"><button className="button button--ghost" onClick={() => setSelected(item)}>Full review</button>{canQuickApprove ? <button className="button button--primary" onClick={() => approveReview(item.id)}><Check size={16} />Approve</button> : <button className="button button--disabled" disabled>Full review required</button>}</div>
          </article>
        )
      })}</div> : <EmptyState title="All caught up" description={`No items are pending approval for ${activeClient.name}.`} />}
      <ReviewDrawer item={selected} onClose={() => setSelected(null)} onApprove={approveReview} onReject={rejectReview} />
    </div>
  )
}
