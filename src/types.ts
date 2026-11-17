export type PageId =
  | 'dashboard'
  | 'workspace'
  | 'reports'
  | 'review'
  | 'audit'
  | 'configuration'

export type WorkflowId = 'receipt' | 'invoice' | 'bank-reconciliation' | 'reporting'
  | 'purchase-expenses' | 'sales-collections' | 'claims-petty-cash' | 'payroll-inputs'
export type WorkflowModeId = 'purchase-expenses' | 'sales-collections' | 'claims-petty-cash' | 'payroll-inputs' | 'bank-reconciliation'
export type RecordType = 'Purchase Invoice' | 'Sales Invoice' | 'Receipt' | 'Bank Recon' | 'Customer Receipt' | 'Supplier Payment' | 'Employee Claim' | 'Reimbursement' | 'Sales Credit' | 'Supplier Credit' | 'Customer Refund' | 'Supplier Refund' | 'Other Transaction'
export type RecordStatus = 'Paid' | 'Pending' | 'Overdue' | 'Draft' | 'Reconciled' | 'Partial' | 'Unallocated' | 'Approved'

export interface Client {
  id: string
  name: string
  shortName: string
  color: string
  status: 'connected' | 'attention'
  currency: string
  taxRegime: 'SST' | 'Exempt'
  entityNumber: string
  closeSchedule?: CloseSchedule
}

export interface CloseSchedule {
  financialYearEnd: string
  firstPeriod: string
  bookCloseDay: number
  cutOffRule: string
  reminderTiming: string
  lateEntryRule: string
}

export interface LedgerRecord {
  currency?: string
  outstanding?: number
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
  proposalId?: string
  evidence?: string
  currency?: string
  readOnly?: boolean
  actions?: {type:string;payload:Record<string,unknown>}[]
  explanation?: string
  missing?: string[]
  reviewed?: boolean
  reviewNote?: string
  id: string
  clientId: string
  workflow: Exclude<WorkflowId, 'reporting'>
  reference: string
  party: string
  amount: number
  date: string
  confidence: number | null
  queuedAt: string
  warning?: string
  exception?: boolean
  filename: string
  attachmentUrl?: string
  attachmentMimeType?: string
  fields: Record<string, string | number>
}

export type AuditAction = 'Approved' | 'Rejected' | 'Edited' | 'Posted' | 'Voided' | 'Failed' | 'Submitted' | 'Allocated' | 'Matched' | 'Period Closed' | 'Period Reopened'

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
