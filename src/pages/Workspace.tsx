import { useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, BarChart3, Bot, Check, CheckCircle2, ChevronRight, Circle,
  Download, FileSpreadsheet, FileText, Landmark, Mail, MessageSquareText, Paperclip,
  ReceiptText, Send, ShieldCheck, Sparkles, UploadCloud, WalletCards,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { clients } from '../data/mockData'
import type { WorkflowId } from '../types'
import { ConfidenceBadge, Badge } from '../components/Badge'
import { money } from '../lib/format'
import { runOCR, processDocument, fileToBase64 } from '../lib/api'

const workflowMeta: Array<{ id: WorkflowId; name: string; description: string; icon: typeof Bot }> = [
  { id: 'receipt', name: 'SST Accounting', description: 'SST & e-Invoice admin', icon: ReceiptText },
  { id: 'invoice', name: 'Monthly Accounts', description: 'Full set monthly accounts', icon: WalletCards },
  { id: 'bank-reconciliation', name: 'Bank Reconciliation', description: 'Bank & cash reconciliation', icon: Landmark },
  { id: 'reporting', name: 'Management Analysis', description: 'Reports & analysis', icon: BarChart3 },
]

export function Workspace({ workflow, setWorkflow, openReports }: { workflow: WorkflowId; setWorkflow: (workflow: WorkflowId) => void; openReports: () => void }) {
  const { activeClientId, reviews, approveReview } = useApp()
  const client = clients.find((item) => item.id === activeClientId)!
  const [uploaded, setUploaded] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [modelUsed, setModelUsed] = useState('')
  const [message, setMessage] = useState('')
  const [sentMessages, setSentMessages] = useState<string[]>([])
  const [reconStep, setReconStep] = useState(1)
  const [apiError, setApiError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pending = reviews.filter((item) => item.clientId === activeClientId)
  const review = pending.find((item) => item.workflow === workflow) ?? pending[0]
  const ActiveWorkflowIcon = workflowMeta.find((item) => item.id === workflow)?.icon ?? Bot

  const switchWorkflow = (next: WorkflowId) => {
    if (next === workflow) return
    setWorkflow(next)
    setUploaded(false)
    setProcessing(false)
    setSentMessages([])
    setReconStep(1)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setApiError(null)
    setProcessing(true)
    setProcessingStage('Running OCR on your local LM Studio…')

    try {
      // Step 1: OCR via LM Studio
      const base64 = await fileToBase64(file)
      const ocrResult = await runOCR(base64, file.type)
      setProcessingStage('OCR complete. Routing to AI model…')

      // Step 2: Process via model router
      // Use demo context files for now (in production these come from Supabase)
      const clientContext = {
        profile: '# Demo Client\nCurrency: MYR\nTax regime: SST',
        vendors: '# No vendor mappings configured yet',
        glCodes: '# No GL codes configured yet',
        policies: '# No policies configured yet'
      }

      const processResult = await processDocument({
        task: workflow,
        ocrData: ocrResult.data,
        clientContext,
        commonRules: '# Process this document accurately. Return structured JSON with confidence scores.'
      })

      setModelUsed(`${processResult.model_used} (${(processResult.confidence * 100).toFixed(0)}% confidence)`)
      setProcessing(false)
      setUploaded(true)
    } catch (err) {
      setProcessing(false)
      setApiError(err instanceof Error ? err.message : 'Processing failed')
    }
  }

  const sendMessage = () => {
    if (!message.trim()) return
    setSentMessages((current) => [...current, message.trim()])
    setMessage('')
  }

  return (
    <div className="workspace">
      <aside className="workflow-rail">
        <div className="workflow-rail__title"><span className="eyebrow">Runtime mode</span><h3>Choose workflow</h3><p>One task file is loaded at a time.</p></div>
        <div className="workflow-list">
          {workflowMeta.map(({ id, name, description, icon: Icon }) => (
            <button key={id} onClick={() => switchWorkflow(id)} className={workflow === id ? 'active' : ''}>
              <span className="workflow-list__icon"><Icon size={18} /></span>
              <span><strong>{name}</strong><small>{description}</small></span>
              {workflow === id ? <i className="pulse-dot" /> : <ChevronRight size={15} />}
            </button>
          ))}
        </div>
      </aside>

      <section className="thread-panel">
        <div className="thread-panel__header">
          <div><span className="workflow-symbol"><ActiveWorkflowIcon size={19} /></span><div><h3>{workflowMeta.find((item) => item.id === workflow)?.name} workflow</h3><span><i className="status-dot status-dot--connected" /> Ready</span></div></div>
          <Badge tone="neutral">Session BKA-1027</Badge>
        </div>

        {workflow === 'bank-reconciliation' ? (
          <BankRecon step={reconStep} setStep={setReconStep} />
        ) : workflow === 'reporting' ? (
          <ReportingPreview openReports={openReports} />
        ) : (
          <div className="thread-body">
            <div className="message message--workflow">
              <span className="message__avatar"><Bot size={17} /></span>
              <div><p>{workflow === 'receipt'
                ? `Upload structured receipt source files for ${client.name}. I’ll extract the fields, apply approved vendor mappings, and stage every result for review.`
                : `Upload purchase or sales invoices for ${client.name}. I’ll validate dates, line totals, SST and duplicate risk before staging a proposal.`}</p><small>Workflow runtime · now</small></div>
            </div>

            {sentMessages.map((text, index) => <div className="message message--user" key={index}><div><p>{text}</p><small>Maya · now</small></div><span className="message__avatar">MC</span></div>)}

            {!uploaded && !processing && (
              <button className="drop-zone" onClick={() => fileRef.current?.click()}>
                <span className="drop-zone__icon"><UploadCloud size={26} /></span>
                <strong>Drop {workflow === 'invoice' ? 'invoice' : 'receipt'} files here</strong>
                <span>PDF, JPG or PNG · 20 MB maximum · up to 20 files</span>
                <em>Browse files</em>
              </button>
            )}
            <input ref={fileRef} hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} />

            {processing && <div className="processing-card"><span className="processing-orbit"><Sparkles size={20} /></span><div><strong>Processing document</strong><p>{processingStage}</p>{modelUsed && <small style={{ color: 'var(--muted)', marginTop: 4 }}>Model: {modelUsed}</small>}</div><span className="loading-dots"><i /><i /><i /></span></div>}

            {apiError && <div className="notice notice--warning"><AlertTriangle size={17} /><div><strong>Processing error</strong><p>{apiError}</p><small style={{ color: 'var(--muted)' }}>Check that LM Studio is running and your tunnel is active. Also verify your OpenRouter API key in Vercel env vars.</small></div></div>}

            {uploaded && review && (
              <div className="inline-review">
                <header><div><span className="inline-review__icon"><FileText size={19} /></span><div><span className="eyebrow">Staged proposal</span><h3>{review.filename}</h3></div></div><ConfidenceBadge value={review.confidence} /></header>
                {review.warning && <div className="notice notice--warning"><AlertTriangle size={17} /><div><strong>Attention needed</strong><p>{review.warning}</p></div></div>}
                <div className="inline-review__fields">
                  {Object.entries(review.fields).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
                </div>
                <div className="line-preview"><div><span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span></div><div><strong>{workflow === 'invoice' ? 'Operating supplies' : review.party}</strong><span>1</span><span>{money(review.amount)}</span><strong>{money(review.amount)}</strong></div></div>
                <footer><button className="button button--ghost">Edit proposal</button><button className="button button--primary" onClick={() => approveReview(review.id)}><Check size={16} />Approve &amp; post</button></footer>
              </div>
            )}
          </div>
        )}

        {(workflow === 'receipt' || workflow === 'invoice') && (
          <div className="composer">
            <button className="icon-button" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
            <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder={`Ask about this ${workflow} session…`} />
            <button className="send-button" onClick={sendMessage}><Send size={17} /></button>
          </div>
        )}
      </section>

      <aside className="session-panel">
        <div className="session-panel__client"><span className="client-avatar" style={{ background: client.color }}>{client.shortName}</span><div><span className="eyebrow">Active client</span><strong>{client.name}</strong></div></div>
        <div className="session-stats"><div><strong>{uploaded ? 1 : 0}</strong><span>Processed</span></div><div><strong>{pending.length}</strong><span>Pending</span></div><div><strong>0</strong><span>Errors</span></div></div>
      </aside>
    </div>
  )
}

function BankRecon({ step, setStep }: { step: number; setStep: (step: number) => void }) {
  const labels = ['Configure', 'Process', 'Review', 'Difference', 'Post']
  return (
    <div className="recon">
      <div className="recon-steps">{labels.map((label, index) => <div className={step > index ? 'complete' : step === index + 1 ? 'active' : ''} key={label}><span>{step > index + 1 ? <Check size={14} /> : index + 1}</span><strong>{label}</strong></div>)}</div>
      {step === 1 && <div className="recon-card"><span className="eyebrow">Step 1 of 5</span><h2>Upload and configure</h2><p>Select the approved bank adapter and reconciliation period before importing the statement.</p><div className="form-grid"><label><span>Bank adapter</span><select defaultValue="Maybank"><option>Maybank</option><option>CIMB</option><option>RHB</option><option>Public Bank</option></select></label><label><span>Period</span><input defaultValue="01 Oct 2026 — 31 Oct 2026" /></label></div><button className="recon-upload"><FileSpreadsheet size={25} /><strong>maybank-october.csv</strong><span>287 rows recognised · deterministic format match</span></button><button className="button button--primary align-end" onClick={() => setStep(2)}>Start matching<ArrowRight size={16} /></button></div>}
      {step === 2 && <div className="recon-card recon-processing"><span className="processing-orbit"><Landmark size={23} /></span><span className="eyebrow">Processing statement</span><h2>Three ordered stages are running</h2><div className="stage-list"><span className="done"><CheckCircle2 />Normalise 287 statement rows</span><span className="done"><CheckCircle2 />Fetch 342 ledger candidates</span><span className="running"><Sparkles />Score auditable matches</span><span><Circle />Classify exceptions</span></div><button className="button button--primary" onClick={() => setStep(3)}>Show review results</button></div>}
      {step === 3 && <div className="recon-card"><span className="eyebrow">Step 3 of 5</span><h2>Review match proposals</h2><div className="tab-row"><button className="active">Auto-confirmed <em>261</em></button><button>Needs review <em>19</em></button><button>Exceptions <em>7</em></button></div><div className="match-table"><div><span>Bank transaction</span><span>Ledger candidate</span><span>Signals</span><span>Decision</span></div>{[['PETRONAS DAGANG 0810', 'PI-2026-1048', '98%', 'Confirmed'], ['MERIDIAN FOODS 4192', 'SI-2026-0382', '96%', 'Confirmed'], ['OFFICEPRO KLCC', 'RCP-2026-0903', '94%', 'Confirmed']].map((row) => <div key={row[0]}>{row.map((cell, i) => <span key={cell}>{i === 2 ? <Badge tone="success">{cell}</Badge> : i === 3 ? <CheckCircle2 size={17} /> : cell}</span>)}</div>)}</div><button className="button button--primary align-end" onClick={() => setStep(4)}>Continue to difference<ArrowRight size={16} /></button></div>}
      {step === 4 && <div className="recon-card"><span className="eyebrow">Step 4 of 5</span><h2>Difference summary</h2><div className="difference-grid"><div><span>Bank credits</span><strong>RM 128,440.00</strong></div><div><span>Bank debits</span><strong>RM 94,218.40</strong></div><div><span>Confirmed ledger</span><strong>RM 34,221.60</strong></div><div className="difference-zero"><span>Remaining difference</span><strong>RM 0.00</strong><CheckCircle2 size={18} /></div></div><div className="notice notice--success"><ShieldCheck size={18} /><div><strong>Posting gates satisfied</strong><p>All exceptions have a persisted decision and the currency-safe difference equals zero.</p></div></div><button className="button button--primary align-end" onClick={() => setStep(5)}>Review planned writes<ArrowRight size={16} /></button></div>}
      {step === 5 && <div className="recon-card recon-finish"><span className="recon-finish__icon"><ShieldCheck size={28} /></span><span className="eyebrow">Final approval</span><h2>Ready to post reconciliation</h2><p>281 clearance dates and 2 approved fee journals will be written with idempotency keys. Every result will be appended to the audit log.</p><div className="write-summary"><span><strong>281</strong> matches to clear</span><span><strong>2</strong> journals to post</span><span><strong>0</strong> unresolved</span></div><button className="button button--primary"><Check size={16} />Confirm &amp; post</button></div>}
    </div>
  )
}

function ReportingPreview({ openReports }: { openReports: () => void }) {
  return (
    <div className="report-thread">
      <div className="message message--workflow"><span className="message__avatar"><Bot size={17} /></span><div><p>I loaded the October trial balance, profit and loss, balance sheet, and cash flow statement. All source periods and balancing checks passed.</p><small>Reporting workflow · now</small></div></div>
      <div className="report-preview">
        <header><div><span className="eyebrow">Management analysis</span><h2>October 2026</h2></div><Badge tone="success">Source validated</Badge></header>
        <div className="preview-kpis"><div><span>Gross margin</span><strong>42.8%</strong><small>+2.4 pts</small></div><div><span>Net margin</span><strong>13.6%</strong><small>+1.1 pts</small></div><div><span>Current ratio</span><strong>1.84</strong><small>+0.08</small></div></div>
        <div className="summary-quote"><MessageSquareText size={20} /><p>October sales improved while operating costs remained controlled. Cash collection also strengthened, though one older customer balance still needs attention.</p></div>
        <div className="report-preview__footer"><button className="button button--secondary" onClick={openReports}>View full report<ArrowRight size={16} /></button><div><button className="icon-button"><Download size={17} /></button><button className="icon-button"><Mail size={17} /></button><button className="icon-button"><MessageSquareText size={17} /></button></div></div>
      </div>
    </div>
  )
}
