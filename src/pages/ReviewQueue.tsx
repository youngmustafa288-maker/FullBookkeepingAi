import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpDown, Check, Clock3, Download, FileText, Fuel, Landmark, PackageOpen, ReceiptText, WalletCards } from 'lucide-react'

import { useApp } from '../context/AppContext'
import { money, mytDate, relativeQueueAge } from '../lib/format'
import type { ReviewItem } from '../types'
import { ConfidenceBadge } from '../components/Badge'
import { ReviewDrawer } from '../components/ReviewDrawer'
import { EmptyState } from '../components/EmptyState'

function documentIcon(item: ReviewItem) {
  if (item.workflow === 'bank-reconciliation') return Landmark
  if (/shell|petronas|fuel|diesel/i.test(item.party)) return Fuel
  if (/office|stationery|supplies/i.test(item.party)) return PackageOpen
  return item.workflow === 'invoice' ? WalletCards : ReceiptText
}

export function ReviewQueue() {
  const { clients, activeClientId, reviews, approveReview, rejectReview } = useApp()
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [sort, setSort] = useState('oldest')
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const activeClient = clients.find((client) => client.id === activeClientId)!
  
  const visible = useMemo(() => {
    const filtered = reviews.filter((item) => item.clientId === activeClientId && (workflowFilter === 'all' || item.workflow === workflowFilter))
    return [...filtered].sort((a, b) => sort === 'confidence' ? (a.confidence ?? -1) - (b.confidence ?? -1) : sort === 'amount' ? b.amount - a.amount : new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime())
  }, [reviews, activeClientId, workflowFilter, sort])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleExportExcel = () => {
    // Create CSV content
    const headers = ['Workflow', 'Party', 'Reference', 'Date', 'Amount', 'Confidence', 'Queued', 'Warning']
    const rows = visible.map(item => [
      item.workflow.replace('-', ' '),
      item.party,
      item.reference,
      mytDate(item.date),
      item.amount.toFixed(2),
      item.confidence===null?'Unavailable':`${item.confidence}%`,
      relativeQueueAge(item.queuedAt),
      item.warning || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    // Download as CSV (Excel compatible)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `review-queue-${activeClient.shortName}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="page-stack review-page">
      <section className="page-intro page-intro--compact">
        <div>
          <span className="eyebrow">Review queue</span>
          <h2>{visible.length} items need review</h2>
          <p>Review and approve extracted data for {activeClient.name}. Changes remain pending until approval.</p>
        </div>
        <div className="scope-pill">
          <span className="client-avatar" style={{ background: activeClient.color }}>{activeClient.shortName}</span>
          <span>
            <strong>{activeClient.name}</strong>
            <small>Viewed: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
          </span>
        </div>
      </section>
      
      <div className="queue-toolbar">
        <label>
          <span>Workflow</span>
          <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)}>
            <option value="all">All workflows</option>
            <option value="receipt">Receipts / SST review</option>
            <option value="invoice">Invoices / monthly accounts</option>
            <option value="bank-reconciliation">Bank Reconciliation</option>
          </select>
        </label>
        <label>
          <span><ArrowUpDown size={13} />Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="oldest">Oldest first</option>
            <option value="confidence">Lowest confidence</option>
            <option value="amount">Highest amount</option>
          </select>
        </label>
        <div className="queue-toolbar__actions">
          <button className="button button--secondary" onClick={handleExportExcel} title="Export to Excel">
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {visible.length ? (
        <div className="queue-list">
          {visible.map((item) => {
            const DocumentIcon = documentIcon(item)
            const canQuickApprove = (item.confidence ?? 0) > 90 && !item.warning && !item.exception && !item.actions?.some(action=>action.type==='journal')
            const ageHours = (Date.now() - new Date(item.queuedAt).getTime()) / 3_600_000
            return (
              <article className="queue-card" key={item.id}>
                <div className="queue-card__document">
                  <span className="queue-card__icon" aria-label={`${item.party} document type`}><DocumentIcon size={17} strokeWidth={1.8} /></span>
                  <div>
                    <span>{item.workflow === 'receipt' ? 'SST' : item.workflow === 'invoice' ? 'Monthly' : 'Bank'}</span>
                    <strong>{item.party}</strong>
                    <small><FileText size={12} />{item.reference} · {mytDate(item.date)}</small>
                  </div>
                </div>
                <div className="queue-card__amount">
                  <span>Amount</span>
                  <strong>{money(item.amount)}</strong>
                  {item.warning && <small><AlertTriangle size={13} />{item.warning}</small>}
                </div>
                <div className="queue-card__confidence">
                  <ConfidenceBadge value={item.confidence} />
                  <span className={ageHours > 72 ? 'age age--danger' : ageHours > 24 ? 'age age--warning' : 'age'}>
                    <Clock3 size={13} />{relativeQueueAge(item.queuedAt)}
                  </span>
                </div>
                <div className="queue-card__actions">
                  <button className="button button--ghost" onClick={() => setSelected(item)}>Review</button>
                  {canQuickApprove ? (
                    <button className="button button--primary" onClick={() => void approveReview(item.id).catch(()=>{})}>
                      <Check size={16} />Approve
                    </button>
                  ) : (
                    <button className="button button--disabled" disabled>Review required</button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState 
          title="All caught up" 
          description={`No items are pending review for ${activeClient.name}.`} 
        />
      )}
      
      <ReviewDrawer 
        item={selected} 
        onClose={() => setSelected(null)} 
        onApprove={approveReview} 
        onReject={rejectReview} 
      />
    </div>
  )
}
