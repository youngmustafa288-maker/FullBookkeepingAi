# Goods inspection

Capture related purchase, delivery/receipt reference, item identifier, quantities ordered/delivered/accepted/faulty/rejected, inspection date and evidence. Quarantine faulty goods from available stock. Track accepted quantity and replacement obligations separately. Report deliveries without invoices and invoices without acceptance. Do not change the supplier invoice from inspection alone.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
