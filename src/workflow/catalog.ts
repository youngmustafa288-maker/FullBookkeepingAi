export const workflows = [
  {
    "id": "sales-invoice",
    "group": "Sales & customers",
    "name": "Customer invoices",
    "description": "Capture customer, invoice reference, supply/invoice/due dates, line amounts, currency and supported tax."
  },
  {
    "id": "customer-receipt",
    "group": "Receipts & payments",
    "name": "Customer collections",
    "description": "Capture payer, receipt/bank reference, value date, currency, gross collection, bank account and supporting evidence."
  },
  {
    "id": "purchase-invoice",
    "group": "Purchases & suppliers",
    "name": "Supplier bills",
    "description": "Capture supplier invoice and due dates, item quantity, unit price, tax, currency and original document reference."
  },
  {
    "id": "supplier-payment",
    "group": "Receipts & payments",
    "name": "Supplier payments",
    "description": "Prepare or record payment evidence, not a bank transfer."
  },
  {
    "id": "expense-receipt",
    "group": "Expenses & claims",
    "name": "Expense receipts",
    "description": "Extract receipt lines, merchant, date, currency, payment method and evidence."
  },
  {
    "id": "employee-claim",
    "group": "Expenses & claims",
    "name": "Employee claims",
    "description": "Capture employee, original purchase evidence, business purpose, amount/currency, approval and reimbursement reference."
  },
  {
    "id": "miscellaneous",
    "group": "Expenses & claims",
    "name": "Other transactions",
    "description": "Classify bank charges, interest, loan principal/interest, owner funding/drawings, transfers, deposits and other receipts/payments using the client chart."
  },
  {
    "id": "goods-receipt",
    "group": "Goods & adjustments",
    "name": "Goods inspection",
    "description": "Capture related purchase, delivery/receipt reference, item identifier, quantities ordered/delivered/accepted/faulty/rejected, inspection date and evidence."
  },
  {
    "id": "purchase-return",
    "group": "Goods & adjustments",
    "name": "Returns & faulty goods",
    "description": "Open a supplier claim with original invoice and goods receipt links, reason, quantity, photos/inspection evidence and expected resolution."
  },
  {
    "id": "adjustment",
    "group": "Goods & adjustments",
    "name": "Credits & refunds",
    "description": "Identify sales credit, purchase credit, customer refund or supplier refund."
  },
  {
    "id": "bank-reconciliation",
    "group": "Reconciliation",
    "name": "Bank matching",
    "description": "Obtain complete statements with opening/closing balances and the book-side cash records for the exact account/currency/period."
  },
  {
    "id": "ar-ap-review",
    "group": "Reconciliation",
    "name": "Customer/supplier statements",
    "description": "Reconstruct historical open invoices, credits, allocations and advances as of the chosen date."
  },
  {
    "id": "sst-review",
    "group": "SST review",
    "name": "SST workpapers",
    "description": "Confirm sales/service/imported-services registration, dates, activities, assigned period and exemptions."
  },
  {
    "id": "month-end",
    "group": "Close & reports",
    "name": "Month-end review",
    "description": "Confirm opening TB and complete bank/cash/card/settlement accounts, AR/AP, inventory, fixed assets, payroll summaries, loans and related parties."
  },
  {
    "id": "reporting",
    "group": "Close & reports",
    "name": "Reports & export",
    "description": "Produce source-linked open items, allocations, goods claims, bank exceptions and activity exports from approved data."
  },
  {"id":"employee-reimbursement","group":"Expenses & claims","name":"Employee reimbursements","description":"Settle approved employee claims without recording the expense twice."}
] as const
export type TaskId = typeof workflows[number]["id"]
