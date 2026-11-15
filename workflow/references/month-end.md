# Month-end review

Confirm opening TB and complete bank/cash/card/settlement accounts, AR/AP, inventory, fixed assets, payroll summaries, loans and related parties. Reconcile subledgers to controls. Prepare evidence-backed accruals, prepayments, depreciation and FX proposals with balanced debits/credits and reversal policy. Check cutoff, unresolved claims, duplicate entries and missing documents. A workflow date lock is an operational lock only; require a reviewer to confirm completeness and ledger reconciliation before closing.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
