# Customer invoices

Capture customer, invoice reference, supply/invoice/due dates, line amounts, currency and supported tax. Check customer/reference/currency duplicates against records. Record the invoice separately from collections. Link later credits and receipts. Preserve due date as missing if unknown. Deliver AR open items and proposed balanced journal lines only when the client chart and recognition evidence support them.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
