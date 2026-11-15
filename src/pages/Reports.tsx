import { useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Download, Mail, MessageSquareText, Send, X } from 'lucide-react'
import { clients } from '../data/mockData'
import { useApp } from '../context/AppContext'
import { money } from '../lib/format'
import { Badge } from '../components/Badge'

const tabs = ['Trial Balance', 'Profit & Loss', 'Balance Sheet', 'Cash Flow', 'Management Analysis']
const kpis = [
  { label: 'Gross margin', value: '42.8%', prior: '40.4%', trend: '+2.4 pts', good: true },
  { label: 'Net margin', value: '13.6%', prior: '12.5%', trend: '+1.1 pts', good: true },
  { label: 'Current ratio', value: '1.84', prior: '1.76', trend: '+0.08', good: true },
  { label: 'Debt to equity', value: '0.62', prior: '0.68', trend: '−0.06', good: true },
  { label: 'AR days', value: '38', prior: '44', trend: '−6 days', good: true },
  { label: 'AP days', value: '31', prior: '29', trend: '+2 days', good: false },
]

const statements: Record<string, Array<[string, number, number, boolean?]>> = {
  'Trial Balance': [['Cash and bank', 84218, 0], ['Trade receivables', 48620, 0], ['Inventory', 66140, 0], ['Trade payables', 0, 42180], ['Share capital', 0, 100000], ['Retained earnings', 0, 56800], ['Total', 198978, 198980, true]],
  'Profit & Loss': [['Revenue', 148420, 134800], ['Cost of sales', -84900, -80340], ['Gross profit', 63520, 54460, true], ['Operating expenses', -43336, -37610], ['Net profit', 20184, 16850, true]],
  'Balance Sheet': [['Cash and equivalents', 84218, 78110], ['Trade receivables', 48620, 52140], ['Inventory', 66140, 63720], ['Total assets', 198978, 193970, true], ['Total liabilities', 42180, 45620], ['Total equity', 156798, 148350], ['Liabilities and equity', 198978, 193970, true]],
  'Cash Flow': [['Operating cash flow', 26292, 18340], ['Investing cash flow', -4200, -9800], ['Financing cash flow', 0, 0], ['Net movement in cash', 22092, 8540, true], ['Closing cash balance', 84218, 62126, true]],
}

export function Reports() {
  const { activeClientId } = useApp()
  const client = clients.find((item) => item.id === activeClientId)!
  const [tab, setTab] = useState('Management Analysis')
  const [modal, setModal] = useState<'email' | 'whatsapp' | 'schedule' | null>(null)

  return (
    <div className="page-stack reports-page">
      <section className="page-intro page-intro--compact"><div><span className="eyebrow">October 2026</span><h2>Financial reports</h2><p>Validated live records and generated analysis for {client.name}.</p></div><div className="page-actions"><button className="button button--primary"><Download size={16} />Download PDF</button></div></section>
      <div className="report-controls"><div className="report-tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div><label><span>Reporting period</span><select defaultValue="oct"><option value="oct">October 2026</option><option>September 2026</option></select></label></div>
      {tab === 'Management Analysis' ? (
        <div className="analysis-stack">
          <section className="kpi-grid">{kpis.map((kpi) => <div className="kpi-card" key={kpi.label}><div><span>{kpi.label}</span>{kpi.good ? <ArrowUpRight className="positive" /> : <ArrowDownRight className="negative" />}</div><strong>{kpi.value}</strong><small>Sep {kpi.prior}<em className={kpi.good ? 'positive' : 'negative'}>{kpi.trend}</em></small></div>)}</section>
          <section className="panel variance-panel"><div className="panel__header"><div><span className="eyebrow">Largest movements</span><h3>Month-on-month variance</h3></div><Badge tone="neutral">Generated analysis</Badge></div><div className="variance-table"><div><span>Line item</span><span>This month</span><span>Last month</span><span>Change</span><span>Change %</span></div>{[
            ['Retail sales', 148420, 134800, 13620, '10.1%'], ['Inventory purchases', 84900, 80340, 4560, '5.7%'], ['Professional fees', 12800, 9420, 3380, '35.9%'], ['Delivery costs', 6210, 7320, -1110, '−15.2%'], ['Utilities', 4580, 3890, 690, '17.7%'],
          ].map((row) => <div className={Math.abs(parseFloat(String(row[4]))) > 10 ? 'highlight' : ''} key={String(row[0])}><strong>{row[0]}</strong><span>{money(Number(row[1]))}</span><span>{money(Number(row[2]))}</span><span className={Number(row[3]) >= 0 ? 'positive' : 'negative'}>{money(Number(row[3]))}</span><span>{row[4]}</span></div>)}</div></section>
          <div className="analysis-grid">
            <section className="panel anomaly-panel"><div className="panel__header"><div><span className="eyebrow">Attention</span><h3>Anomaly flags</h3></div><Badge tone="warning">2 flags</Badge></div><div className="anomaly-list"><button><span><AlertTriangle size={17} /></span><div><strong>Older customer balance</strong><p>Kinta Hardware has been outstanding for 41 days, above the recent collection pattern.</p></div></button><button><span><AlertTriangle size={17} /></span><div><strong>Professional fees increased</strong><p>Professional fees rose RM 3,380 month on month. No cause is asserted without supporting evidence.</p></div></button></div></section>
            <section className="panel executive-panel"><div className="panel__header"><div><span className="eyebrow">Owner-ready copy</span><h3>Executive summary</h3></div></div><blockquote>October sales improved while day-to-day costs remained controlled, resulting in a stronger profit for the month. Cash collection also improved, although one older customer balance should be followed up. The business remains able to cover its near-term commitments.</blockquote><span className="analysis-label">AI-generated analysis grounded in October records</span></section>
          </div>
          <section className="delivery-bar"><div><span className="eyebrow">Delivery</span><h3>Share after review</h3></div><div><button className="button button--secondary"><Download size={16} />PDF report</button><button className="button button--secondary" onClick={() => setModal('email')}><Mail size={16} />Email</button><button className="button button--secondary" onClick={() => setModal('whatsapp')}><MessageSquareText size={16} />WhatsApp summary</button><button className="button button--secondary" onClick={() => setModal('schedule')}><CalendarClock size={16} />Schedule</button></div></section>
        </div>
      ) : <StatementTable title={tab} rows={statements[tab]} />}
      {modal && <DeliveryModal type={modal} close={() => setModal(null)} clientName={client.name} />}
    </div>
  )
}

function StatementTable({ title, rows }: { title: string; rows: Array<[string, number, number, boolean?]> }) {
  return <section className="panel statement-panel"><div className="statement-title"><div><span className="eyebrow">For the month ended 31 October 2026</span><h2>{title}</h2></div><Badge tone="success">Balanced</Badge></div><div className="statement-table"><div><span>Account</span><span>October 2026</span><span>September 2026</span><span>Movement</span></div>{rows.map(([name, current, prior, total]) => <div className={total ? 'total' : ''} key={name}><span>{name}</span><span>{money(current)}</span><span>{money(prior)}</span><span>{prior === 0 ? '—' : `${(((current - prior) / Math.abs(prior)) * 100).toFixed(1)}%`}</span></div>)}</div></section>
}

function DeliveryModal({ type, close, clientName }: { type: 'email' | 'whatsapp' | 'schedule'; close: () => void; clientName: string }) {
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Review before delivery</span><h2>{type === 'email' ? 'Email report' : type === 'whatsapp' ? 'WhatsApp summary' : 'Schedule delivery'}</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></header><div className="modal__body"><label><span>Recipient</span><input defaultValue={type === 'whatsapp' ? '+60 12-884 1288' : 'owner@example.com'} /></label>{type === 'schedule' ? <><label><span>Day of month</span><select><option>5th day</option><option>10th day</option></select></label><label><span>Channel</span><select><option>Email with PDF</option><option>WhatsApp summary</option></select></label></> : <label><span>{type === 'email' ? 'Message' : 'Summary preview'}</span><textarea defaultValue={type === 'email' ? `Attached is the October 2026 financial report for ${clientName}.` : 'October sales improved while day-to-day costs remained controlled. Cash collection also strengthened.'} /></label>}<div className="notice notice--info"><Send size={17} /><div><strong>Delivery is logged</strong><p>{type === 'schedule' ? 'Future scheduled deliveries use this persisted consent.' : 'Nothing will be sent until you confirm.'}</p></div></div></div><footer><button className="button button--ghost" onClick={close}>Cancel</button><button className="button button--primary" onClick={close}><Send size={16} />{type === 'schedule' ? 'Save schedule' : 'Confirm & send'}</button></footer></div></div>
}
