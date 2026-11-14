import { useState, useRef, type DragEvent } from 'react'
import { UploadCloud, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Eye, X, MessageCircle, HelpCircle } from 'lucide-react'
import { clients } from '../data/mockData'
import { useApp } from '../context/AppContext'

type ConfigType = 'glCodes' | 'vendors' | 'policies' | 'profile'

interface UploadedFile {
  name: string
  size: number
  type: string
  status: 'uploading' | 'analyzing' | 'done' | 'error'
  message?: string
}

interface AIQuestion {
  id: string
  question: string
  context: string
  answered: boolean
  answer?: string
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
  const [questions, setQuestions] = useState<AIQuestion[]>([])
  const [preview, setPreview] = useState<{ type: ConfigType; content: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      
      setUploading(prev => prev.map((u, idx) => 
        idx === i ? { ...u, status: 'analyzing' } : u
      ))

      try {
        const base64 = await fileToBase64(file)
        
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
        
        setConfigs(prev => ({
          ...prev,
          ...data.configs
        }))

        // If AI has questions, add them
        if (data.questions && data.questions.length > 0) {
          setQuestions(prev => [...prev, ...data.questions])
        }

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

  const answerQuestion = (questionId: string, answer: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, answered: true, answer } : q
    ))
  }

  const configuredCount = Object.values(configs).filter(c => c).length
  const unansweredQuestions = questions.filter(q => !q.answered)

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

      {/* AI Questions */}
      {unansweredQuestions.length > 0 && (
        <section className="config-questions">
          <div className="config-questions__header">
            <HelpCircle size={20} />
            <div>
              <h3>AI has {unansweredQuestions.length} question{unansweredQuestions.length > 1 ? 's' : ''}</h3>
              <p>AI needs clarification on some items from your documents</p>
            </div>
          </div>
          <div className="config-questions__list">
            {unansweredQuestions.map(q => (
              <QuestionCard key={q.id} question={q} onAnswer={(answer) => answerQuestion(q.id, answer)} />
            ))}
          </div>
        </section>
      )}

      {/* Extracted Summary */}
      {configuredCount > 0 && (
        <section className="config-extracted">
          <div className="config-extracted__header">
            <CheckCircle2 size={20} />
            <div>
              <h3>Configuration extracted</h3>
              <p>Review what AI extracted from your documents</p>
            </div>
          </div>
          <div className="config-extracted__items">
            {configs.profile && (
              <div className="config-extracted__item">
                <span>Business Profile</span>
                <button className="button button--ghost" onClick={() => setPreview({ type: 'profile', content: configs.profile })}>
                  <Eye size={14} /> Review
                </button>
              </div>
            )}
            {configs.glCodes && (
              <div className="config-extracted__item">
                <span>Chart of Accounts</span>
                <button className="button button--ghost" onClick={() => setPreview({ type: 'glCodes', content: configs.glCodes })}>
                  <Eye size={14} /> Review
                </button>
              </div>
            )}
            {configs.vendors && (
              <div className="config-extracted__item">
                <span>Vendor Mappings</span>
                <button className="button button--ghost" onClick={() => setPreview({ type: 'vendors', content: configs.vendors })}>
                  <Eye size={14} /> Review
                </button>
              </div>
            )}
            {configs.policies && (
              <div className="config-extracted__item">
                <span>Policies & Rules</span>
                <button className="button button--ghost" onClick={() => setPreview({ type: 'policies', content: configs.policies })}>
                  <Eye size={14} /> Review
                </button>
              </div>
            )}
          </div>
          <button className="button button--primary" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}>
            Approve All
          </button>
        </section>
      )}

      <div className="config-learning-note">
        <ShieldCheck size={17} />
        <span>
          <strong>AI learns from your records.</strong> Upload previous accounting exports and AI will extract GL codes, vendor mappings, and business rules automatically. 
          If anything is unclear, AI will ask you for clarification. Every approved transaction in the Review Queue also teaches the AI more about your business.
        </span>
      </div>

      {preview && (
        <div className="modal-backdrop" onMouseDown={() => setPreview(null)}>
          <div className="modal" onMouseDown={e => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="eyebrow">AI-generated configuration</span>
                <h2>{preview.type === 'profile' ? 'Business Profile' : preview.type === 'glCodes' ? 'Chart of Accounts' : preview.type === 'vendors' ? 'Vendor Mappings' : 'Policies & Rules'}</h2>
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

function QuestionCard({ question, onAnswer }: { question: AIQuestion; onAnswer: (answer: string) => void }) {
  const [answer, setAnswer] = useState('')

  return (
    <div className="config-question-card">
      <div className="config-question-card__content">
        <div className="config-question-card__icon">
          <MessageCircle size={16} />
        </div>
        <div>
          <p className="config-question-card__context">{question.context}</p>
          <p className="config-question-card__question">{question.question}</p>
        </div>
      </div>
      <div className="config-question-card__answer">
        <input
          type="text"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type your answer..."
        />
        <button 
          className="button button--primary"
          onClick={() => { onAnswer(answer); setAnswer('') }}
          disabled={!answer.trim()}
        >
          Answer
        </button>
      </div>
    </div>
  )
}
