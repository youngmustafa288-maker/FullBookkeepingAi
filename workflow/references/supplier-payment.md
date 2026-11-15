# Supplier payments

Prepare or record payment evidence, not a bank transfer. Verify supplier identity and beneficiary changes with the authorised contact. Allocate the payment to approved supplier bills of the same party/currency. Leave underpayments open; retain excess as unallocated supplier money/advance for reviewed presentation. Show payment date, allocations and remaining balance. Do not mark bank-cleared until reconciled.

## Required result
Return extracted_fields, warnings, missing_evidence, proposed_links, proposed_journals and confidence as structured JSON. Use null for unsupported fields. Keep status draft and external_posted false. Load the shared controls and selected client context before applying this task.
