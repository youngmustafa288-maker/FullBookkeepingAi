# Expense receipts

Extract receipt lines, merchant, date, currency, payment method and evidence. Separate business/private portions, cost versus asset and tax treatment. Check whether a supplier bill already represents this purchase before recognising an expense. For cash purchases record one economic event with its settlement. Preserve missing evidence and unclear OCR for review.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
