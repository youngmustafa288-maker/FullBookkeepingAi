# Other transactions

Classify bank charges, interest, loan principal/interest, owner funding/drawings, transfers, deposits and other receipts/payments using the client chart. Money in is not automatically sales and money out is not automatically expense. Split compound movements. Preserve unexplained transactions as unresolved; never force an amount into miscellaneous expense or rounding to balance.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
