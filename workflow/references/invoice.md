# Supplier bills

Capture supplier invoice and due dates, item quantity, unit price, tax, currency and original document reference. Compare purchase order, goods receipt or service acceptance where available. Identify shortages, mismatched prices and faulty goods without automatically reducing the liability. Record accepted supported credits separately. Never record the supplier payment as a second expense.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
