import { useState } from 'react'
import { MessageSquare, FileText, TrendingUp, Users, Settings, ShieldCheck } from 'lucide-react'
import { clients } from '../data/mockData'
import { useApp } from '../context/AppContext'
import { ConfigChat } from '../components/ConfigChat'

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

export function Configuration() {
  const { activeClientId } = useApp()
  const client = clients.find(c => c.id === activeClientId)!
  const [chatConfig, setChatConfig] = useState<ConfigType | null>(null)
  const [configs, setConfigs] = useState<Record<ConfigType, string>>({
    profile: '',
    glCodes: '',
    vendors: '',
    policies: ''
  })

  // Mock data - in production this comes from Supabase
  const summaries: ConfigSummary[] = [
    {
      type: 'profile',
      title: 'Business Profile',
      description: 'Company details, industry, and tax registration',
      icon: FileText,
      stats: {
        lastUpdated: configs.profile ? '2 days ago' : 'Not configured',
        details: configs.profile ? 'Retail business, SST registered' : undefined
      }
    },
    {
      type: 'glCodes',
      title: 'Chart of Accounts',
      description: 'GL codes for tracking transactions',
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
      description: 'Approved vendors and their default GL codes',
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
      description: 'Approval thresholds and review requirements',
      icon: Settings,
      stats: {
        lastUpdated: configs.policies ? '5 days ago' : 'Not configured',
        details: configs.policies ? 'RM 5,000 approval threshold' : undefined
      }
    }
  ]

  const handleSave = (type: ConfigType, markdown: string) => {
    setConfigs(prev => ({ ...prev, [type]: markdown }))
    setChatConfig(null)
  }

  const configuredCount = Object.values(configs).filter(c => c).length

  return (
    <div className="page-stack">
      <section className="page-intro page-intro--compact">
        <div>
          <span className="eyebrow">Client configuration</span>
          <h2>Business setup</h2>
          <p>Configure {client.name}'s accounting rules with AI assistance.</p>
        </div>
        <div className="scope-pill">
          <span className="client-avatar" style={{ background: client.color }}>{client.shortName}</span>
          <span>
            <strong>{client.name}</strong>
            <small>{configuredCount}/4 configured</small>
          </span>
        </div>
      </section>

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

              <button 
                className="button button--secondary config-card__button"
                onClick={() => setChatConfig(summary.type)}
              >
                <MessageSquare size={15} />
                {isConfigured ? 'Edit with AI' : 'Configure with AI'}
              </button>
            </article>
          )
        })}
      </section>

      <div className="config-learning-note">
        <ShieldCheck size={17} />
        <span>
          <strong>AI learns automatically.</strong> Every time you approve a transaction in the Review Queue, 
          the AI captures vendor mappings and GL codes to improve future extractions.
        </span>
      </div>

      {chatConfig && (
        <ConfigChat
          configType={chatConfig}
          existingConfig={configs[chatConfig]}
          onSave={(markdown) => handleSave(chatConfig, markdown)}
          onClose={() => setChatConfig(null)}
        />
      )}
    </div>
  )
}
