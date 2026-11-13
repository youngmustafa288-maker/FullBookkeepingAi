import { ArrowRight, CheckCircle2, CircleDollarSign, FileWarning, Landmark, RefreshCw, ScanLine, Sparkles, Upload, WalletCards } from 'lucide-react'
import { activities, clients } from '../data/mockData'
import { useApp } from '../context/AppContext'
import { money } from '../lib/format'
import type { PageId, WorkflowId } from '../types'
import { Badge } from '../components/Badge'

const workflowIcon: Record<WorkflowId, typeof Upload> = {
  receipt: ScanLine,
  invoice: WalletCards,
  'bank-reconciliation': Landmark,
  reporting: Sparkles,
}

export function Dashboard({ navigate, startWorkflow }: { navigate: (page: PageId) => void; startWorkflow: (workflow: WorkflowId) => void }) {
  const { activeClientId, records, reviews } = useApp()
  const client = clients.find((item) => item.id === activeClientId)!
  const clientRecords = records.filter((item) => item.clientId === activeClientId)
  const clientReviews = reviews.filter((item) => item.clientId === activeClientId)
  const payables = clientRecords.filter((item) => item.type === 'Purchase Invoice' && item.status !== 'Paid').reduce((sum, item) => sum + Math.abs(item.amount), 0)
  const receivables = clientRecords.filter((item) => item.type === 'Sales Invoice' && item.status !== 'Paid').reduce((sum, item) => sum + item.amount, 0)
  const overdue = clientRecords.filter((item) => item.status === 'Overdue').length
  const clientActivities = activities.filter((item) => item.clientId === activeClientId)

  const metrics = [
    { label: 'Total payables', value: money(payables), detail: 'Outstanding this month', icon: CircleDollarSign, tone: 'danger' },
    { label: 'Total receivables', value: money(receivables), detail: 'Open customer invoices', icon: WalletCards, tone: 'success' },
    { label: 'Pending review', value: String(clientReviews.length), detail: 'Require your decision', icon: ScanLine, tone: 'warning', action: () => navigate('review') },
    { label: 'Overdue invoices', value: String(overdue), detail: 'Past their due date', icon: FileWarning, tone: 'danger', action: () => navigate('accounts') },
  ]

  return (
    <div className="page-stack dashboard-page">
      <section className="page-intro">
        <div><span className="eyebrow">11 October 2026 · MYT</span><h2>Good morning, Maya.</h2><p>Here is the operating picture for {client.name}.</p></div>
        <button className="button button--secondary"><RefreshCw size={16} />Refresh records</button>
      </section>

      <section className="metric-grid">
        {metrics.map(({ label, value, detail, icon: Icon, tone, action }) => (
          <button className={`metric-card metric-card--${tone}`} key={label} onClick={action} disabled={!action}>
            <div className="metric-card__top"><span>{label}</span><span className="metric-card__icon"><Icon size={18} /></span></div>
            <strong>{value}</strong><small>{detail}{action && <ArrowRight size={13} />}</small>
          </button>
        ))}
      </section>

      <section className="dashboard-grid">
        <div className="panel activity-panel">
          <div className="panel__header"><div><span className="eyebrow">Live operations</span><h3>Recent workflow activity</h3></div><button className="text-button"><RefreshCw size={14} />Refresh</button></div>
          <div className="activity-list">
            {clientActivities.length ? clientActivities.map((activity) => {
              const Icon = workflowIcon[activity.workflow]
              const tone = activity.status === 'Posted' || activity.status === 'Approved' ? 'success' : activity.status === 'Failed' ? 'danger' : 'warning'
              return (
                <button className="activity-item" key={activity.id} onClick={() => activity.status === 'Pending Approval' ? navigate('review') : navigate('accounts')}>
                  <span className="activity-item__icon"><Icon size={17} /></span>
                  <span className="activity-item__copy"><strong>{activity.description}</strong><small>{activity.time}</small></span>
                  <Badge tone={tone}>{activity.status}</Badge>
                  <ArrowRight size={15} className="activity-item__arrow" />
                </button>
              )
            }) : <div className="mini-empty"><CheckCircle2 size={24} /><strong>No recent activity</strong><span>Start a workflow to see it here.</span></div>}
          </div>
        </div>

        <div className="panel quick-panel">
          <div className="panel__header"><div><span className="eyebrow">Shortcuts</span><h3>Start work</h3></div></div>
          <div className="quick-actions">
            <button onClick={() => startWorkflow('invoice')}><span><Upload size={18} /></span><div><strong>Process invoice</strong><small>Purchase or sales invoice</small></div><ArrowRight size={15} /></button>
            <button onClick={() => startWorkflow('receipt')}><span><ScanLine size={18} /></span><div><strong>Process receipt</strong><small>Extract and categorise</small></div><ArrowRight size={15} /></button>
            <button onClick={() => startWorkflow('bank-reconciliation')}><span><Landmark size={18} /></span><div><strong>Run bank recon</strong><small>Match statement entries</small></div><ArrowRight size={15} /></button>
            <button onClick={() => navigate('review')}><span><CheckCircle2 size={18} /></span><div><strong>Open review queue</strong><small>{clientReviews.length} for this client</small></div><ArrowRight size={15} /></button>
          </div>
        </div>
      </section>
    </div>
  )
}
