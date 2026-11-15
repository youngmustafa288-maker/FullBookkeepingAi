import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, BookOpenText, CheckCircle2, ChevronDown, Download, FileImage, FileCheck2,
  FileClock, FileUp, History, Loader2, LockKeyhole, LogOut, MessageSquareWarning, Plus, RefreshCw, ShieldCheck,
  SlidersHorizontal, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { displayConfidence } from '../lib/confidence'
import { IssueReporting } from './IssueReporting'
import '../automation.css'

type Company = { id: string; name: string; currency: string; tax_regime: string }
type Fields = {
  vendor: string; reference: string; date: string; amount: number | null;
  subtotal: number | null; tax_amount: number | null; currency: string;
  gl_code: string; category: string; tax_code: string; description: string
}
type DecisionExplanation = { version?: number; ai_summary?: string; ai_evidence?: string[]; verified_rules?: string[]; deterministic_checks?: string[]; uncertainties?: string[] }
type DocumentRow = {
  id: string; job_id: string; company_id: string; document_type: string; source_filename: string;
  source_storage_path: string | null; source_mime_type: string | null;
  extracted_fields: Partial<Fields>; final_fields: Partial<Fields> | null;
  confidence_scores: { model_self_reported?: number | null; deterministic_issues?: number };
  agent_notes: string[]; decision_explanation?: DecisionExplanation; processing_context?: { source_sha256?: string; client_context_sha256?: string; ai_model?: string; ocr_model?: string; workflow_version?: string; workflow_rules_sha256?: string; recorded_at?: string }; status: 'pending' | 'approved' | 'rejected';
  created_at: string; approved_at: string | null
}
type GlCode = { id: string; code: string; name: string; account_type: string; active: boolean }
type VendorRule = { id: string; vendor_pattern: string; gl_code: string; default_category: string; tax_code: string }
type Policy = { id: string; policy_key: string; policy_value: unknown }
type LearningSummary = { reviewed: number; unchanged: number; gl_unchanged: number; amount_unchanged: number }
type RuleSuggestion = { id: string; vendor_name: string; proposed_gl_code: string; proposed_category: string; proposed_tax_code: string; support_count: number; status: string }
type Tab = 'upload' | 'review' | 'approved' | 'rules' | 'audit' | 'feedback'
type AuditRow = { id: string; job_id: string | null; actor_id: string | null; timestamp: string; action: string; actor_type: string; document_ref: string | null; original_values: unknown; final_values: unknown; note: string | null }
const inputKeys = ['vendor', 'reference', 'date', 'amount', 'subtotal', 'tax_amount', 'currency', 'gl_code', 'category', 'tax_code', 'description'] as const
const labels: Record<typeof inputKeys[number], string> = {
  vendor: 'Vendor / merchant', reference: 'Document reference', date: 'Document date (YYYY-MM-DD)',
  amount: 'Total amount', subtotal: 'Subtotal (if stated)', tax_amount: 'Tax amount (if stated)',
  currency: 'Currency', gl_code: 'Approved GL code', category: 'Category', tax_code: 'Tax code (if applicable)', description: 'Description',
}

async function request<T>(url: string, options?: { method?: string; body?: object }): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Your session has expired. Sign in again.')
  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, ...(options?.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) {
    const data: { error?: string } = await response.json().catch(() => ({}))
    throw new Error(data.error || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}
function errorMessage(value: unknown) { return value instanceof Error ? value.message : 'Something went wrong.' }
function dateLabel(value: string) { return new Date(value).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }) }
function amountLabel(value: number | null | undefined, currency: string) { return value === null || value === undefined ? 'Needs review' : `${currency} ${Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export function AutomationLayer() {
  const { user, signOut } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState('')
  const [tab, setTab] = useState<Tab>('upload')
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [glCodes, setGlCodes] = useState<GlCode[]>([])
  const [vendorRules, setVendorRules] = useState<VendorRule[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([])
  const [learningSummary, setLearningSummary] = useState<LearningSummary>({ reviewed: 0, unchanged: 0, gl_unchanged: 0, amount_unchanged: 0 })
  const [auditEvents, setAuditEvents] = useState<AuditRow[]>([])
  const [auditSearch, setAuditSearch] = useState('')
  const [archiveQuery, setArchiveQuery] = useState('')
  const [archiveActive, setArchiveActive] = useState(false)
  const [trace, setTrace] = useState<DocumentRow | null>(null)
  const [reportDocumentId, setReportDocumentId] = useState<string | null>(null)
  const [traceEvents, setTraceEvents] = useState<AuditRow[]>([])
  const [traceLoading, setTraceLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [workflow, setWorkflow] = useState<'invoice' | 'receipt'>('invoice')
  const [selected, setSelected] = useState<DocumentRow | null>(null)
  const [newCompany, setNewCompany] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const company = companies.find(c => c.id === companyId)

  const refreshCompanies = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from('companies').select('id,name,currency,tax_regime').order('name')
    if (fetchError) throw new Error(fetchError.message)
    const list = data as Company[] || []
    setCompanies(list)
    setCompanyId(id => list.some(c => c.id === id) ? id : (list[0]?.id || ''))
  }, [])
  const refresh = useCallback(async () => {
    if (!companyId) { setDocuments([]); setGlCodes([]); setVendorRules([]); setPolicies([]); setSuggestions([]); setLearningSummary({ reviewed: 0, unchanged: 0, gl_unchanged: 0, amount_unchanged: 0 }); setAuditEvents([]); return }
    const [docResponse, glResponse, vendorResponse, policyResponse, auditResponse, suggestionsResponse, feedbackResponse] = await Promise.all([
      request<{ documents: DocumentRow[] }>(`/api/automation?companyId=${encodeURIComponent(companyId)}`),
      supabase.from('gl_codes').select('id,code,name,account_type,active').eq('company_id', companyId).order('code'),
      supabase.from('vendor_rules').select('id,vendor_pattern,gl_code,default_category,tax_code').eq('company_id', companyId).eq('status', 'approved').order('vendor_pattern'),
      supabase.from('client_policies').select('id,policy_key,policy_value').eq('company_id', companyId).eq('active', true).order('policy_key'),
      supabase.from('audit_log').select('id,job_id,actor_id,timestamp,action,actor_type,document_ref,original_values,final_values,note').eq('company_id', companyId).order('timestamp', { ascending: false }).limit(200),
      supabase.from('vendor_rule_suggestions').select('id,vendor_name,proposed_gl_code,proposed_category,proposed_tax_code,support_count,status').eq('company_id', companyId).eq('status', 'pending').order('support_count', { ascending: false }),
      supabase.rpc('get_review_feedback_summary', { p_company_id: companyId }),
    ])
    if (glResponse.error || vendorResponse.error || policyResponse.error || auditResponse.error || suggestionsResponse.error || feedbackResponse.error) throw new Error('Client configuration, correction feedback or audit history could not be loaded. Apply the v2 and v3 SQL migrations first.')
    setDocuments(docResponse.documents)
    setGlCodes(glResponse.data || [])
    setVendorRules(vendorResponse.data || [])
    setPolicies(policyResponse.data || [])
    setSuggestions(suggestionsResponse.data || [])
    setLearningSummary(feedbackResponse.data || { reviewed: 0, unchanged: 0, gl_unchanged: 0, amount_unchanged: 0 })
    setAuditEvents(auditResponse.data || [])
  }, [companyId])

  useEffect(() => {
    let active = true
    refreshCompanies().catch(err => { if (active) setError(errorMessage(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshCompanies])
  useEffect(() => {
    setError('')
    refresh().catch(err => setError(errorMessage(err)))
  }, [refresh])

  const searchArchive = async () => {
    const search = archiveQuery.trim().slice(0, 120)
    if (search.length < 2) { setError('Enter at least two characters of a document reference.'); return }
    setBusy(true); setError('')
    const { data, error: searchError } = await supabase.from('audit_log')
      .select('id,job_id,actor_id,timestamp,action,actor_type,document_ref,original_values,final_values,note')
      .eq('company_id', companyId).ilike('document_ref', `%${search}%`)
      .order('timestamp', { ascending: false }).limit(200)
    if (searchError) setError(searchError.message)
    else { setAuditEvents(data || []); setArchiveActive(true); setAuditSearch('') }
    setBusy(false)
  }
  const resetArchive = async () => { setArchiveActive(false); setArchiveQuery(''); setAuditSearch(''); await refresh() }
  const openTrace = async (doc: DocumentRow) => {
    setSelected(null); setTrace(doc); setTraceEvents([]); setTraceLoading(true); setError('')
    const { data, error: loadError } = await supabase.from('audit_log')
      .select('id,job_id,actor_id,timestamp,action,actor_type,document_ref,original_values,final_values,note')
      .eq('company_id', doc.company_id).eq('job_id', doc.job_id).order('timestamp', { ascending: true }).limit(200)
    if (loadError) setError(`Unable to load this document's history: ${loadError.message}`)
    else setTraceEvents(data || [])
    setTraceLoading(false)
  }
  const filteredAudit = useMemo(() => auditEvents.filter(e =>
    `${e.action} ${e.document_ref || ''} ${e.actor_type} ${e.actor_id || ''} ${e.note || ''}`.toLowerCase().includes(auditSearch.trim().toLowerCase())), [auditEvents, auditSearch])
  const reportIssue = (item?: DocumentRow) => { setSelected(null); setTrace(null); setReportDocumentId(item?.id || null); setTab('feedback'); setError('') }
  const pending = useMemo(() => documents.filter(d => d.status === 'pending'), [documents])
  const approved = useMemo(() => documents.filter(d => d.status === 'approved'), [documents])

  const handleCreateCompany = async () => {
    if (newCompany.trim().length < 2) return
    setBusy(true); setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('create_company_for_current_user', { p_name: newCompany.trim(), p_currency: 'MYR' })
      if (rpcError) throw new Error(rpcError.message)
      await refreshCompanies()
      setCompanyId(String(data)); setNewCompany(''); setStatus('Company created. Add its approved chart of accounts and vendor rules before processing documents.'); setTab('rules')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  const processFile = async (file: File) => {
    if (!company) return
    setError(''); setStatus('')
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setError('This version accepts JPG and PNG only. Convert each PDF page to an image before uploading.'); return }
    if (file.size > 8 * 1024 * 1024) { setError('File exceeds 8 MB.'); return }
    setBusy(true)
    const extension = file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${company.id}/${crypto.randomUUID()}.${extension}`
    try {
      setStatus('Saving original document to private, company-scoped storage…')
      const { error: storageError } = await supabase.storage.from('accounting-sources').upload(path, file, { contentType: file.type, upsert: false })
      if (storageError) throw new Error(storageError.message)
      setStatus('Extracting and checking against this company’s approved rules…')
      await request('/api/automation', { method: 'POST', body: { action: 'process', companyId: company.id, workflow, storagePath: path, filename: file.name, mimeType: file.type } })
      setStatus('Saved to review queue. No external accounting entry was posted.')
      setTab('review')
      await refresh()
    } catch (err) { setStatus(''); setError(errorMessage(err)) }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }

  const saveDecision = async (item: DocumentRow, decision: 'approve' | 'reject', fields: Fields | null, note: string) => {
    setBusy(true); setError(''); setStatus('')
    try {
      await request('/api/automation', { method: 'POST', body: { action: 'review', companyId, documentId: item.id, decision, fields, note } })
      setSelected(null)
      await refresh()
      setStatus(decision === 'approve' ? 'Approved and saved for export. No accounting-platform posting occurred.' : 'Rejected. The original and the decision remain auditable.')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  const reviewSuggestion = async (suggestion: RuleSuggestion, decision: 'approve' | 'dismiss') => {
    setBusy(true); setError(''); setStatus('')
    try {
      const { error: rpcError } = await supabase.rpc('resolve_vendor_rule_suggestion', {
        p_company_id: companyId, p_suggestion_id: suggestion.id, p_decision: decision,
      })
      if (rpcError) throw new Error(rpcError.message)
      await refresh()
      setStatus(decision === 'approve'
        ? `Approved a client-specific vendor rule for ${suggestion.vendor_name}. No document was posted.`
        : `Dismissed the suggested rule for ${suggestion.vendor_name}.`)
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  const handleExport = async () => {
    if (!companyId || !approved.length) return
    setBusy(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to export.')
      const response = await fetch(`/api/export?companyId=${encodeURIComponent(companyId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error('Export failed.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `bookai-approved-${companyId.slice(0, 8)}.csv`; link.click()
      URL.revokeObjectURL(url)
      setStatus('CSV prepared and download initiated. Audit records preparation, not confirmed import or posting.')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  const viewSource = async (row: DocumentRow) => {
    if (!row.source_storage_path) { setError('Source file path is unavailable.'); return }
    const { data, error: urlError } = await supabase.storage.from('accounting-sources').createSignedUrl(row.source_storage_path, 60)
    if (urlError || !data?.signedUrl) { setError(urlError?.message || 'Unable to open document.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="auto-layout">
      <aside className="auto-sidebar">
        <div className="auto-brand"><span className="auto-brand-icon"><SlidersHorizontal size={19} /></span><div><strong>FullBookkeepingAI</strong><small>Automation layer</small></div></div>
        <div className="auto-company-label">ACTIVE COMPANY</div>
        <div className="auto-company-field"><select aria-label="Active company" value={companyId} onChange={e => { setSelected(null); setTrace(null); setReportDocumentId(null); setAuditSearch(''); setArchiveQuery(''); setArchiveActive(false); setCompanyId(e.target.value) }} disabled={!companies.length}>{companies.length ? companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">No company yet</option>}</select><ChevronDown size={14} /></div>
        <nav className="auto-nav" aria-label="Main navigation">
          <button className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}><FileUp size={18} />Process documents</button>
          <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}><FileClock size={18} />Review queue <span>{pending.length}</span></button>
          <button className={tab === 'approved' ? 'active' : ''} onClick={() => setTab('approved')}><FileCheck2 size={18} />Approved export <span>{approved.length}</span></button>
          <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}><SlidersHorizontal size={18} />Client rules</button>
          <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><History size={18} />Audit history</button>
          <button className={tab === 'feedback' ? 'active' : ''} onClick={() => reportIssue()}><MessageSquareWarning size={18}/>Report an issue</button>
        </nav>
        <div className="auto-side-footer"><LockKeyhole size={16} /><span>Private storage · Company-scoped data · Mandatory human approval</span></div>
      </aside>
      <main className="auto-main">
        <header className="auto-top"><div><div className="auto-eyebrow">ACCOUNTING AUTOMATION / MALAYSIA</div><h1>{tab === 'upload' ? 'Document intake' : tab === 'review' ? 'Review proposals' : tab === 'approved' ? 'Approved for export' : tab === 'rules' ? 'Client configuration' : tab === 'audit' ? 'Audit history' : 'Feedback & issues'}</h1></div><div className="auto-account"><span>{user?.email}</span><button className="auto-icon" title="Sign out" onClick={() => void signOut()}><LogOut size={17} /></button></div></header>
        <div className="auto-page">
          {error && <div className="auto-notice auto-notice-error" role="alert"><AlertTriangle size={17}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
          {status && <div className="auto-notice auto-notice-info" role="status"><CheckCircle2 size={17}/><span>{status}</span><button onClick={() => setStatus('')} aria-label="Dismiss"><X size={15}/></button></div>}
          {loading ? <div className="auto-empty"><Loader2 className="spin"/>Loading companies…</div> : !company ? (
            <div className="auto-panel auto-onboard"><div className="auto-feature-icon"><Plus size={24}/></div><h2>Create your first client company</h2><p>Each client has its own private documents, GL chart and vendor rules. No accounting-system connection is required to start.</p><label>Company legal name<input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="e.g. ABC Logistics Sdn Bhd" /></label><button className="auto-primary" disabled={busy || newCompany.trim().length < 2} onClick={() => void handleCreateCompany()}>{busy ? 'Creating…' : 'Create company'}<ArrowRight size={16}/></button></div>
          ) : (
            <>
              <div className="auto-scope"><ShieldCheck size={18}/><span><strong>{company.name}</strong> · {company.currency} · Isolated company workspace</span><button onClick={() => void refresh().catch(err => setError(errorMessage(err)))}><RefreshCw size={16}/>Refresh</button></div>
              {tab === 'upload' && <section className="auto-panel">
                <div className="auto-heading"><div><div className="auto-eyebrow">STEP 01 / INTAKE</div><h2>Turn documents into reviewable drafts</h2><p>The AI suggests classifications using this client’s approved GL and vendor mappings. Every result must be reviewed by a human.</p></div><FileImage size={28}/></div>
                <div className="auto-toggle" role="group" aria-label="Document type"><button className={workflow === 'invoice' ? 'active' : ''} onClick={() => setWorkflow('invoice')}>Purchase invoice</button><button className={workflow === 'receipt' ? 'active' : ''} onClick={() => setWorkflow('receipt')}>Receipt</button></div>
                <input ref={inputRef} hidden type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={e => { const file = e.target.files?.[0]; if (file) void processFile(file) }}/>
                <button className="auto-drop" disabled={busy} onClick={() => inputRef.current?.click()}><FileUp size={28}/><strong>{busy ? status || 'Processing…' : 'Choose a document image'}</strong><span>JPG or PNG · one image · up to 8 MB</span><em>Browse files</em></button>
                <div className="auto-info-grid"><div><strong>1 · Extract</strong><span>OCR from source image</span></div><div><strong>2 · Validate</strong><span>Cross-check GL, amount and approved rules</span></div><div><strong>3 · Review</strong><span>Human corrects and approves</span></div><div><strong>4 · Export</strong><span>CSV for a separate accounting platform</span></div></div>
                {!glCodes.some(g => g.active) && <div className="auto-callout"><AlertTriangle size={16}/><span>No approved GL codes configured. You can extract a draft, but approval requires a valid GL code.</span><button onClick={() => setTab('rules')}>Configure</button></div>}
                <p className="auto-footnote">Originals are stored in private Supabase Storage. Processing sends source images to your configured OCR service and extracted text to your AI provider. PDFs, reconciliation, posting and platform-specific adapters are not enabled in this release.</p>
              </section>}
              {tab === 'review' && <section className="auto-panel"><div className="auto-heading"><div><div className="auto-eyebrow">STEP 02 / QUALITY GATE</div><h2>{pending.length} awaiting human review</h2><p>Model confidence is a self-assessment, not a measured accuracy score. Open every draft and compare it to the source image.</p></div><FileClock size={28}/></div><DocumentList documents={pending} currency={company.currency} onReview={setSelected} onSource={viewSource} onTrace={openTrace} onReport={reportIssue} /></section>}
              {tab === 'approved' && <section className="auto-panel"><div className="auto-heading"><div><div className="auto-eyebrow">STEP 03 / HANDOFF</div><h2>{approved.length} approved documents</h2><p>Approved accounting proposals are NOT posted. Export a neutral CSV to map and import into your existing accounting system.</p></div><button className="auto-primary" disabled={busy || approved.length === 0} onClick={() => void handleExport()}><Download size={16}/>Export CSV</button></div><DocumentList documents={approved} currency={company.currency} onSource={viewSource} onTrace={openTrace} onReport={reportIssue} /></section>}
              {tab === 'audit' && <section className="auto-panel"><div className="auto-heading"><div><div className="auto-eyebrow">APPEND-ONLY HISTORY</div><h2>Recorded decisions and changes</h2><p>Trace processing, approval, rule changes and CSV preparation. Audit entries are append-only for app users. This is not evidence of external accounting posting.</p></div><History size={25}/></div><input className="auto-audit-search" aria-label="Filter latest audit events" placeholder="Filter loaded events by document, action, user ID or note" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} /><div className="auto-audit-archive-search"><input className="auto-audit-search" aria-label="Search historical document reference" placeholder="Search all history by document reference" value={archiveQuery} onChange={e => setArchiveQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchArchive() }}/><button className="auto-secondary" disabled={busy || archiveQuery.trim().length < 2} onClick={() => void searchArchive()}>Search all</button>{archiveActive && <button className="auto-secondary" onClick={() => void resetArchive()}>Latest</button>}</div><p className="auto-footnote">{archiveActive ? 'Showing up to 200 matching events across all history.' : 'Showing up to 200 most recent events. Search all history using a document reference.'}</p>{filteredAudit.length ? <div className="auto-rule-list auto-audit-list">{filteredAudit.map(e => <details className="auto-audit-entry" key={e.id}><summary><strong>{e.action}</strong><span>{e.document_ref || 'Unreferenced document'} · {e.actor_type} {e.actor_id ? `(${e.actor_id.slice(0, 8)})` : ''} · {dateLabel(e.timestamp)}</span></summary><p>{e.note || 'No note supplied.'}</p><pre>{JSON.stringify({ original: e.original_values, final: e.final_values }, null, 2)}</pre></details>)}</div> : <div className="auto-empty">No matching events in the latest 200 entries.</div>}</section>}
              {tab === 'feedback' && <IssueReporting companyId={companyId} userId={user?.id || ''} documents={documents} linkedDocumentId={reportDocumentId} onCreated={refresh} />}
              {tab === 'rules' && <Rules company={company} companyId={companyId} userId={user?.id || ''} glCodes={glCodes} vendorRules={vendorRules} policies={policies} suggestions={suggestions} learningSummary={learningSummary} busy={busy} onSuggestionDecision={reviewSuggestion} onChanged={refresh} onCompaniesChanged={refreshCompanies} onError={setError} />}
            </>
          )}
        </div>
      </main>
      {selected && company && <ReviewModal item={selected} company={company} glCodes={glCodes} busy={busy} onClose={() => setSelected(null)} onSave={saveDecision} onSource={viewSource} onTrace={openTrace} onReport={reportIssue} />}
      {trace && <TraceModal item={trace} events={traceEvents} loading={traceLoading} onClose={() => setTrace(null)} onSource={viewSource} onReport={reportIssue} />}
    </div>
  )
}

function confidenceLabel(raw: unknown) {
  const score = displayConfidence(raw)
  return score.percentage === null ? 'Not provided' : `${score.percentage}% · ${score.level}`
}

function DocumentList({ documents, currency, onReview, onSource, onTrace, onReport }: { documents: DocumentRow[]; currency: string; onReview?: (item: DocumentRow) => void; onSource: (item: DocumentRow) => void; onTrace: (item: DocumentRow) => Promise<void>; onReport: (item: DocumentRow) => void }) {
  if (!documents.length) return <div className="auto-empty"><FileCheck2 size={28}/><strong>No documents here yet</strong><span>Documents will appear after intake or approval.</span></div>
  return <div className="auto-documents">{documents.map(doc => <div className="auto-document" key={doc.id}>
    <div className="auto-doc-icon"><FileImage size={19}/></div>
    <div className="auto-doc-main"><strong>{doc.final_fields?.vendor || doc.extracted_fields?.vendor || 'Unknown vendor'}</strong><small>{doc.final_fields?.reference || doc.extracted_fields?.reference || doc.source_filename} · {doc.source_filename}</small><span>{dateLabel(doc.created_at)} · {doc.document_type.replace('_', ' ')}</span><small>AI estimate: {confidenceLabel(doc.confidence_scores?.model_self_reported)}{doc.agent_notes?.length ? ' · validation warnings' : ''}</small>{doc.agent_notes?.length > 0 && <div className="auto-doc-warning"><AlertTriangle size={13}/> {doc.agent_notes.length} issue{doc.agent_notes.length === 1 ? '' : 's'} to check</div>}</div>
    <div className="auto-doc-value"><strong>{amountLabel(doc.final_fields?.amount ?? doc.extracted_fields?.amount, currency)}</strong><span>{doc.status === 'approved' ? 'Approved · not posted' : 'Pending review'}</span></div>
    <div className="auto-doc-actions"><button className="auto-secondary" onClick={() => void onSource(doc)}>Source</button><button className="auto-secondary" onClick={() => void onTrace(doc)}><History size={14}/>Trace</button><button className="auto-secondary" onClick={() => onReport(doc)}><MessageSquareWarning size={14}/>Report issue</button>{onReview && <button className="auto-primary" onClick={() => onReview(doc)}>Review <ArrowRight size={14}/></button>}</div>
  </div>)}</div>
}

function ReviewModal({ item, company, glCodes, busy, onClose, onSave, onSource, onTrace, onReport }: {
  item: DocumentRow; company: Company; glCodes: GlCode[]; busy: boolean; onClose: () => void;
  onSave: (item: DocumentRow, decision: 'approve' | 'reject', fields: Fields | null, note: string) => Promise<void>;
  onSource: (item: DocumentRow) => void; onTrace: (item: DocumentRow) => Promise<void>; onReport: (item: DocumentRow) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(inputKeys.map(key => [key, item.extracted_fields?.[key] == null ? '' : String(item.extracted_fields[key]) ])))
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const fields: Fields = {
    vendor: values.vendor.trim(), reference: values.reference.trim(), date: values.date.trim(),
    amount: values.amount.trim() ? Number(values.amount) : null,
    subtotal: values.subtotal.trim() ? Number(values.subtotal) : null,
    tax_amount: values.tax_amount.trim() ? Number(values.tax_amount) : null,
    currency: values.currency.trim().toUpperCase(), gl_code: values.gl_code.trim(),
    category: values.category.trim(), tax_code: values.tax_code.trim(), description: values.description.trim(),
  }
  const edited = inputKeys.some(key => String(item.extracted_fields?.[key] ?? '') !== String(fields[key] ?? ''))
  const noteRequired = edited && note.trim().length < 5
  const basicValid = Boolean(fields.vendor && fields.reference && /^\d{4}-\d{2}-\d{2}$/.test(fields.date) && fields.amount && fields.amount > 0 && fields.currency === company.currency && glCodes.some(g => g.active && g.code === fields.gl_code))
  return <div className="auto-overlay" onMouseDown={onClose}><div className="auto-modal" role="dialog" aria-modal="true" aria-label="Review accounting proposal" onMouseDown={e => e.stopPropagation()}>
    <header className="auto-modal-header"><div><div className="auto-eyebrow">HUMAN REVIEW / NO AUTOMATIC POSTING</div><h2>{item.source_filename}</h2><p>Match these fields to the original image and correct any AI errors.</p></div><button className="auto-icon" onClick={onClose} disabled={busy}><X size={19}/></button></header>
    <div className="auto-modal-body"><section className="auto-review-source"><button className="auto-secondary" onClick={() => void onSource(item)}><FileImage size={16}/>Open original source image</button><button className="auto-secondary" style={{ marginTop: 8 }} onClick={() => void onTrace(item)}><BookOpenText size={16}/>AI explanation & full trace</button><button className="auto-secondary" style={{ marginTop: 8 }} onClick={() => onReport(item)}><MessageSquareWarning size={16}/>Report AI issue</button><div className="auto-eyebrow">AI CONFIDENCE (SELF-ESTIMATE ONLY)</div><strong>{confidenceLabel(item.confidence_scores?.model_self_reported)}</strong><p className="auto-footnote">High: 90–100% · Medium: 70–89% · Low: 0–69%. Not a measured accuracy rate. All documents require review.</p><div className="auto-eyebrow" style={{ marginTop: 22 }}>AI DECISION SUMMARY (ADVISORY)</div><p>{item.decision_explanation?.ai_summary || "No explanation recorded. This document may have been processed before v3."}</p><div className="auto-eyebrow" style={{ marginTop: 22 }}>WARNINGS AND VALIDATION</div>{item.agent_notes?.length ? <ul>{item.agent_notes.map((warning, i) => <li key={i}>{warning}</li>)}</ul> : <p>No automated warnings. Still check every field against the image.</p>}</section>
    <section className="auto-review-fields"><div className="auto-fields">{inputKeys.map(key => <label key={key}>{labels[key]}{key === 'gl_code' ? <select value={values[key]} onChange={e => setValues(current => ({ ...current, [key]: e.target.value }))}><option value="">Select GL code</option>{glCodes.filter(g => g.active).map(g => <option key={g.code} value={g.code}>{g.code} — {g.name}</option>)}</select> : <input value={values[key]} type={key === 'date' ? 'date' : ['amount','subtotal','tax_amount'].includes(key) ? 'number' : 'text'} step={['amount','subtotal','tax_amount'].includes(key) ? '0.01' : undefined} onChange={e => setValues(current => ({ ...current, [key]: e.target.value }))} />}</label>)}</div><label className="auto-note">Review note (required for corrections or rejection)<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="State any classification changes or unusual treatments." /></label><label className="auto-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I verified this proposal against the original image and accept the accounting classification.</label></section></div>
    <footer className="auto-modal-footer"><button className="auto-secondary" disabled={busy || note.trim().length < 5} onClick={() => void onSave(item, 'reject', null, note)}>Reject draft</button><button className="auto-primary" disabled={busy || !confirmed || !basicValid || noteRequired} onClick={() => void onSave(item, 'approve', fields, note)}>{busy ? 'Saving…' : 'Approve for export'}<CheckCircle2 size={16}/></button></footer>
    {(noteRequired || note.trim().length < 5) && <div className="auto-modal-hint">A note of at least 5 characters is required if you edit any field or reject the document.</div>}
    {!basicValid && <div className="auto-modal-hint">Approval needs a vendor, reference, valid date, positive amount, company currency, and an active GL code. Additional checks run on the server.</div>}
  </div></div>
}

function TraceModal({ item, events, loading, onClose, onSource, onReport }: {
  item: DocumentRow; events: AuditRow[]; loading: boolean; onClose: () => void; onSource: (item: DocumentRow) => void; onReport: (item: DocumentRow) => void
}) {
  const explanation = item.decision_explanation
  const changes = inputKeys.filter(key => item.final_fields &&
    String(item.extracted_fields?.[key] ?? '') !== String(item.final_fields?.[key] ?? ''))
  return <div className="auto-overlay" onMouseDown={onClose}><div className="auto-modal auto-trace-modal" role="dialog" aria-modal="true" aria-label="Document decision and audit trace" onMouseDown={e => e.stopPropagation()}>
    <header className="auto-modal-header"><div><div className="auto-eyebrow">DOCUMENT TRACE / AUDIT EVIDENCE</div><h2>{item.final_fields?.reference || item.extracted_fields?.reference || item.source_filename}</h2><p>{item.source_filename} · {item.status} · AI estimate {confidenceLabel(item.confidence_scores?.model_self_reported)}</p></div><button className="auto-icon" onClick={onClose} aria-label="Close trace"><X size={19}/></button></header>
    <div className="auto-trace-content"><div className="auto-trace-actions"><button className="auto-secondary" onClick={() => void onSource(item)}><FileImage size={15}/>Original image</button><button className="auto-secondary" onClick={() => onReport(item)}><MessageSquareWarning size={15}/>Report issue</button><span>Approval does not mean accounting-platform posting.</span></div>
      <section className="auto-trace-section"><h3>AI decision explanation</h3><p className="auto-trace-warning">Model-generated explanation, not hidden reasoning or proof of correctness. Verify the description against the original image.</p><p><strong>AI summary:</strong> {explanation?.ai_summary || 'Not recorded in this version of the document.'}</p>
        {!!explanation?.ai_evidence?.length && <><h4>Evidence reported by AI (unverified)</h4><ul>{explanation.ai_evidence.map((value,i) => <li key={i}>{value}</li>)}</ul></>}
        {!!explanation?.verified_rules?.length && <><h4>Independently checked client rules</h4><ul>{explanation.verified_rules.map((value,i) => <li key={i}>{value}</li>)}</ul></>}
        {!!explanation?.uncertainties?.length && <><h4>Uncertainties requiring review</h4><ul>{explanation.uncertainties.map((value,i) => <li key={i}>{value}</li>)}</ul></>}
        {!!item.agent_notes?.length && <><h4>Validation and AI warnings</h4><ul>{item.agent_notes.map((value,i) => <li key={i}>{value}</li>)}</ul></>}
      </section>
      <section className="auto-trace-section"><h3>Human corrections</h3>{item.final_fields ? changes.length ? <div className="auto-trace-changes">{changes.map(key => <div key={key}><strong>{labels[key]}</strong><span>AI: {String(item.extracted_fields?.[key] ?? '—')}</span><span>Approved: {String(item.final_fields?.[key] ?? '—')}</span></div>)}</div> : <p>No differences between the stored AI suggestion and the approved entry.</p> : <p>Not approved yet. The original AI proposal remains unchanged in storage.</p>}</section>
      <section className="auto-trace-section"><h3>Audit timeline</h3>{loading ? <p>Loading audit events…</p> : events.length ? <ol className="auto-trace-timeline">{events.map(event => <li key={event.id}><div><strong>{event.action.replace(/_/g, ' ')}</strong><small>{dateLabel(event.timestamp)} · {event.actor_type}{event.actor_id ? ` · ID ${event.actor_id}` : ''}</small></div><p>{event.note || 'No note supplied.'}</p><details><summary>View stored event values</summary><pre>{JSON.stringify({ before: event.original_values, after: event.final_values }, null, 2)}</pre></details></li>)}</ol> : <p>No events found for this processing job.</p>}</section>
      <section className="auto-trace-section"><h3>Processing provenance</h3><p>AI model: {item.processing_context?.ai_model || 'Not recorded'} · OCR: {item.processing_context?.ocr_model || 'Not recorded'} · Workflow: {item.processing_context?.workflow_version || 'Not recorded'}</p><div className="auto-trace-ids"><small>Document ID: {item.id}</small><small>Job ID: {item.job_id}</small><small>Source SHA-256: {item.processing_context?.source_sha256 || 'Not recorded'}</small><small>Client rules fingerprint: {item.processing_context?.client_context_sha256 || 'Not recorded'}</small><small>Workflow reference fingerprint: {item.processing_context?.workflow_rules_sha256 || 'Not recorded'}</small></div></section>
    </div>
  </div></div>
}

function Rules({ company, companyId, userId, glCodes, vendorRules, policies, suggestions, learningSummary, busy, onSuggestionDecision, onChanged, onCompaniesChanged, onError }: {
  company: Company; companyId: string; userId: string; glCodes: GlCode[]; vendorRules: VendorRule[]; policies: Policy[];
  suggestions: RuleSuggestion[]; learningSummary: LearningSummary; busy: boolean;
  onSuggestionDecision: (suggestion: RuleSuggestion, decision: 'approve' | 'dismiss') => Promise<void>;
  onChanged: () => Promise<void>; onCompaniesChanged: () => Promise<void>; onError: (text: string) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState('Expense')
  const [vendor, setVendor] = useState('')
  const [vendorCode, setVendorCode] = useState('')
  const [category, setCategory] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [policyKey, setPolicyKey] = useState('')
  const [policyValue, setPolicyValue] = useState('{}')
  const [saving, setSaving] = useState(false)
  const handle = async (operation: () => PromiseLike<{ error?: { message: string } | null }>, cleanup: () => void) => {
    setSaving(true); onError('')
    try {
      const result = await operation()
      if (result.error) throw new Error(result.error.message)
      cleanup(); await onChanged()
    } catch (err) { onError(errorMessage(err)) } finally { setSaving(false) }
  }
  const pct = (n: number) => learningSummary.reviewed > 0 ? `${Math.round(n / learningSummary.reviewed * 100)}%` : '—'
  return <div className="auto-config-grid">
    <section className="auto-panel auto-config-wide">
      <div className="auto-heading"><div><div className="auto-eyebrow">REVIEW-BASED IMPROVEMENT · NOT AI CONFIDENCE</div><h2>Correction feedback and learning</h2><p>Counts compare the AI's original proposals with human-approved values. They are agreement measures, not independent accuracy probabilities.</p></div></div>
      <div className="auto-info-grid"><div><strong>{learningSummary.reviewed} reviewed</strong><span>Approved documents with feedback</span></div><div><strong>{pct(learningSummary.unchanged)} unchanged</strong><span>Approved without field edits</span></div><div><strong>{pct(learningSummary.gl_unchanged)} GL agreement</strong><span>Original GL retained</span></div><div><strong>{pct(learningSummary.amount_unchanged)} amount agreement</strong><span>Original total retained</span></div></div>
      <p className="auto-footnote">Learning stays within this company. Rules are suggested after at least 3 consistent, approved documents; neither rules nor confidence ever auto-approve or post transactions.</p>
      <h3>Pending vendor rule suggestions ({suggestions.length})</h3>
      {suggestions.length ? <div className="auto-rule-list auto-learning-suggestions">{suggestions.map(rule => <div key={rule.id}>
        <strong>{rule.vendor_name} — GL {rule.proposed_gl_code}</strong>
        <span>{rule.proposed_category} · Tax: {rule.proposed_tax_code} · {rule.support_count} consistent approved documents</span>
        <small>Exact vendor match only. Verify the vendor can be classified consistently.</small>
        <div className="auto-suggestion-buttons"><button className="auto-primary" disabled={busy} onClick={() => void onSuggestionDecision(rule, 'approve')}>Approve rule</button><button className="auto-secondary" disabled={busy} onClick={() => void onSuggestionDecision(rule, 'dismiss')}>Dismiss</button></div>
      </div>)}</div> : <p>No pending suggestions. Suggestions require repeated, conflict-free approved decisions.</p>}
      <p className="auto-footnote">Confidence scoring procedure: <strong>docs/SOP-CF-001_Confidence_Scoring.md</strong> in the project package.</p>
    </section>
    <section className="auto-panel auto-config-wide"><div className="auto-heading"><div><div className="auto-eyebrow">TAX REGISTRATION STATUS</div><h2>Company tax profile</h2><p>Choose the verified registration status. New companies start as Unknown; AI must not infer registration.</p></div></div><select className="auto-tax-select" value={company.tax_regime} disabled={saving} onChange={e => { const selected = e.target.value; void handle(() => supabase.rpc('set_company_tax_regime', { p_company_id: companyId, p_regime: selected }).then(r => ({ error: r.error })), () => { void onCompaniesChanged() }) }}><option value="unknown">Unknown — verify first</option><option value="SST">SST registered (verified)</option><option value="exempt">Not SST registered / exempt (verified)</option></select></section>
    <section className="auto-panel"><div className="auto-heading"><div><div className="auto-eyebrow">APPROVED COMPANY RULES</div><h2>Chart of accounts</h2><p>AI may only suggest GL codes that already exist here.</p></div></div><div className="auto-rule-list">{glCodes.map(g => <div key={g.id}><strong>{g.code}</strong><span>{g.name} · {g.account_type}</span><small>{g.active ? 'Active' : 'Inactive'}</small></div>)}{!glCodes.length && <p>No GL codes yet.</p>}</div><div className="auto-inline-form"><input placeholder="GL code" value={code} onChange={e => setCode(e.target.value)} /><input placeholder="GL account name" value={name} onChange={e => setName(e.target.value)} /><select value={accountType} onChange={e => setAccountType(e.target.value)}>{['Asset','Liability','Equity','Revenue','Expense'].map(t => <option key={t}>{t}</option>)}</select><button className="auto-secondary" disabled={saving || !code.trim() || !name.trim()} onClick={() => void handle(() => supabase.from('gl_codes').insert({ company_id: companyId, code: code.trim(), name: name.trim(), account_type: accountType }).then(r => ({ error: r.error })), () => { setCode(''); setName('') })}><Plus size={14}/>Add GL</button></div></section>
    <section className="auto-panel"><div className="auto-heading"><div><div className="auto-eyebrow">COMPANY-SPECIFIC MATCHING</div><h2>Vendor mappings</h2><p>Store approved mappings only; unknown vendors stay flagged for review.</p></div></div><div className="auto-rule-list">{vendorRules.map(v => <div key={v.id}><strong>{v.vendor_pattern}</strong><span>{v.gl_code} · {v.default_category}</span><small>{v.tax_code}</small></div>)}{!vendorRules.length && <p>No vendor mappings yet.</p>}</div><div className="auto-inline-form"><input placeholder="Vendor name/pattern" value={vendor} onChange={e => setVendor(e.target.value)} /><select value={vendorCode} onChange={e => setVendorCode(e.target.value)}><option value="">Choose GL</option>{glCodes.filter(g => g.active).map(g => <option key={g.code} value={g.code}>{g.code} — {g.name}</option>)}</select><input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} /><input placeholder="Tax code (or N/A)" value={taxCode} onChange={e => setTaxCode(e.target.value)} /><button className="auto-secondary" disabled={saving || !vendor.trim() || !vendorCode || !category.trim() || !taxCode.trim()} onClick={() => void handle(() => supabase.from('vendor_rules').insert({ company_id: companyId, vendor_pattern: vendor.trim(), gl_code: vendorCode, default_category: category.trim(), tax_code: taxCode.trim(), created_by: userId, status: 'approved' }).then(r => ({ error: r.error })), () => { setVendor(''); setVendorCode(''); setCategory(''); setTaxCode('') })}><Plus size={14}/>Add vendor rule</button></div></section>
    <section className="auto-panel auto-config-wide"><div className="auto-heading"><div><div className="auto-eyebrow">REVIEWED POLICY DATA</div><h2>Client policies</h2><p>Structured policy records supplement the single-task Markdown reference. Verify the meaning and currency of every policy before adding it.</p></div></div><div className="auto-rule-list">{policies.map(p => <div key={p.id}><strong>{p.policy_key}</strong><span>{JSON.stringify(p.policy_value)}</span></div>)}{!policies.length && <p>No policies yet; AI must not assume any undocumented policy.</p>}</div><div className="auto-inline-form"><input placeholder="Policy key, e.g. approval_threshold" value={policyKey} onChange={e => setPolicyKey(e.target.value)} /><textarea placeholder='JSON, e.g. {"myr":5000}' value={policyValue} onChange={e => setPolicyValue(e.target.value)} rows={2}/><button className="auto-secondary" disabled={saving || !policyKey.trim()} onClick={() => { let parsed: unknown; try { parsed = JSON.parse(policyValue) } catch { onError('Policy value must be valid JSON.'); return } void handle(() => supabase.from('client_policies').upsert({ company_id: companyId, policy_key: policyKey.trim(), policy_value: parsed, active: true }, { onConflict: 'company_id,policy_key' }).then(r => ({ error: r.error })), () => { setPolicyKey(''); setPolicyValue('{}') }) }}><Plus size={14}/>Save policy</button></div></section>
  </div>
}
