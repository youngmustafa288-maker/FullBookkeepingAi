# Returns & faulty goods

Open a supplier claim with original invoice and goods receipt links, reason, quantity, photos/inspection evidence and expected resolution. Track returned, awaiting credit, awaiting replacement, replacement received, credit received, refunded or disputed. Do not reduce payable from a claim alone. Require the approved linked supplier credit or refund for financial resolution. Keep replacement receipts separate; do not assume replacement lowers invoice value.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
