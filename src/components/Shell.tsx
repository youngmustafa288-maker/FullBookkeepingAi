import {useBookkeeping,localMode} from '../bookkeeping/context'
import {
  BarChart3, Bell, BookOpenCheck, Bot, ChevronDown, ClipboardCheck, FileBarChart,
  LayoutDashboard, LogOut, Menu, PanelLeftClose, ReceiptText, Search, Settings2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import type { PageId } from '../types'

const navItems: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'workspace', label: 'Workflow workspace', icon: Bot },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'review', label: 'Review queue', icon: ClipboardCheck },
  { id: 'audit', label: 'Audit log', icon: BookOpenCheck },
  { id: 'configuration', label: 'Client configuration', icon: Settings2 },
]

export function Shell({ page, setPage, onSignOut, children }: { page: PageId; setPage: (page: PageId) => void; onSignOut: () => void; children: ReactNode }) {
  const { clients, activeClientId, setActiveClientId, reviews } = useApp()
  const book = useBookkeeping()
  const { user } = useAuth()
  const [clientOpen, setClientOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeClient = clients.find((client) => client.id === activeClientId) ?? clients[0]
  const pending = reviews.filter((review) => review.clientId === activeClientId).length
  const title = navItems.find((item) => item.id === page)?.label ?? 'BookAI'
  const userInitials = (user?.user_metadata?.full_name || user?.email || 'BK').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const userName = user?.user_metadata?.full_name || user?.email || 'Bookkeeper'

  const navigate = (id: PageId) => {
    setPage(id)
    setMobileOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand__mark"><BarChart3 size={21} strokeWidth={2.4} /></div>
          <div><strong>BookAI</strong><span>Operations ledger</span></div>
          <button className="sidebar-close" onClick={() => setMobileOpen(false)}><PanelLeftClose size={18} /></button>
        </div>

        <div className="client-switcher">
          <span className="client-switcher__label">Active client</span>
          <button className="client-switcher__button" onClick={() => setClientOpen((open) => !open)}>
            <span className="client-avatar" style={{ background: activeClient.color }}>{activeClient.shortName}</span>
            <span><strong>{activeClient.name}</strong><small><i className={`status-dot status-dot--${activeClient.status}`} />{activeClient.status}</small></span>
            <ChevronDown size={16} />
          </button>
          {clientOpen && (
            <div className="client-menu">
              <div className="client-menu__search"><Search size={15} /><input placeholder="Find a client" /></div>
              {clients.map((client) => (
                <button key={client.id} onClick={() => { setActiveClientId(client.id); setClientOpen(false) }} className={client.id === activeClientId ? 'active' : ''}>
                  <span className="client-avatar" style={{ background: client.color }}>{client.shortName}</span>
                  <span>{client.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="nav-list">
          <span className="nav-list__label">Workspace</span>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon size={18} /><span>{label}</span>
              {id === 'review' && pending > 0 && <em>{pending}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="user-card"><span className="user-avatar">{userInitials}</span><span><strong>{userName}</strong><small>Bookkeeper</small></span></div>
          <button className="icon-button icon-button--dark" aria-label="Log out" onClick={onSignOut}><LogOut size={17} /></button>
        </div>
      </aside>

      <div className={`content-shell ${page === 'workspace' ? 'content-shell--workspace' : ''}`}>
        <header className="topbar">
          <div className="topbar__title"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><h1>{title}</h1></div>
          <button className="breadcrumb-pill" onClick={() => setClientOpen((open) => !open)}><i style={{ background: activeClient.color }} />{activeClient.name}<ChevronDown size={14} /></button>
          <div className="topbar__actions">
            <button className="review-pill" onClick={() => navigate('review')}><ReceiptText size={15} />{pending} pending</button>
            <button className="icon-button"><Bell size={18} /><i className="notification-dot" /></button>
            <span className="user-avatar user-avatar--top">{userInitials}</span>
          </div>
        </header>
        <div className="runtime-note">{localMode ? 'Local demonstration workspace · this browser only' : 'Company workspace'} · Approval records operational entries; external ledger posting is not connected.</div>{book.error&&<div className="notice notice--warning" role="alert" style={{margin:12}}>{book.error}</div>}<main className={page === 'workspace' ? 'main main--workspace' : 'main'}>{children}</main>
      </div>
    </div>
  )
}
