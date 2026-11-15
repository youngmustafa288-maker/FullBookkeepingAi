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

  const approveReview = async (id: string) => {
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

    // Learn from this approval - extract vendor/GL mappings
    try {
      const vendor = item.party || item.fields.vendor as string
      const glCode = item.fields.glCode as string || item.fields['GL code'] as string
      const category = item.fields.category as string || item.fields.Category as string
      
      if (vendor && glCode) {
        // Call API to learn from this approval
        await fetch('/api/generate-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'learn',
            configType: 'vendors',
            clientId: item.clientId,
            approvedReviews: [{
              vendor,
              category: category || 'Uncategorized',
              glCode,
              amount: item.amount,
              description: item.fields.description as string || item.reference
            }]
          })
        })
      }
    } catch (error) {
      console.error('Failed to learn from approval:', error)
      // Don't block the approval if learning fails
    }
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
