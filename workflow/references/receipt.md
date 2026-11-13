# Receipt Workflow

Use only for structured receipt OCR JSON.

## Required input

Require `company_id`, `bookkeeper_id`, `session_id`, `job_id`, `document_id`, source filename, and structured Mistral OCR JSON. Optional input may include approved client-specific mappings from `vendor_rules`.

If given a raw PDF or image, stop and return `ocr_required`.

## Process

1. Preserve the input as immutable `raw_ocr`.
2. Extract merchant name, transaction date, total amount, available line items, payment method, and currency.
3. Assign each extracted field an integer confidence from 0 through 100.
4. Validate that amount is numeric and positive, date is parseable, and currency is MYR or a recognized ISO 4217 code.
5. Warn on failed validation and every field below 80 confidence.
6. Classify the expense as exactly one of:
   - `meals_and_entertainment`
   - `transport`
   - `utilities`
   - `office_supplies`
   - `professional_fees`
   - `other`
7. Prefer an approved `vendor_rules` mapping for this company. Otherwise infer from merchant and line items. Do not create or update a rule.
8. Stage the proposal in `extracted_documents` with `pending_review` status.
9. Return a review object with immutable OCR, proposed fields, per-field confidence, category, mapping source, warnings, `requires_review: true`, and `posting_allowed: false`.

## Post only after approval

On a separate request, post an expense only if the staging record is `approved`, `final_fields` contains all corrections, a distinct later approval audit event exists, identifiers match, and an idempotency key is supplied. Otherwise return `approval_required` without writing.

Log the successful write with original OCR and final values.

## Do not

- Do not process invoices or bank statements.
- Do not perform OCR, reconciliation, or reporting.
- Do not auto-approve or silently change extracted values.
