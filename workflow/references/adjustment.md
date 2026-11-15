# Credits & refunds

Identify sales credit, purchase credit, customer refund or supplier refund. Link original invoice/payment and same party/currency, reason, dates and approved evidence. A credit changes the invoice value; a refund returns cash. Prevent credits beyond the original and refunds beyond available unallocated funds. If the invoice was paid, unallocate the excess before applying the credit and retain the actual payment history. Do not generate a second invoice-value reduction for a cash refund.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
