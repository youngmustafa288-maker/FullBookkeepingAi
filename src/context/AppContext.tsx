import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { clients, initialAudit, initialGlCodes, initialRecords, initialReviews, initialVendorRules } from '../data/mockData'
import type { AuditEvent, GlCode, LedgerRecord, ReviewItem, VendorRule } from '../types'

interface AppContextValue {
  activeClientId: string
  setActiveClientId: (id: string) => void
  records: LedgerRecord[]
  reviews: ReviewItem[]
  audit: AuditEvent[]
  vendorRules: VendorRule[]
  glCodes: GlCode[]
  approveReview: (id: string) => void
  rejectReview: (id: string, note?: string) => void
  addVendorRule: (rule: Omit<VendorRule, 'id'>) => void
  addGlCode: (code: Omit<GlCode, 'id'>) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientId] = useState(clients[0].id)
  const [records, setRecords] = useState(initialRecords)
  const [reviews, setReviews] = useState(initialReviews)
  const [audit, setAudit] = useState(initialAudit)
  const [vendorRules, setVendorRules] = useState(initialVendorRules)
  const [glCodes, setGlCodes] = useState(initialGlCodes)

  const approveReview = (id: string) => {
    const item = reviews.find((review) => review.id === id)
    if (!item) return
    const now = new Date().toISOString()
    setReviews((current) => current.filter((review) => review.id !== id))
    setRecords((current) => current.map((record) => record.reference === item.reference
      ? { ...record, status: item.workflow === 'bank-reconciliation' ? 'Reconciled' : 'Pending', postedBy: 'Maya Chen' }
      : record))
    setAudit((current) => [
      {
        id: `a-${Date.now()}`,
        timestamp: now,
        actor: 'Maya Chen',
        actorType: 'Human',
        action: 'Approved',
        reference: item.reference,
        clientId: item.clientId,
        original: JSON.stringify(item.fields),
        final: JSON.stringify({ ...item.fields, status: 'approved' }),
      },
      ...current,
    ])
  }

  const rejectReview = (id: string, note = 'Rejected during full review.') => {
    const item = reviews.find((review) => review.id === id)
    if (!item) return
    setReviews((current) => current.filter((review) => review.id !== id))
    setRecords((current) => current.filter((record) => record.reference !== item.reference))
    setAudit((current) => [
      {
        id: `a-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'Maya Chen',
        actorType: 'Human',
        action: 'Rejected',
        reference: item.reference,
        clientId: item.clientId,
        original: JSON.stringify(item.fields),
        note,
      },
      ...current,
    ])
  }

  const addVendorRule = (rule: Omit<VendorRule, 'id'>) => {
    setVendorRules((current) => [...current, { ...rule, id: `v-${Date.now()}` }])
  }

  const addGlCode = (code: Omit<GlCode, 'id'>) => {
    setGlCodes((current) => [...current, { ...code, id: `g-${Date.now()}` }])
  }

  const value = useMemo(() => ({
    activeClientId,
    setActiveClientId,
    records,
    reviews,
    audit,
    vendorRules,
    glCodes,
    approveReview,
    rejectReview,
    addVendorRule,
    addGlCode,
  }), [activeClientId, records, reviews, audit, vendorRules, glCodes])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
