import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'

import { useApp } from '../context/AppContext'
import { downloadCsv, mytDate } from '../lib/format'
import type { AuditAction } from '../types'
import { Badge } from '../components/Badge'

function actionTone(action: AuditAction) {
  if (action === 'Approved' || action === 'Posted' || action === 'Period Closed') return 'success'
  if (action === 'Failed' || action === 'Rejected') return 'danger'
  if (action === 'Edited' || action === 'Period Reopened') return 'warning'
  return 'neutral'
}

export function AuditLog() {
  const { clients, activeClientId, audit } = useApp()
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')
  const activeClient = clients.find((client) => client.id === activeClientId)!
  const visible = useMemo(() => audit.filter((event) => {
    return event.clientId === activeClientId
      && (action === 'all' || event.action === action)
      && event.reference.toLowerCase().includes(search.toLowerCase())
  }), [audit, activeClientId, action, search])

  return (
    <div className="page-stack">
      <section className="page-intro page-intro--compact"><div><span className="eyebrow">Activity history</span><h2>Audit log</h2><p>Showing only activity for {activeClient.name}. Times are displayed in MYT.</p></div></section>
      <section className="panel table-panel audit-panel">
        <div className="audit-toolbar"><label><span>Action</span><select value={action} onChange={(event) => setAction(event.target.value)}><option value="all">All actions</option>{['Submitted','Approved', 'Rejected', 'Edited', 'Allocated', 'Matched', 'Posted', 'Voided', 'Failed', 'Period Closed', 'Period Reopened'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="search-field"><Search size={16} /><input placeholder="Search reference" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button button--secondary" onClick={() => downloadCsv(`audit-${activeClientId}.csv`, visible)}><Download size={16} />Export CSV</button></div>
        <div className="data-table audit-table audit-table--simple"><div className="data-table__head"><span>Time (MYT)</span><span>Action</span><span>Reference</span><span>Actor</span><span>Note</span></div>{visible.map((event) => <div className={`data-table__row ${event.action === 'Failed' ? 'data-table__row--failed' : ''}`} key={event.id}><span className="audit-time">{mytDate(event.timestamp, true)}</span><span><Badge tone={actionTone(event.action)}>{event.action}</Badge></span><details><summary className="reference-link">{event.reference}</summary><pre style={{whiteSpace:'pre-wrap',maxWidth:360,fontSize:11}}>{event.original}</pre></details><span className="audit-actor"><strong>{event.actor}</strong><small>{event.actorType}</small></span><span className="audit-note">{event.note ?? '—'}</span></div>)}</div>
        <footer className="table-footer"><span>Showing {visible.length} events</span><div><button disabled>Previous</button><button className="active">1</button><button disabled>Next</button></div></footer>
      </section>
    </div>
  )
}
