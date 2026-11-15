import { useAuth } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { AutomationLayer } from './pages/AutomationLayer'
import { Loader2 } from 'lucide-react'

/** Live automation application. Legacy mock-ledger screens are no longer routed. */
export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="spin" size={30} /></div>
  return user ? <AutomationLayer /> : <AuthPage />
}
