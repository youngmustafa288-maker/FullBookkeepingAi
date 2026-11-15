export type PageId =
  | 'dashboard'
  | 'workspace'
  | 'accounts'
  | 'reports'
  | 'review'
  | 'audit'
  | 'configuration'

export type WorkflowId = 'receipt' | 'invoice' | 'bank-reconciliation' | 'reporting'
export type RecordType = 'Purchase Invoice' | 'Sales Invoice' | 'Receipt' | 'Bank Recon'
export type RecordStatus = 'Paid' | 'Pending' | 'Overdue' | 'Draft' | 'Reconciled'

export interface Client {
  id: string
  name: string
  shortName: string
  color: string
  status: 'connected' | 'attention'
  currency: string
  taxRegime: 'SST' | 'Exempt'
  entityNumber: string
}

export interface LedgerRecord {
  id: string
  clientId: string
  reference: string
  type: RecordType
  party: string
  date: string
  dueDate?: string
  amount: number
  status: RecordStatus
  postedBy: string
  confidence?: number
  warning?: string
}

export interface ReviewItem {
  id: string
  clientId: string
  workflow: Exclude<WorkflowId, 'reporting'>
  reference: string
  party: string
  amount: number
  date: string
  confidence: number
  queuedAt: string
  warning?: string
  exception?: boolean
  filename: string
  attachmentUrl?: string
  attachmentMimeType?: string
  fields: Record<string, string | number>
}

export type AuditAction = 'Approved' | 'Rejected' | 'Edited' | 'Posted' | 'Voided' | 'Failed'

export interface AuditEvent {
  id: string
  timestamp: string
  actor: string
  actorType: 'AI workflow' | 'Human'
  action: AuditAction
  reference: string
  clientId: string
  original: string
  final?: string
  note?: string
}

export interface VendorRule {
  id: string
  clientId: string
  pattern: string
  glCode: string
  category: string
  taxCode: string
  source: 'Approved mapping' | 'Manual'
}

export interface GlCode {
  id: string
  clientId: string
  code: string
  name: string
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  active: boolean
}

export interface Activity {
  id: string
  clientId: string
  workflow: WorkflowId
  description: string
  status: 'Extracted' | 'Pending Approval' | 'Approved' | 'Posted' | 'Failed' | 'Running'
  time: string
}
