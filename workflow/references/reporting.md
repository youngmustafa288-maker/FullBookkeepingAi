# Reports & export

Produce source-linked open items, allocations, goods claims, bank exceptions and activity exports from approved data. For P&L, balance sheet, TB or cash flow require the actual complete ledger/openings and applicable framework; do not derive full accounts from an invoice list. Separate operational dashboard totals from accounting financial statements. Preserve currencies separately. Label drafts and unresolved control differences.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
