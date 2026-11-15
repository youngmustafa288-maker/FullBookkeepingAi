import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, History, MessageSquareWarning, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

type DocumentOption = { id: string; source_filename: string; extracted_fields: { reference?: string }; final_fields?: { reference?: string } | null }
type IssueReport = {
  id: string; ticket_number: number; reported_by: string; document_id: string | null;
  issue_type: string; priority: string; description: string; status: string;
  created_at: string; updated_at: string
}
type IssueEvent = { id: string; created_at: string; actor_id: string; action: string; old_status: string | null; new_status: string; note: string }
const kinds = [
  ['ai_decision', 'AI classification or decision'],
  ['extraction', 'Incorrect document extraction'],
  ['system_bug', 'Software bug or error'],
  ['feature_request', 'Feature suggestion'],
  ['other', 'Other issue'],
] as const
const statuses = ['new', 'investigating', 'resolved', 'closed'] as const
const when = (time: string) => new Date(time).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' })
const message = (err: unknown) => err instanceof Error ? err.message : 'Could not complete this request.'

export function IssueReporting({ companyId, userId, documents, linkedDocumentId, onCreated }: {
  companyId: string; userId: string; documents: DocumentOption[]; linkedDocumentId: string | null;
  onCreated?: () => Promise<void>
}) {
  const [type, setType] = useState('ai_decision')
  const [priority, setPriority] = useState('normal')
  const [description, setDescription] = useState('')
  const [documentId, setDocumentId] = useState(linkedDocumentId || '')
  const [reports, setReports] = useState<IssueReport[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [events, setEvents] = useState<IssueEvent[]>([])
  const [nextStatus, setNextStatus] = useState('investigating')
  const [resolutionNote, setResolutionNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [result, role] = await Promise.all([
      supabase.from('issue_reports')
        .select('id,ticket_number,reported_by,document_id,issue_type,priority,description,status,created_at,updated_at')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
      supabase.rpc('is_issue_admin', { p_company_id: companyId }),
    ])
    if (result.error || role.error) throw new Error(result.error?.message || role.error?.message || 'Could not load feedback reports')
    setReports(result.data || [])
    setIsAdmin(Boolean(role.data))
  }, [companyId])

  useEffect(() => {
    let active = true
    setLoading(true); setReports([]); setEvents([]); setActiveId(null); setError(''); setNotice('')
    Promise.all([
      supabase.from('issue_reports').select('id,ticket_number,reported_by,document_id,issue_type,priority,description,status,created_at,updated_at')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
      supabase.rpc('is_issue_admin', { p_company_id: companyId }),
    ]).then(([reportsResponse, roleResponse]) => {
      if (!active) return
      if (reportsResponse.error || roleResponse.error) throw new Error(reportsResponse.error?.message || roleResponse.error?.message)
      setReports(reportsResponse.data || []); setIsAdmin(Boolean(roleResponse.data))
    }).catch(err => { if (active) setError(message(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [companyId])
  useEffect(() => { setDocumentId(linkedDocumentId || ''); setDescription(''); setType('ai_decision'); setPriority('normal') }, [linkedDocumentId, companyId])

  const submit = async () => {
    if (description.trim().length < 10 || description.trim().length > 3000) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data, error: submitError } = await supabase.rpc('submit_issue_report', {
        p_company_id: companyId, p_type: type, p_priority: priority,
        p_description: description.trim(), p_document_id: documentId || null,
      })
      if (submitError) throw new Error(submitError.message)
      await reload()
      setDescription(''); setPriority('normal'); setType('ai_decision'); setDocumentId('')
      setNotice(`Report ISS-${data.ticket_number} submitted. It does not change any accounting entry or AI rule.`)
      await onCreated?.().catch(() => {})
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  const openHistory = async (id: string) => {
    if (activeId === id) { setActiveId(null); return }
    setActiveId(id); setEvents([]); setError('')
    const { data, error: historyError } = await supabase.from('issue_report_events')
      .select('id,created_at,actor_id,action,old_status,new_status,note')
      .eq('company_id', companyId).eq('report_id', id).order('created_at', { ascending: true }).limit(200)
    if (historyError) setError(historyError.message)
    else setEvents(data || [])
    const current = reports.find(r => r.id === id)
    setNextStatus(current?.status === 'new' ? 'investigating' : current?.status === 'investigating' ? 'resolved' : 'closed')
    setResolutionNote('')
  }

  const update = async (id: string) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: updateError } = await supabase.rpc('update_issue_report', {
        p_company_id: companyId, p_report_id: id, p_status: nextStatus, p_note: resolutionNote.trim(),
      })
      if (updateError) throw new Error(updateError.message)
      await reload()
      setNotice('Status updated and saved to the issue and company audit histories.')
      setResolutionNote('')
      const { data, error: historyError } = await supabase.from('issue_report_events')
        .select('id,created_at,actor_id,action,old_status,new_status,note')
        .eq('company_id', companyId).eq('report_id', id).order('created_at', { ascending: true }).limit(200)
      if (historyError) throw new Error(historyError.message)
      setEvents(data || [])
      await onCreated?.().catch(() => {})
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  return <div className="auto-issues-grid">
    <section className="auto-panel">
      <div className="auto-heading"><div><div className="auto-eyebrow">FEEDBACK & ISSUE REPORTING</div><h2>Report a problem</h2><p>Tell us what went wrong. Reports stay within your company, and admins can investigate and respond.</p></div><MessageSquareWarning size={26}/></div>
      {error && <div className="auto-notice auto-notice-error" role="alert"><AlertTriangle size={16}/>{error}</div>}
      {notice && <div className="auto-notice auto-notice-info" role="status"><CheckCircle2 size={16}/>{notice}</div>}
      <div className="auto-issue-form">
        <label>Issue type<select aria-label="Issue type" value={type} onChange={e => setType(e.target.value)}>{kinds.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Related document (optional)<select value={documentId} onChange={e => setDocumentId(e.target.value)}><option value="">General issue — no document</option>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.final_fields?.reference || doc.extracted_fields?.reference || doc.source_filename} · {doc.source_filename}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={e => setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>
        <label>What happened? <span>(10–3000 characters)</span><textarea rows={5} maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Example: The invoice is for diesel, but the AI suggested office expenses. Expected GL 6105. Please investigate." /></label>
        <button className="auto-primary" disabled={busy || description.trim().length < 10} onClick={() => void submit()}><Send size={15}/>{busy ? 'Submitting…' : 'Submit report'}</button>
        <p className="auto-footnote">Reports are reviewed by a human. Filing one does not update a transaction, change a vendor rule, adjust AI confidence, or confirm a correction.</p>
      </div>
    </section>
    <section className="auto-panel">
      <div className="auto-heading"><div><div className="auto-eyebrow">{isAdmin ? 'COMPANY ISSUE INBOX' : 'YOUR SUBMITTED REPORTS'}</div><h2>Track issue status</h2><p>{isAdmin ? 'As an assigned administrator, you can investigate reports and record a resolution.' : 'You can see the history and status of issues you have reported.'}</p></div><ClipboardList size={26}/></div>
      {loading ? <p className="auto-footnote">Loading reports…</p> : !reports.length ? <p className="auto-footnote">No reports found for this company.</p> : <div className="auto-issue-list">{reports.map(report => <article className="auto-issue-card" key={report.id}>
        <button className="auto-issue-summary" onClick={() => void openHistory(report.id)} aria-expanded={activeId === report.id}>
          <div><strong>ISS-{report.ticket_number} · {kinds.find(item => item[0] === report.issue_type)?.[1] || report.issue_type}</strong><small>{when(report.created_at)} · {report.reported_by === userId ? 'Reported by you' : `Reporter ${report.reported_by.slice(0, 8)}`}</small></div>
          <span className={`auto-issue-status auto-issue-status-${report.status}`}>{report.status}</span>
        </button>
        <p>{report.description}</p>
        <small>Priority: {report.priority}{report.document_id ? ` · Linked document ${report.document_id.slice(0, 8)}` : ''}</small>
        {activeId === report.id && <div className="auto-issue-detail"><h3><History size={15}/> Issue timeline</h3>
          {events.length ? <ol>{events.map(event => <li key={event.id}><strong>{event.old_status ? `${event.old_status} → ${event.new_status}` : 'Submitted'}</strong><small>{when(event.created_at)} · By {event.actor_id === userId ? 'you' : event.actor_id.slice(0, 8)}</small><p>{event.note}</p></li>)}</ol> : <p>Loading history or no events recorded.</p>}
          {isAdmin && <div className="auto-issue-admin"><label>Change status<select value={nextStatus} onChange={e => setNextStatus(e.target.value)}>{statuses.filter(status => status !== report.status).map(status => <option key={status} value={status}>{status}</option>)}</select></label><label>Investigation / resolution note<textarea rows={3} maxLength={1000} value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} placeholder="What was checked, corrected, or still requires attention?" /></label><button className="auto-secondary" disabled={busy || nextStatus === report.status || (nextStatus === 'closed' && report.status !== 'resolved') || resolutionNote.trim().length < 8} onClick={() => void update(report.id)}>Save status with audit note</button></div>}
        </div>}
      </article>)}</div>}
      {reports.length >= 200 && <p className="auto-footnote">Only the latest 200 reports are loaded in this view.</p>}
    </section>
  </div>
}
