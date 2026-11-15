import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BookOpen, Loader2 } from 'lucide-react'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (isSignUp) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, fullName)
      if (error) {
        setError(error)
      } else {
        setSignUpSuccess(true)
      }
    } else {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    }

    setLoading(false)
  }

  if (signUpSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo"><BookOpen size={28} /></div>
            <h1>BookAI</h1>
          </div>
          <div className="auth-success">
            <h2>Check your email</h2>
            <p>We've sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account, then come back and sign in.</p>
            <button className="button button--primary" onClick={() => { setIsSignUp(false); setSignUpSuccess(false) }}>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><BookOpen size={28} /></div>
          <h1>BookAI</h1>
          <p>AI-powered bookkeeping operations</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>{isSignUp ? 'Create account' : 'Sign in'}</h2>

          {error && <div className="auth-error">{error}</div>}

          {isSignUp && (
            <label className="auth-field">
              <span>Full name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
              required
            />
          </label>

          <button type="submit" className="button button--primary auth-submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {isSignUp ? 'Create account' : 'Sign in'}
          </button>

          <div className="auth-toggle">
            {isSignUp ? (
              <span>Already have an account? <button type="button" onClick={() => setIsSignUp(false)}>Sign in</button></span>
            ) : (
              <span>Don't have an account? <button type="button" onClick={() => setIsSignUp(true)}>Create one</button></span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
