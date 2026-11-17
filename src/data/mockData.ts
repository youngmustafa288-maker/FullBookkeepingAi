import type { Activity, AuditEvent, Client, GlCode, LedgerRecord, ReviewItem, VendorRule } from '../types'

export const clients: Client[] = [
  { id: 'suria', name: 'Suria Retail Sdn Bhd', shortName: 'SR', color: '#e9a23b', status: 'connected', currency: 'MYR', taxRegime: 'SST', entityNumber: '202001018842', closeSchedule:{financialYearEnd:'31 December',firstPeriod:'2026-11',bookCloseDay:10,cutOffRule:'Include documents dated through the final calendar day',reminderTiming:'7 days before, 3 days before and on close day',lateEntryRule:'Hold for the next open period unless reopening is approved'} },
  { id: 'kl-logistics', name: 'KL Logistics Sdn Bhd', shortName: 'KL', color: '#6ca59a', status: 'connected', currency: 'MYR', taxRegime: 'SST', entityNumber: '201804009221', closeSchedule:{financialYearEnd:'31 December',firstPeriod:'2026-11',bookCloseDay:10,cutOffRule:'Include documents dated through the final calendar day',reminderTiming:'7 days before, 3 days before and on close day',lateEntryRule:'Hold for the next open period unless reopening is approved'} },
  { id: 'nadi', name: 'Nadi Creative Studio', shortName: 'NC', color: '#d37a65', status: 'attention', currency: 'MYR', taxRegime: 'Exempt', entityNumber: '202204012670', closeSchedule:{financialYearEnd:'31 December',firstPeriod:'2026-11',bookCloseDay:10,cutOffRule:'Include documents dated through the final calendar day',reminderTiming:'7 days before, 3 days before and on close day',lateEntryRule:'Hold for the next open period unless reopening is approved'} },
]

export const initialRecords: LedgerRecord[] = [
  { id: 'r1', clientId: 'suria', reference: 'PI-2026-1048', type: 'Purchase Invoice', party: 'Petronas Trading Sdn Bhd', date: '2026-10-08', dueDate: '2026-11-07', amount: -8420, status: 'Pending', postedBy: 'Maya Chen', confidence: 96 },
  { id: 'r2', clientId: 'suria', reference: 'SI-2026-0382', type: 'Sales Invoice', party: 'Meridian Foods Sdn Bhd', date: '2026-10-07', dueDate: '2026-10-21', amount: 12840, status: 'Paid', postedBy: 'BookAI workflow', confidence: 94 },
  { id: 'r3', clientId: 'suria', reference: 'RCP-2026-0911', type: 'Receipt', party: 'Shell Malaysia', date: '2026-10-06', amount: -186.4, status: 'Draft', postedBy: 'BookAI workflow', confidence: 88, warning: 'Payment method requires confirmation.' },
  { id: 'r4', clientId: 'suria', reference: 'SI-2026-0361', type: 'Sales Invoice', party: 'Kinta Hardware', date: '2026-09-02', dueDate: '2026-09-30', amount: 4390, status: 'Overdue', postedBy: 'Maya Chen', confidence: 98 },
  { id: 'r5', clientId: 'suria', reference: 'REC-OCT-01', type: 'Bank Recon', party: 'Maybank • 8842', date: '2026-10-01', amount: 0, status: 'Reconciled', postedBy: 'Maya Chen' },
  { id: 'r6', clientId: 'suria', reference: 'RCP-2026-0903', type: 'Receipt', party: 'OfficePro Malaysia', date: '2026-10-03', amount: -348.2, status: 'Draft', postedBy: 'BookAI workflow', confidence: 97 },
  { id: 'r7', clientId: 'kl-logistics', reference: 'PI-2026-0762', type: 'Purchase Invoice', party: 'TyreMax Services', date: '2026-10-08', dueDate: '2026-11-08', amount: -6120, status: 'Draft', postedBy: 'BookAI workflow', confidence: 92 },
  { id: 'r8', clientId: 'kl-logistics', reference: 'SI-2026-1182', type: 'Sales Invoice', party: 'Maju Distribution', date: '2026-10-05', dueDate: '2026-10-19', amount: 18750, status: 'Pending', postedBy: 'Maya Chen', confidence: 99 },
  { id: 'r9', clientId: 'nadi', reference: 'RCP-2026-0442', type: 'Receipt', party: 'Adobe', date: '2026-10-01', amount: -248.55, status: 'Draft', postedBy: 'BookAI workflow', confidence: 76, warning: 'Foreign currency conversion evidence is missing.' },
]

export const initialReviews: ReviewItem[] = [
  { id: 'q1', clientId: 'suria', workflow: 'receipt', reference: 'RCP-2026-0911', party: 'Shell Malaysia', amount: 186.4, date: '2026-10-06', confidence: 88, queuedAt: '2026-10-10T03:10:00Z', warning: 'Payment method is partially obscured. Confirm before posting.', filename: 'shell-receipt-oct.jpg', fields: { Merchant: 'Shell Malaysia', Date: '6 Oct 2026', Amount: 'RM 186.40', Category: 'Transport', 'Payment method': 'Visa •••• 4219' } },
  { id: 'q2', clientId: 'suria', workflow: 'receipt', reference: 'RCP-2026-0903', party: 'OfficePro Malaysia', amount: 348.2, date: '2026-10-03', confidence: 97, queuedAt: '2026-10-11T01:42:00Z', filename: 'officepro-348-20.pdf', fields: { Merchant: 'OfficePro Malaysia', Date: '3 Oct 2026', Amount: 'RM 348.20', Category: 'Office supplies', 'Payment method': 'Corporate card' } },
  { id: 'q3', clientId: 'kl-logistics', workflow: 'invoice', reference: 'PI-2026-0762', party: 'TyreMax Services', amount: 6120, date: '2026-10-08', confidence: 92, queuedAt: '2026-10-10T20:21:00Z', filename: 'tyremax-inv-762.pdf', fields: { Vendor: 'TyreMax Services', 'Invoice no.': 'TM-7621', Date: '8 Oct 2026', Subtotal: 'RM 5,772.00', SST: 'RM 348.00', Total: 'RM 6,120.00' } },
  { id: 'q4', clientId: 'nadi', workflow: 'receipt', reference: 'RCP-2026-0442', party: 'Adobe', amount: 248.55, date: '2026-10-01', confidence: 76, queuedAt: '2026-10-07T09:00:00Z', warning: 'Foreign currency conversion evidence is missing.', filename: 'adobe-september.pdf', fields: { Merchant: 'Adobe', Date: '1 Oct 2026', Amount: 'USD 59.99', Category: 'Software', 'Payment method': 'Visa •••• 0088' } },
  { id: 'q5', clientId: 'suria', workflow: 'bank-reconciliation', reference: 'MB-2026-10-443', party: 'Unidentified transfer', amount: 1240, date: '2026-10-09', confidence: 42, queuedAt: '2026-10-09T04:30:00Z', warning: 'No defensible ledger candidate was found.', exception: true, filename: 'maybank-october.csv', fields: { Description: 'IBG TRANSFER 440219', Date: '9 Oct 2026', Amount: 'RM 1,240.00', Classification: 'Unknown', Difference: 'RM 1,240.00' } },
  { id: 'q6', clientId: 'kl-logistics', workflow: 'invoice', reference: 'PI-2026-0771', party: 'FleetWorks', amount: 9450, date: '2026-10-09', confidence: 95, queuedAt: '2026-10-11T04:00:00Z', warning: 'Potential duplicate of PI-2026-0702.', filename: 'fleetworks-771.pdf', fields: { Vendor: 'FleetWorks', 'Invoice no.': 'FW-771', Date: '9 Oct 2026', Subtotal: 'RM 8,915.09', SST: 'RM 534.91', Total: 'RM 9,450.00' } },
]

export const initialAudit: AuditEvent[] = [
  { id: 'a1', timestamp: '2026-10-11T05:14:08Z', actor: 'Invoice workflow', actorType: 'AI workflow', action: 'Posted', reference: 'PI-2026-1048', clientId: 'suria', original: '{ total: 8420, confidence: 96 }', final: '{ total: 8420, status: posted }' },
  { id: 'a2', timestamp: '2026-10-11T04:48:31Z', actor: 'Maya Chen', actorType: 'Human', action: 'Approved', reference: 'PI-2026-1048', clientId: 'suria', original: '{ total: 8420 }', final: '{ total: 8420 }' },
  { id: 'a3', timestamp: '2026-10-11T03:23:54Z', actor: 'Receipt workflow', actorType: 'AI workflow', action: 'Edited', reference: 'RCP-2026-0881', clientId: 'suria', original: '{ category: other }', final: '{ category: office_supplies }', note: 'Applied approved vendor mapping.' },
  { id: 'a4', timestamp: '2026-10-10T13:04:11Z', actor: 'Bank reconciliation workflow', actorType: 'AI workflow', action: 'Failed', reference: 'REC-SEP-02', clientId: 'kl-logistics', original: '{ source_rows: 441 }', note: 'Accounting records were temporarily unavailable.' },
  { id: 'a5', timestamp: '2026-10-10T09:55:20Z', actor: 'Maya Chen', actorType: 'Human', action: 'Rejected', reference: 'RCP-2026-0877', clientId: 'suria', original: '{ total: 72.80 }', note: 'Personal expense; do not post.' },
  { id: 'a6', timestamp: '2026-10-09T07:32:03Z', actor: 'Maya Chen', actorType: 'Human', action: 'Voided', reference: 'SI-2026-1011', clientId: 'kl-logistics', original: '{ total: 3200 }', final: '{ status: voided }', note: 'Invoice replaced by credit note.' },
]

export const activities: Activity[] = [
  { id: 'ac1', clientId: 'suria', workflow: 'invoice', description: 'Posted PI-2026-1048 from Petronas Trading', status: 'Posted', time: '12 min ago' },
  { id: 'ac2', clientId: 'suria', workflow: 'receipt', description: 'Extracted receipt from OfficePro Malaysia', status: 'Pending Approval', time: '38 min ago' },
  { id: 'ac3', clientId: 'suria', workflow: 'bank-reconciliation', description: 'Found an unmatched Maybank transfer', status: 'Pending Approval', time: '2 hr ago' },
  { id: 'ac4', clientId: 'suria', workflow: 'reporting', description: 'Generated September management analysis', status: 'Approved', time: '1 day ago' },
]

export const initialVendorRules: VendorRule[] = [
  { id: 'v1', clientId: 'suria', pattern: 'Shell', glCode: '6200', category: 'Transport', taxCode: 'SST-0', source: 'Approved mapping' },
  { id: 'v2', clientId: 'suria', pattern: 'OfficePro', glCode: '6300', category: 'Office supplies', taxCode: 'SST-6', source: 'Approved mapping' },
  { id: 'v3', clientId: 'kl-logistics', pattern: 'TyreMax', glCode: '6410', category: 'Vehicle maintenance', taxCode: 'SST-6', source: 'Manual' },
  { id: 'v4', clientId: 'nadi', pattern: 'Adobe', glCode: '6250', category: 'Software subscriptions', taxCode: 'SST-0', source: 'Manual' },
]

export const initialGlCodes: GlCode[] = [
  { id: 'g1', clientId: 'suria', code: '1100', name: 'Trade receivables', type: 'Asset', active: true },
  { id: 'g2', clientId: 'suria', code: '2100', name: 'Trade payables', type: 'Liability', active: true },
  { id: 'g3', clientId: 'suria', code: '4100', name: 'Retail sales', type: 'Revenue', active: true },
  { id: 'g4', clientId: 'suria', code: '6200', name: 'Travel and transport', type: 'Expense', active: true },
  { id: 'g5', clientId: 'suria', code: '6300', name: 'Office supplies', type: 'Expense', active: true },
  { id: 'g6', clientId: 'kl-logistics', code: '6410', name: 'Vehicle maintenance', type: 'Expense', active: true },
  { id: 'g7', clientId: 'nadi', code: '6250', name: 'Software subscriptions', type: 'Expense', active: true },
]
