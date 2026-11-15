import { useState, useRef, useEffect } from 'react'
import { Bot, Send, X, Loader2, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'


interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ConfigChatProps {
  configType: 'glCodes' | 'vendors' | 'policies' | 'profile'
  existingConfig: string
  onSave: (markdown: string) => void
  onClose: () => void
}

const INITIAL_MESSAGES: Record<string, string> = {
  profile: "Hi! I'll help set up your business profile. Tell me about your company - what industry are you in, and what's your business structure (sole proprietorship, Sdn Bhd, etc.)?",
  glCodes: "Let's set up your chart of accounts. What are your main revenue streams? And what are your biggest expense categories?",
  vendors: "I'll help map your vendors to the right GL codes. Who are your main suppliers? What do you typically buy from them?",
  policies: "Let's define your approval policies. Are there any transaction amounts that should require special approval? Any specific review requirements?"
}

export function ConfigChat({ configType, existingConfig, onSave, onClose }: ConfigChatProps) {
  const { clients, activeClientId } = useApp()
  const client = clients.find(c => c.id === activeClientId)!
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: INITIAL_MESSAGES[configType], timestamp: new Date() }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedMarkdown, setGeneratedMarkdown] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Call API to generate/update config
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'conversation',
          configType,
          clientId: activeClientId,
          conversation: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          existingConfig
        })
      })

      if (!response.ok) throw new Error('Failed to generate')

      const data = await response.json()
      
      // Show AI response
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.markdown,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setGeneratedMarkdown(data.markdown)

    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I encountered an error. Could you try rephrasing that?",
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    profile: 'Business Profile',
    glCodes: 'Chart of Accounts',
    vendors: 'Vendor Mappings',
    policies: 'Policies & Rules'
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal config-chat-modal" onMouseDown={e => e.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">Configure with AI</span>
            <h2>{titles[configType]}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              {client.name}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="config-chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`config-chat-message config-chat-message--${msg.role}`}>
              <div className="config-chat-message__avatar">
                {msg.role === 'assistant' ? <Bot size={16} /> : client.shortName}
              </div>
              <div className="config-chat-message__content">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                  {msg.content}
                </pre>
                <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  {msg.timestamp.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                </small>
              </div>
            </div>
          ))}
          {loading && (
            <div className="config-chat-message config-chat-message--assistant">
              <div className="config-chat-message__avatar">
                <Loader2 size={16} className="spin" />
              </div>
              <div className="config-chat-message__content">
                <span className="loading-dots"><i /><i /><i /></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {generatedMarkdown && (
          <div className="config-chat-preview">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={16} />
              <strong style={{ fontSize: '13px' }}>Generated Configuration</strong>
            </div>
            <pre style={{ 
              fontSize: '12px', 
              maxHeight: '200px', 
              overflow: 'auto',
              background: 'var(--canvas)',
              padding: '12px',
              borderRadius: '8px',
              margin: 0
            }}>
              {generatedMarkdown}
            </pre>
          </div>
        )}

        <div className="config-chat-input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Describe your business..."
            disabled={loading}
          />
          <button 
            className="send-button" 
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            <Send size={17} />
          </button>
        </div>

        <footer>
          {generatedMarkdown && (
            <button className="button button--primary" onClick={() => onSave(generatedMarkdown)}>
              Save Configuration
            </button>
          )}
          <button className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
