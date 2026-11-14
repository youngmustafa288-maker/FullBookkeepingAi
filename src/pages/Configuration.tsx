import { useState, useRef, type DragEvent } from 'react'
import { UploadCloud, FileText, TrendingUp, Users, Settings, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Eye, X } from 'lucide-react'
import { clients } from '../data/mockData'
import { useApp } from '../context/AppContext'
import { Badge } from '../components/Badge'

type ConfigType = 'glCodes' | 'vendors' | 'policies' | 'profile'

interface ConfigSummary {
  type: ConfigType
  title: string
  description: string
  icon: typeof FileText
  stats: {
    count?: number
    lastUpdated?: string
    details?: string
  }
}

interface UploadedFile {
  name: string
  size: number
  type: string
  status: 'uploading' | 'analyzing' | 'done' | 'error'
  message?: string
}

export function Configuration() {
  const { activeClientId } = useApp()
  const client = clients.find(c => c.id === activeClientId)!
  const [uploading, setUploading] = useState<UploadedFile[]>([])
  const [configs, setConfigs] = useState<Record<ConfigType, string>>({
    profile: '',
    glCodes: '',
    vendors: '',
    policies: ''
  })
  const [preview, setPreview] = useState<{ type: ConfigType; content: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mock data - in production this comes from Supabase
  const summaries: ConfigSummary[] = [
    {
      type: 'profile',
      title: 'Business Profile',
      description: 'Company details and structure',
      icon: FileText,
      stats: {
        lastUpdated: configs.profile ? '2 days ago' : 'Not configured',
        details: configs.profile ? 'Retail business, SST registered' : undefined
      }
    },
    {
      type: 'glCodes',
      title: 'Chart of Accounts',
      description: 'GL codes extracted from previous records',
      icon: TrendingUp,
      stats: {
        count: configs.glCodes ? 45 : 0,
        lastUpdated: configs.glCodes ? '2 days ago' : 'Not configured',
        details: configs.glCodes ? 'Assets, Liabilities, Revenue, Expenses' : undefined
      }
    },
    {
      type: 'vendors',
      title: 'Vendor Mappings',
      description: 'Vendors and their default categories',
      icon: Users,
      stats: {
        count: configs.vendors ? 23 : 0,
        lastUpdated: configs.vendors ? '1 day ago' : 'Not configured',
        details: configs.vendors ? 'Office supplies, software, services' : undefined
      }
    },
    {
      type: 'policies',
      title: 'Policies & Rules',
      description: 'Approval thresholds and requirements',
      icon: Settings,
      stats: {
        lastUpdated: configs.policies ? '5 days ago' : 'Not configured',
        details: configs.policies ? 'RM 5,000 approval threshold' : undefined
      }
    }
  ]

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(f => 
      f.type.includes('pdf') || 
      f.type.includes('spreadsheet') || 
      f.type.includes('excel') ||
      f.name.endsWith('.csv') ||
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls')
    )

    if (validFiles.length === 0) {
      setUploading([{
        name: 'Invalid file',
        size: 0,
        type: 'error',
        status: 'error',
        message: 'Please upload CSV, Excel, or PDF files from your previous accounting system'
      }])
      return
    }

    const newUploads: UploadedFile[] = validFiles.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      status: 'uploading'
    }))

    setUploading(newUploads)

    // Process each file
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      
      // Update status to analyzing
      setUploading(prev => prev.map((u, idx) => 
        idx === i ? { ...u, status: 'analyzing' } : u
      ))

      try {
        // Convert file to base64
        const base64 = await fileToBase64(file)
        
        // Call API to analyze
        const response = await fetch('/api/generate-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentBase64: base64,
            mimeType: file.type,
            fileName: file.name,
            clientId: activeClientId,
            configType: 'all'
          })
        })

        if (!response.ok) {
          throw new Error('Analysis failed')
        }

        const data = await response.json()
        
        // Update configs with AI-generated content
        setConfigs(prev => ({
          ...prev,
          ...data.configs
        }))

        setUploading(prev => prev.map((u, idx) => 
          idx === i ? { 
            ...u, 
            status: 'done', 
            message: `Extracted ${data.summary.glCodesCount} GL codes, ${data.summary.vendorsCount} vendors` 
          } : u
        ))
      } catch (error) {
        setUploading(prev => prev.map((u, idx) => 
          idx === i ? { ...u, status: 'error', message: 'Failed to analyze' } : u
        ))
      }
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const configuredCount = Object.values(configs).filter(c => c).length

  return (
    <div className="page-stack">
      <section className="page-intro page-intro--compact">
        <div>
          <span className="eyebrow">Client configuration</span>
          <h2>Business setup</h2>
          <p>Upload {client.name}'s previous accounting records. AI will analyze them and set up GL codes, vendors, and policies automatically.</p>
        </div>
        <div className="scope-pill">
          <span className="client-avatar" style={{ background: client.color }}>{client.shortName}</span>
          <span>
            <strong>{client.name}</strong>
            <small>{configuredCount}/4 configured</small>
          </span>
        </div>
      </section>

      {/* Upload Section */}
      <section className="config-upload-section">
        <div 
          className="config-dropzone"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          <UploadCloud size={32} />
          <h3>Upload previous accounting records</h3>
          <p>CSV, Excel, or PDF exports from your old system</p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
            Examples: Chart of accounts export, vendor list, trial balance, financial statements, bank statements
          </p>
          <button 
            className="button button--primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.pdf"
            style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {uploading.length > 0 && (
          <div className="config-upload-status">
            {uploading.map((file, i) => (
              <div key={i} className={`config-upload-item config-upload-item--${file.status}`}>
                <div className="config-upload-item__icon">
                  {file.status === 'uploading' && <Loader2 size={16} className="spin" />}
                  {file.status === 'analyzing' && <Loader2 size={16} className="spin" />}
                  {file.status === 'done' && <CheckCircle2 size={16} />}
                  {file.status === 'error' && <AlertTriangle size={16} />}
                </div>
                <div className="config-upload-item__info">
                  <strong>{file.name}</strong>
                  <span>{file.message || (file.status === 'uploading' ? 'Uploading...' : file.status === 'analyzing' ? 'AI is analyzing...' : '')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Generated Configs */}
      {configuredCount > 0 && (
        <section className="config-summary-grid">
          {summaries.map(summary => {
            const Icon = summary.icon
            const isConfigured = Boolean(configs[summary.type])
            
            return (
              <article key={summary.type} className={`config-card ${isConfigured ? 'config-card--configured' : ''}`}>
                <div className="config-card__header">
                  <div className="config-card__icon">
                    <Icon size={20} />
                  </div>
                  <div className="config-card__title">
                    <h3>{summary.title}</h3>
                    <p>{summary.description}</p>
                  </div>
                </div>

                <div className="config-card__stats">
                  {summary.stats.count !== undefined && (
                    <div className="config-stat">
                      <strong>{summary.stats.count}</strong>
                      <span>{summary.type === 'glCodes' ? 'GL codes' : 'vendors'}</span>
                    </div>
                  )}
                  <div className="config-stat">
                    <strong>{summary.stats.lastUpdated}</strong>
                    <span>Last updated</span>
                  </div>
                  {summary.stats.details && (
                    <div className="config-stat config-stat--full">
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {summary.stats.details}
                      </span>
                    </div>
                  )}
                </div>

                {isConfigured && (
                  <button 
                    className="button button--ghost config-card__button"
                    onClick={() => setPreview({ type: summary.type, content: configs[summary.type] })}
                  >
                    <Eye size={15} />
                    Review
                  </button>
                )}
              </article>
            )
          })}
        </section>
      )}

      <div className="config-learning-note">
        <ShieldCheck size={17} />
        <span>
          <strong>AI learns from your records.</strong> Upload previous accounting exports and AI will extract GL codes, vendor mappings, and business rules automatically. 
          Every approved transaction in the Review Queue also teaches the AI more about your business.
        </span>
      </div>

      {preview && (
        <div className="modal-backdrop" onMouseDown={() => setPreview(null)}>
          <div className="modal" onMouseDown={e => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="eyebrow">AI-generated configuration</span>
                <h2>{summaries.find(s => s.type === preview.type)?.title}</h2>
              </div>
              <button className="icon-button" onClick={() => setPreview(null)}>
                <X size={18} />
              </button>
            </header>
            <pre style={{ 
              background: 'var(--canvas)', 
              padding: '16px', 
              borderRadius: '8px', 
              fontSize: '13px',
              maxHeight: '60vh',
              overflow: 'auto',
              margin: 0
            }}>
              {preview.content}
            </pre>
            <footer style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="button button--ghost" onClick={() => setPreview(null)}>
                Close
              </button>
              <button className="button button--primary" onClick={() => setPreview(null)}>
                Approve
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
