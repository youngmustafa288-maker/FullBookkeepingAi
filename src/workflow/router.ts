import common from '../../workflow/references/common.md?raw'
import receipt from '../../workflow/references/receipt.md?raw'
import invoice from '../../workflow/references/invoice.md?raw'
import bankReconciliation from '../../workflow/references/bank-reconciliation.md?raw'
import reporting from '../../workflow/references/reporting.md?raw'
import purchaseExpenses from '../../workflow/references/purchase-expenses.md?raw'
import salesCollections from '../../workflow/references/sales-collections.md?raw'
import claimsPettyCash from '../../workflow/references/claims-petty-cash.md?raw'
import payrollInputs from '../../workflow/references/payroll-inputs.md?raw'
import type { WorkflowId } from '../types'

const taskReferences: Record<WorkflowId, string> = {
  receipt,
  invoice,
  'purchase-expenses': purchaseExpenses,
  'sales-collections': salesCollections,
  'claims-petty-cash': claimsPettyCash,
  'payroll-inputs': payrollInputs,
  'bank-reconciliation': bankReconciliation,
  reporting,
}

export interface ClientContextFiles {
  profile: string
  vendors: string
  glCodes: string
  policies: string
}

/** Builds the only context shape accepted by the server-side execution adapter. */
export function buildWorkflowContext(task: WorkflowId, client: ClientContextFiles) {
  return [
    '# Common rules', common,
    `# Selected task: ${task}`, taskReferences[task],
    '# Client profile', client.profile,
    '# Approved vendor mappings', client.vendors,
    '# Allowed GL codes', client.glCodes,
    '# Client policies', client.policies,
  ].join('\n\n---\n\n')
}

export function routeWorkflow(input: { task_type?: string; filename?: string; fields?: Record<string, unknown> }): WorkflowId | 'unsupported_task' {
  const explicit = input.task_type?.toLowerCase()
  if (explicit && explicit in taskReferences) return explicit as WorkflowId
  const signal = `${input.filename ?? ''} ${Object.keys(input.fields ?? {}).join(' ')}`.toLowerCase()
  if (signal.includes('bank') || signal.includes('statement') || signal.includes('recon')) return 'bank-reconciliation'
  if (signal.includes('payroll') || signal.includes('payslip') || signal.includes('epf') || signal.includes('socso') || signal.includes('pcb')) return 'payroll-inputs'
  if (signal.includes('claim') || signal.includes('mileage') || signal.includes('petty')) return 'claims-petty-cash'
  if (signal.includes('sales') || signal.includes('customer') || signal.includes('pos') || signal.includes('marketplace')) return 'sales-collections'
  if (signal.includes('supplier') || signal.includes('purchase') || signal.includes('utility') || signal.includes('invoice') || signal.includes('sst') || signal.includes('due_date') || signal.includes('receipt') || signal.includes('merchant')) return 'purchase-expenses'
  if (signal.includes('trial_balance') || signal.includes('profit') || signal.includes('report')) return 'reporting'
  return 'unsupported_task'
}
