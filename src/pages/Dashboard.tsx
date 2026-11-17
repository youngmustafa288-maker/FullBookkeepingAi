import { ArrowRight, BarChart3, Bot, CheckCircle2, CircleDollarSign, CircleDotDashed, FileWarning, HandCoins, Landmark, ScanLine, ShoppingCart, Sparkles, Upload, UsersRound, WalletCards } from 'lucide-react'

import { useApp } from '../context/AppContext'
import {useBookkeeping} from '../bookkeeping/context'
import { money } from '../lib/format'
import {closeScheduleFor,closeWindow} from '../lib/closeSchedule'
import type { PageId, WorkflowId, WorkflowModeId } from '../types'
import { Badge } from '../components/Badge'

const workflowIcon: Partial<Record<WorkflowId, typeof Upload>> = {
  receipt: ScanLine,
  invoice: WalletCards,
  'bank-reconciliation': Landmark,
  reporting: Sparkles,
}

export function Dashboard({ navigate, startWorkflow }: { navigate: (page: PageId) => void; startWorkflow: (workflow: WorkflowModeId) => void }) {
  const { clients, activeClientId, records, reviews, audit } = useApp()
  const {state}=useBookkeeping()
  const client = clients.find((item) => item.id === activeClientId)!
  const clientRecords = records.filter((item) => item.clientId === activeClientId)
  const clientReviews = reviews.filter((item) => item.clientId === activeClientId)
  const payables = clientRecords.filter((item) => item.type === 'Purchase Invoice' && item.status !== 'Paid' && item.status !== 'Draft').filter(item=>!item.currency||item.currency==='MYR').reduce((sum, item) => sum + Math.abs(item.outstanding??item.amount), 0)
  const receivables = clientRecords.filter((item) => item.type === 'Sales Invoice' && item.status !== 'Paid' && item.status !== 'Draft').filter(item=>!item.currency||item.currency==='MYR').reduce((sum, item) => sum + (item.outstanding??item.amount), 0)
  const overdue = clientRecords.filter((item) => item.status === 'Overdue').length
  const clientActivities = audit.filter(item=>item.clientId===activeClientId).slice(0,8).map(a=>({id:a.id,workflow:'invoice' as WorkflowId,description:`${a.action}: ${a.reference}`,status:a.action==='Submitted'?'Pending Approval':a.action,time:new Date(a.timestamp).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})+' MYT'}))
  const close=closeWindow(closeScheduleFor(client),state.closedThrough)
  const closeChecklist=[
    {label:'Purchase & expense records',detail:'Supplier invoices, receipts, utilities and credits uploaded',done:true},
    {label:'Sales & collection records',detail:'Sales invoices and settlement reports uploaded',done:true},
    {label:'Claims & petty cash',detail:'2 staff claim forms still expected',done:false},
    {label:'Payroll inputs',detail:'Payroll summary and statutory proofs due by month-end',done:false},
    {label:'Bank statements',detail:'Monthly statements required for each bank account',done:false},
  ]
  const completed=closeChecklist.filter(item=>item.done).length,outstanding=closeChecklist.length-completed
  const ready=outstanding===0
  const closeStatus=close.daysLeft>0?`${close.daysLeft} days left`:close.daysLeft===0?'Close day':'Overdue'
  const analysisMessage=ready?'Checklist complete. Management analysis is ready.':close.daysLeft>0?`AI is tracking ${outstanding} remaining checklist items before the close.`:`Complete the ${outstanding} remaining checklist items before management analysis.`

  const metrics = [
    { label: 'MYR payables', value: money(payables), detail: 'Outstanding this month', icon: CircleDollarSign, tone: 'danger' },
    { label: 'MYR receivables', value: money(receivables), detail: 'Open customer invoices', icon: WalletCards, tone: 'success' },
    { label: 'Pending review', value: String(clientReviews.length), detail: 'Require your decision', icon: ScanLine, tone: 'warning', action: () => navigate('review') },
    { label: 'Overdue invoices', value: String(overdue), detail: 'Past their due date', icon: FileWarning, tone: 'danger', action: () => navigate('reports') },
  ]

  return (
    <div className="page-stack dashboard-page">
      <section className="page-intro">
        <div><span className="eyebrow">{new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium'}).format(new Date())} · MYT</span><h2>Your bookkeeping overview.</h2><p>Here is the operating picture for {client.name}.</p></div>
      </section>

      <section className="panel close-dashboard-panel">
        <div className="panel__header close-dashboard-header"><div><span className="eyebrow">Month-end close</span><h3>{close.periodLabel} closes on {close.closeLabel}</h3></div><Badge tone={ready?'success':close.daysLeft<=0?'warning':'neutral'}>{ready?'Ready to analyze':closeStatus}</Badge></div>
        <div className="close-dashboard-grid">
          <div className="ai-close-checklist">
            <div className="ai-close-checklist__intro"><span><Bot size={18}/></span><div><strong>AI close checklist</strong><small>{completed} of {closeChecklist.length} items ready</small></div></div>
            <div className="ai-close-checklist__items">{closeChecklist.map(item=><div key={item.label}><span className={item.done?'done':'pending'}>{item.done?<CheckCircle2 size={16}/>:<CircleDotDashed size={16}/>}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></div>)}</div>
          </div>
          <aside className="management-analysis-card"><div className="management-analysis-card__icon"><BarChart3 size={22}/></div><span className="eyebrow">Management analysis</span><h3>{ready?'Ready to analyze':close.daysLeft<=0?'Complete the checklist':'Preparing for close'}</h3><p>{analysisMessage}</p><button className="button button--primary" onClick={()=>navigate('reports')}>Open management analysis<ArrowRight size={15}/></button></aside>
        </div>
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
          <div className="panel__header"><div><span className="eyebrow">Live operations</span><h3>Recent workflow activity</h3></div></div>
          <div className="activity-list">
            {clientActivities.length ? clientActivities.map((activity) => {
              const Icon = workflowIcon[activity.workflow]||Sparkles
              const tone = activity.status === 'Posted' || activity.status === 'Approved' ? 'success' : activity.status === 'Failed' ? 'danger' : 'warning'
              return (
                <button className="activity-item" key={activity.id} onClick={() => activity.status === 'Pending Approval' ? navigate('review') : navigate('reports')}>
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
            <button onClick={() => startWorkflow('purchase-expenses')}><span><ShoppingCart size={18} /></span><div><strong>Purchase &amp; expenses</strong><small>Supplier bills, receipts and credits</small></div><ArrowRight size={15} /></button>
            <button onClick={() => startWorkflow('sales-collections')}><span><WalletCards size={18} /></span><div><strong>Sales &amp; collections</strong><small>Invoices, settlements and payment proofs</small></div><ArrowRight size={15} /></button>
            <button onClick={() => startWorkflow('claims-petty-cash')}><span><HandCoins size={18} /></span><div><strong>Claims &amp; petty cash</strong><small>Staff claims, mileage and travel</small></div><ArrowRight size={15} /></button>
            <button onClick={() => startWorkflow('payroll-inputs')}><span><UsersRound size={18} /></span><div><strong>Payroll inputs</strong><small>Payroll and statutory payment proofs</small></div><ArrowRight size={15} /></button>
            <button onClick={() => startWorkflow('bank-reconciliation')}><span><Landmark size={18} /></span><div><strong>Run bank recon</strong><small>Match statement entries</small></div><ArrowRight size={15} /></button>
          </div>
        </div>
      </section>

    </div>
  )
}
