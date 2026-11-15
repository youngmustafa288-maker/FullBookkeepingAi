# Bank matching

Obtain complete statements with opening/closing balances and the book-side cash records for the exact account/currency/period. Validate statement roll-forward. Match payments/receipts rather than invoice recognition entries. Use reference, exact signed amount, account, currency and date; leave ambiguous repeated amounts unresolved. Match each bank row and book cash event once. Report unsupported one-to-many settlements for explicit grouped review. Identify fees, missing entries, transfers and timing differences with evidence. Do not claim a completed bank-to-GL reconciliation from row matching alone.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
