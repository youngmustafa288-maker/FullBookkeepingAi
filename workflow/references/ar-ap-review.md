# Customer/supplier statements

Reconstruct historical open invoices, credits, allocations and advances as of the chosen date. Use only transactions effective by that date, keeping subsequent receipts/payments separate. Compare customer/supplier statements line by line, separating disputes, missing documents and unmatched credits. Age by supported contractual due date with a missing-due-date bucket. Reconcile controls to GL when provided. Do not net unrelated parties or silently write off small balances.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
