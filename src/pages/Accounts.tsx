import { useMemo, useState } from 'react'
import { ArrowDownUp, Download, Eye, MoreHorizontal, Search, SlidersHorizontal } from 'lucide-react'

import { useApp } from '../context/AppContext'
import { downloadCsv, money, mytDate } from '../lib/format'
import type { LedgerRecord } from '../types'
import { Badge } from '../components/Badge'
import { ReviewDrawer } from '../components/ReviewDrawer'

const filters = ['All', 'Purchase Invoices', 'Sales Invoices', 'Receipts', 'Bank Recon', 'Overdue']

function statusTone(status: LedgerRecord['status']) {
  if (status === 'Paid') return 'success'
  if (status === 'Overdue') return 'danger'
  if (status === 'Reconciled') return 'info'
  if (status === 'Pending') return 'warning'
  return 'neutral'
}

export function Accounts() {
  const { clients, activeClientId, records, reviews, recordDetails, approveReview, rejectReview } = useApp()
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedReference, setSelectedReference] = useState<string | null>(null)
  const selectedReview = recordDetails.find((item) => item.clientId === activeClientId && item.id === selectedReference) ?? null
  const client = clients.find((item) => item.id === activeClientId)!

  const visible = useMemo(() => records.filter((item) => {
    if (item.clientId !== activeClientId) return false
    const matchesSearch = `${item.reference} ${item.party} ${item.amount}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'All'
      || (filter === 'Overdue' && item.status === 'Overdue')
      || (filter === 'Purchase Invoices' && item.type === 'Purchase Invoice')
      || (filter === 'Sales Invoices' && item.type === 'Sales Invoice')
      || (filter === 'Receipts' && item.type === 'Receipt')
      || (filter === 'Bank Recon' && item.type === 'Bank Recon')
    return matchesSearch && matchesFilter
  }), [records, activeClientId, search, filter])

  return (
    <div className="page-stack accounts-page">
      <section className="page-intro page-intro--compact">
        <div><span className="eyebrow">Accounts view</span><h2>Accounts</h2><p>Review and approved operational records for {client.name}.</p></div>
        <button className="button button--secondary" onClick={() => downloadCsv(`accounts-${activeClientId}.csv`, visible)}><Download size={16} />Export CSV</button>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="filter-tabs">{filters.map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <div className="table-tools"><label className="search-field"><Search size={16} /><input placeholder="Search reference or party" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="icon-button"><SlidersHorizontal size={17} /></button></div>
        </div>
        <div className="data-table accounts-table">
          <div className="data-table__head"><span>Reference <ArrowDownUp /></span><span>Type</span><span>Party</span><span>Date</span><span>Due date</span><span>Amount</span><span>Status</span><span>Recorded by</span><span /></div>
          {visible.map((record) => (
            <div className={`data-table__row ${record.status === 'Draft' ? 'data-table__row--draft' : ''}`} key={record.id}>
              <button className="reference-link" onClick={() => setSelectedReference(record.id)}>{record.reference}</button>
              <span className="record-type">{record.type}</span>
              <strong>{record.party}</strong>
              <span>{mytDate(record.date)}</span>
              <span className={record.status === 'Overdue' ? 'danger-text' : ''}>{record.dueDate ? mytDate(record.dueDate) : '—'}</span>
              <span className={record.amount < 0 ? 'danger-text number' : 'number'}>{money(record.amount, true, record.currency)}{record.outstanding !== undefined && record.status !== 'Draft' && <small style={{display:'block',fontSize:10}}>Open / available: {money(record.outstanding,true,record.currency)}</small>}</span>
              <span><Badge tone={statusTone(record.status)}>{record.status}</Badge></span>
              <span>{record.postedBy}</span>
              <span className="row-actions">{record.status === 'Draft' && reviews.some((item) => item.clientId === activeClientId && item.reference === record.reference) ? <button className="mini-button" onClick={() => setSelectedReference(record.id)}>Review</button> : <button className="icon-button icon-button--small" onClick={() => setSelectedReference(record.id)}><Eye size={15} /></button>}<button className="icon-button icon-button--small"><MoreHorizontal size={16} /></button></span>
            </div>
          ))}
          {!visible.length && <div className="table-empty">No records match these filters.</div>}
        </div>
        <footer className="table-footer"><span>Showing 1–{visible.length} of {visible.length} records</span><div><button disabled>Previous</button><button className="active">1</button><button disabled>Next</button></div></footer>
      </section>
      <ReviewDrawer item={selectedReview} onClose={() => setSelectedReference(null)} onApprove={approveReview} onReject={rejectReview} />
    </div>
  )
}
