import { useState } from 'react'
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
  const [page, setPage] = useState<PageId>('dashboard')
  const [workflow, setWorkflow] = useState<WorkflowId>('invoice')

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f2f1eb' }}>
        <Loader2 size={32} className="spin" style={{ color: '#173b37' }} />
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  const startWorkflow = (next: WorkflowId) => {
    setWorkflow(next)
    setPage('workspace')
  }

  const renderPage = () => {
    switch (page) {
      case 'workspace': return <Workspace workflow={workflow} setWorkflow={setWorkflow} openReports={() => setPage('reports')} />
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
  return <AppProvider><BookAIApp /></AppProvider>
}
