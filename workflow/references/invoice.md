# Invoice Workflow

Use only for structured purchase or sales invoice OCR JSON.

## Required input

Require `company_id`, `bookkeeper_id`, `session_id`, `job_id`, `document_id`, source filename, and structured Mistral OCR JSON. If given a raw PDF or image, stop and return `ocr_required`.

## Process

1. Preserve the complete input as immutable `raw_ocr`.
2. Detect `invoice_type` as `purchase` or `sales` from document title, vendor/customer addresses, company address, and layout. Return confidence and supporting evidence.
3. Extract vendor or customer name, invoice number, invoice date, due date, currency, and billing address.
4. Extract every line item's description, quantity, unit price, and line total.
5. Extract subtotal, SST tax code, SST amount, and grand total.
6. Assign every field and line-item cell an integer confidence from 0 through 100.
7. Validate:
   - numeric quantities and monetary values;
   - line total equals quantity times unit price within currency rounding tolerance;
   - line totals reconcile to subtotal and grand total;
   - due date is not before invoice date;
   - SST matches 6% service tax, 10% sales tax, or 0% exempt as declared.
8. Warn on discrepancies and fields below 80 confidence.
9. Query `extracted_documents`, scoped to the company, for the same normalized invoice number and vendor in the preceding 90 days.
10. If a duplicate exists, set `duplicate.block_posting: true`, return its prior reference, and require a persisted explicit bookkeeper override.
11. Stage the proposal in `extracted_documents` with `pending_review` status and return the structured review object with `posting_allowed: false`.

Use `null` plus a warning when evidence is absent. Never fabricate tax codes, dates, invoice numbers, addresses, or amounts.

## Post only after approval

On a separate request, post a purchase or sales invoice only if the staging record is `approved`, corrected `final_fields` exists, a distinct later approval audit event exists, identifiers match, and an idempotency key is supplied. When duplicate blocking is active, also require a persisted override by the bookkeeper.

Log raw OCR, proposed values, corrections, final values, actor, and write result.

## Do not

- Do not process receipts or bank statements.
- Do not perform OCR, reconciliation, reporting, or payment execution.
- Do not bypass SST discrepancies or duplicate blocking.
- Do not auto-approve or silently alter extracted data.
