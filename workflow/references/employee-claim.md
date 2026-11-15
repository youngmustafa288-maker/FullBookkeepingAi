# Employee claims

Capture employee, original purchase evidence, business purpose, amount/currency, approval and reimbursement reference. Record the supported expense and employee payable once. A later reimbursement clears that payable instead of creating another expense. Track advances and unused cash separately. Flag personal portions and missing approval.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
