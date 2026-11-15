import { AlertTriangle, Check, ExternalLink, FileText, X } from 'lucide-react'
import type { ReviewItem } from '../types'
import { ConfidenceBadge } from './Badge'
import { money, mytDate } from '../lib/format'

interface ReviewDrawerProps {
  item: ReviewItem | null
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function ReviewDrawer({ item, onClose, onApprove, onReject }: ReviewDrawerProps) {
  if (!item) return null
  const approvalBlocked = Boolean(item.exception)
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Review details">
        <header className="drawer__header">
          <div>
            <span className="eyebrow">Full review</span>
            <h2>{item.reference}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>

        <div className="drawer__body drawer__body--crosscheck">
          <section className="attachment-pane">
            <div className="attachment-pane__header">
              <div><span className="eyebrow">Original attachment</span><strong><FileText size={15} />{item.filename}</strong></div>
              {item.attachmentUrl && <a className="icon-button icon-button--small" href={item.attachmentUrl} target="_blank" rel="noreferrer" aria-label="Open original attachment"><ExternalLink size={15} /></a>}
            </div>
            <AttachmentPreview item={item} />
            <p className="attachment-pane__hint">Cross-check the source on this side against the editable proposal.</p>
          </section>

          <section className="proposal-pane">
            <div className="review-document"><div><span className="eyebrow">Extracted proposal</span><strong>{item.party}</strong></div><ConfidenceBadge value={item.confidence} /></div>
            {item.warning && (
              <div className="notice notice--warning">
                <AlertTriangle size={18} />
                <div><strong>Review required</strong><p>{item.warning}</p></div>
              </div>
            )}
            <section className="drawer-section">
              <div className="section-heading"><h3>Proposed fields</h3><span>Editable before approval</span></div>
              <div className="field-list">
                {Object.entries(item.fields).map(([label, value]) => (
                  <label className="review-field" key={label}>
                    <span>{label}</span>
                    <input defaultValue={value} aria-label={label} />
                  </label>
                ))}
              </div>
            </section>
            <section className="drawer-section compact-grid">
              <div><span className="meta-label">Document date</span><strong>{mytDate(item.date)}</strong></div>
              <div><span className="meta-label">Amount</span><strong>{money(item.amount)}</strong></div>
              <div><span className="meta-label">Workflow</span><strong>{item.workflow.replace('-', ' ')}</strong></div>
              <div><span className="meta-label">Posting</span><strong>{approvalBlocked ? 'Blocked' : 'After approval'}</strong></div>
            </section>
            {approvalBlocked && <p className="form-hint form-hint--danger">Unknown reconciliation exceptions must be resolved before posting. Approval remains disabled.</p>}
          </section>
        </div>

        <footer className="drawer__footer">
          <button className="button button--ghost" onClick={() => { onReject(item.id); onClose() }}><X size={16} />Reject</button>
          <button className="button button--primary" disabled={approvalBlocked} onClick={() => { onApprove(item.id); onClose() }}><Check size={16} />Approve &amp; post</button>
        </footer>
      </aside>
    </div>
  )
}

function AttachmentPreview({ item }: { item: ReviewItem }) {
  if (item.attachmentUrl && item.attachmentMimeType?.startsWith('image/')) {
    return <div className="attachment-preview"><img src={item.attachmentUrl} alt={`Original attachment ${item.filename}`} /></div>
  }
  if (item.attachmentUrl && item.attachmentMimeType === 'application/pdf') {
    return <object className="attachment-preview attachment-preview--pdf" data={item.attachmentUrl} type="application/pdf"><a href={item.attachmentUrl}>Open the original PDF</a></object>
  }

  return (
    <div className={`attachment-preview attachment-preview--facsimile attachment-preview--${item.workflow}`}>
      <article>
        <header><span>{item.workflow === 'receipt' ? 'RECEIPT' : item.workflow === 'invoice' ? 'INVOICE' : 'BANK STATEMENT'}</span><small>Source file preview</small></header>
        <h3>{item.party}</h3>
        <p className="facsimile-ref">{item.reference}</p>
        <div className="facsimile-rule" />
        {Object.entries(item.fields).map(([label, value]) => <div className="facsimile-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        <div className="facsimile-rule" />
        <div className="facsimile-total"><span>Total</span><strong>{money(item.amount)}</strong></div>
        <footer>Captured source · {item.filename}</footer>
      </article>
    </div>
  )
}
