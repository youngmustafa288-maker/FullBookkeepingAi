# Customer collections

Capture payer, receipt/bank reference, value date, currency, gross collection, bank account and supporting evidence. Allocate only to approved invoices for the same customer and currency. Support partial receipts, multiple invoices and multiple receipts. Preserve excess as unallocated customer money. Identify deposits and advances without assuming revenue. Match the receipt to the bank separately.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
