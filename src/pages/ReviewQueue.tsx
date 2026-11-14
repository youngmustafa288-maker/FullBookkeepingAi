import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpDown, Check, Clock3, Download, FileText, Landmark, ReceiptText, RefreshCw, WalletCards } from 'lucide-react'
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
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const activeClient = clients.find((client) => client.id === activeClientId)!
  
  const visible = useMemo(() => {
    const filtered = reviews.filter((item) => item.clientId === activeClientId && (workflowFilter === 'all' || item.workflow === workflowFilter))
    return [...filtered].sort((a, b) => sort === 'confidence' ? a.confidence - b.confidence : sort === 'amount' ? b.amount - a.amount : new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime())
  }, [reviews, activeClientId, workflowFilter, sort])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setLastRefresh(new Date())
  }

  const handleExportExcel = () => {
    // Create CSV content
    const headers = ['Workflow', 'Party', 'Reference', 'Date', 'Amount', 'Confidence', 'Queued', 'Warning']
    const rows = visible.map(item => [
      item.workflow.replace('-', ' '),
      item.party,
      item.reference,
      mytDate(item.date),
      item.amount.toFixed(2),
      `${item.confidence}%`,
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
          <p>Review and approve extracted data for {activeClient.name}. Auto-refreshes every 30 seconds.</p>
        </div>
        <div className="scope-pill">
          <span className="client-avatar" style={{ background: activeClient.color }}>{activeClient.shortName}</span>
          <span>
            <strong>{activeClient.name}</strong>
            <small>Last updated: {lastRefresh.toLocaleTimeString()}</small>
          </span>
        </div>
      </section>
      
      <div className="queue-toolbar">
        <label>
          <span>Workflow</span>
          <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)}>
            <option value="all">All workflows</option>
            <option value="receipt">SST Accounting</option>
            <option value="invoice">Monthly Accounts</option>
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
          <button className="button button--ghost" onClick={handleRefresh} title="Refresh">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="button button--secondary" onClick={handleExportExcel} title="Export to Excel">
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {visible.length ? (
        <div className="queue-list">
          {visible.map((item) => {
            const Icon = workflowIcons[item.workflow]
            const canQuickApprove = item.confidence > 90 && !item.warning && !item.exception
            const ageHours = (Date.now() - new Date(item.queuedAt).getTime()) / 3_600_000
            return (
              <article className="queue-card" key={item.id}>
                <div className="queue-card__document">
                  <span className="queue-card__icon"><Icon size={18} /></span>
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
                    <button className="button button--primary" onClick={() => approveReview(item.id)}>
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
