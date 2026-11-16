import { useState } from 'react'
import {BookkeepingProvider,useBookkeeping,localMode} from './bookkeeping/context'
import { AppProvider } from './context/AppContext'
import { useAuth } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { Shell } from './components/Shell'
import { Dashboard } from './pages/Dashboard'
import { Workspace } from './pages/Workspace'
import { Accounts } from './pages/Accounts'
import { Reports } from './pages/Reports'
import { ReviewQueue } from './pages/ReviewQueue'
import { AuditLog } from './pages/AuditLog'
import { Configuration } from './pages/Configuration'
import type { PageId, WorkflowId } from './types'
import { Loader2 } from 'lucide-react'

function BookAIApp() {
  const { user, loading, signOut } = useAuth()
  const book=useBookkeeping()
  const [page, setPage] = useState<PageId>('dashboard')
  const [workflow, setWorkflow] = useState<WorkflowId>('invoice')

  if (!localMode && loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f2f1eb' }}>
        <Loader2 size={32} className="spin" style={{ color: '#173b37' }} />
      </div>
    )
  }

  if (!localMode && !user) {
    return <AuthPage />
  }

  if(!book.ready)return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f2f1eb' }}><Loader2 size={32} className="spin" style={{ color: '#173b37' }} /></div>

  if(!book.clients.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f2f1eb', padding: 20 }}>
        <div className="panel" style={{ padding: 32, maxWidth: 540, width: '100%', background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 22, color: '#173b37', marginBottom: 12 }}>Company records unavailable</h2>
          <p style={{ color: '#555', marginBottom: 20, lineHeight: 1.5 }}>
            {book.error || "No company is currently assigned to your account in Supabase."}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button 
              className="btn btn--primary" 
              style={{ background: '#173b37', color: '#fff', padding: '10px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => window.location.reload()}
            >
              Retry Connection
            </button>
            <button 
              className="btn btn--secondary" 
              style={{ background: '#e5eee9', color: '#173b37', padding: '10px 18px', borderRadius: 6, border: '1px solid #c2dbd1', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => {
                localStorage.setItem('bookai-mode', 'local')
                window.location.reload()
              }}
            >
              Load Sample Malaysian Companies
            </button>
          </div>
        </div>
      </div>
    )
  }

  const startWorkflow = (next: WorkflowId) => {
    setWorkflow(next)
    setPage('workspace')
  }

  const renderPage = () => {
    switch (page) {
      case 'workspace': return <Workspace key={workflow+book.activeClientId} workflow={workflow} setWorkflow={setWorkflow} openReports={() => setPage('reports')} />
      case 'accounts': return <Accounts />
      case 'reports': return <Reports />
      case 'review': return <ReviewQueue />
      case 'audit': return <AuditLog />
      case 'configuration': return <Configuration />
      default: return <Dashboard navigate={setPage} startWorkflow={startWorkflow} />
    }
  }

  return <Shell page={page} setPage={setPage} onSignOut={signOut}>{renderPage()}</Shell>
}

export default function App() {
  return <BookkeepingProvider><AppProvider><BookAIApp /></AppProvider></BookkeepingProvider>
}
