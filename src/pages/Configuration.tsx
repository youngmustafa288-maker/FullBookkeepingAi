import { useMemo, useState, type DragEvent } from 'react'
import { AlertTriangle, CheckCircle2, Eye, FileText, ShieldCheck, UploadCloud, X } from 'lucide-react'
import { clients } from '../data/mockData'
import { useApp } from '../context/AppContext'
import { Badge } from '../components/Badge'

type ContextKey = 'profile' | 'vendors' | 'glCodes' | 'policies'

interface ContextFile {
  logicalName: string
  uploadedName: string
  content: string
  size: number
  updatedAt: string
}

const slots: Array<{ key: ContextKey; logicalName: string; title: string; description: string }> = [
  { key: 'profile', logicalName: 'profile.md', title: 'Client profile', description: 'Company identity, currency, tax regime and bank adapters.' },
  { key: 'vendors', logicalName: 'vendors.md', title: 'Vendor mappings', description: 'Approved vendor categories, GL codes and tax codes.' },
  { key: 'glCodes', logicalName: 'gl-codes.md', title: 'GL codes', description: 'The active chart-of-accounts subset allowed for this client.' },
  { key: 'policies', logicalName: 'policies.md', title: 'Client policies', description: 'Client-specific review and approval requirements.' },
]

const clientSlugs: Record<string, string> = {
  suria: 'suria-retail-sdn-bhd',
  'kl-logistics': 'kl-logistics-sdn-bhd',
  nadi: 'nadi-creative-studio',
}

const bundledSources = import.meta.glob('../../workflow/clients/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

function initialFiles() {
  return Object.fromEntries(clients.map((client) => {
    const slug = clientSlugs[client.id]
    const files = Object.fromEntries(slots.map((slot) => {
      const content = bundledSources[`../../workflow/clients/${slug}/${slot.logicalName}`] ?? ''
      return [slot.key, {
        logicalName: slot.logicalName,
        uploadedName: slot.logicalName,
        content,
        size: new Blob([content]).size,
        updatedAt: '11 Oct 2026',
      }]
    })) as Record<ContextKey, ContextFile>
    return [client.id, files]
  })) as Record<string, Record<ContextKey, ContextFile>>
}

export function Configuration() {
  const { activeClientId } = useApp()
  const client = clients.find((item) => item.id === activeClientId)!
  const [filesByClient, setFilesByClient] = useState(initialFiles)
  const [preview, setPreview] = useState<ContextFile | null>(null)
  const [error, setError] = useState('')
  const files = filesByClient[activeClientId]
  const completed = useMemo(() => slots.filter((slot) => Boolean(files[slot.key]?.content)).length, [files])

  const saveFile = async (key: ContextKey, file: File) => {
    if (!file.name.toLowerCase().endsWith('.md')) {
      setError('Only Markdown (.md) files are accepted.')
      return
    }
    if (file.size > 512 * 1024) {
      setError('Each Markdown file must be 512 KB or smaller.')
      return
    }
    const content = await file.text()
    setFilesByClient((current) => ({
      ...current,
      [activeClientId]: {
        ...current[activeClientId],
        [key]: {
          logicalName: slots.find((slot) => slot.key === key)!.logicalName,
          uploadedName: file.name,
          content,
          size: file.size,
          updatedAt: new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()),
        },
      },
    }))
    setError('')
  }

  const uploadMany = async (incoming: File[]) => {
    const markdown = incoming.filter((file) => file.name.toLowerCase().endsWith('.md'))
    if (!markdown.length) {
      setError('Drop Markdown (.md) files using the required filenames.')
      return
    }
    const recognized = markdown.map((file) => ({
      file,
      slot: slots.find((item) => item.logicalName === file.name.toLowerCase().replace(/_/g, '-')),
    })).filter((item) => item.slot)
    if (!recognized.length) {
      setError('Use the required filenames: profile.md, vendors.md, gl-codes.md, and policies.md.')
      return
    }
    for (const { file, slot } of recognized) {
      const normalized = file.name.toLowerCase().replace(/_/g, '-')
      if (slot?.logicalName === normalized) await saveFile(slot.key, file)
    }
    if (recognized.length !== incoming.length) setError('Unrecognized files were skipped. Use only the four required Markdown filenames.')
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    void uploadMany(Array.from(event.dataTransfer.files))
  }

  return (
    <div className="page-stack context-upload-page">
      <section className="page-intro page-intro--compact">
        <div>
          <span className="eyebrow">Client configuration</span>
          <h2>Markdown files</h2>
          <p>Upload the four context files used only for {client.name}.</p>
        </div>
        <div className="scope-pill">
          <span className="client-avatar" style={{ background: client.color }}>{client.shortName}</span>
          <span><strong>{client.name}</strong><small>Current client only</small></span>
        </div>
      </section>

      <section className="context-upload-summary">
        <div className="context-upload-summary__copy">
          <span className="context-upload-summary__icon"><UploadCloud size={24} /></span>
          <div><h3>Upload client context</h3><p>Drop all four correctly named files here, or replace them individually.</p></div>
        </div>
        <div className="context-progress"><strong>{completed}/4</strong><span>files ready</span></div>
      </section>

      <div className="context-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <UploadCloud size={24} />
        <div><strong>Drop Markdown files here</strong><span>profile.md · vendors.md · gl-codes.md · policies.md</span></div>
        <label className="button button--secondary">Choose files<input hidden type="file" accept=".md,text/markdown" multiple onChange={(event) => void uploadMany(Array.from(event.target.files ?? []))} /></label>
      </div>

      {error && <div className="notice notice--warning"><AlertTriangle size={17} /><div><strong>Upload not accepted</strong><p>{error}</p></div></div>}

      <section className="context-file-list">
        {slots.map((slot) => {
          const file = files[slot.key]
          return (
            <article className="context-file-row" key={slot.key}>
              <span className="context-file-row__icon"><FileText size={19} /></span>
              <div className="context-file-row__copy">
                <div><h3>{slot.title}</h3><code>{slot.logicalName}</code></div>
                <p>{slot.description}</p>
                <small>{file.uploadedName} · {(file.size / 1024).toFixed(1)} KB · Updated {file.updatedAt}</small>
              </div>
              <Badge tone="success"><CheckCircle2 size={12} />Active</Badge>
              <div className="context-file-row__actions">
                <button className="button button--ghost" onClick={() => setPreview(file)}><Eye size={15} />Preview</button>
                <label className="button button--secondary"><UploadCloud size={15} />Replace<input hidden type="file" accept=".md,text/markdown" onChange={(event) => { const next = event.target.files?.[0]; if (next) void saveFile(slot.key, next) }} /></label>
              </div>
            </article>
          )
        })}
      </section>

      <div className="context-security-note"><ShieldCheck size={17} /><span><strong>Safe context only.</strong> Do not place API keys, credentials, connection URLs, or secrets in these files.</span></div>
      {preview && <MarkdownPreview file={preview} close={() => setPreview(null)} />}
    </div>
  )
}

function MarkdownPreview({ file, close }: { file: ContextFile; close: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal context-preview" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="eyebrow">Markdown preview</span><h2>{file.logicalName}</h2></div><button className="icon-button" onClick={close} aria-label="Close"><X size={18} /></button></header>
        <pre>{file.content}</pre>
        <footer><button className="button button--primary" onClick={close}>Done</button></footer>
      </div>
    </div>
  )
}
