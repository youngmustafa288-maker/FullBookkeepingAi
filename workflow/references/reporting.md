# Reporting Workflow

Use only for financial reports, KPI analysis, management commentary, and configured report delivery. This workflow may read accounting data but must never post or alter ledger records.

## Required input

Require `company_id`, `bookkeeper_id`, selected reporting period, and requested output or delivery method. For comparisons, fetch the immediately preceding comparable month.

## Fetch and validate

1. Fetch Trial Balance, Profit and Loss, Balance Sheet, and Cash Flow Statement from the accounting system for the selected company and period.
2. Preserve the source reports and their period metadata.
3. Stop analysis if reports are missing, scoped to a different company or period, or fail basic balancing checks. Return a non-destructive error.

## Compute

Calculate current-period value and month-on-month delta for:

- gross margin percentage;
- net margin percentage;
- current ratio;
- debt-to-equity ratio;
- accounts receivable days;
- accounts payable days.

Use decimal arithmetic, name the inputs used in each calculation, and return `null` with an explanation when a denominator is zero or required data is absent.

Identify the five line items with the largest month-on-month movement. Return current value, prior value, absolute change, percentage change, and an `above_10_percent` flag. Handle zero prior values without an infinite or fabricated percentage.

## Analyze and format

Generate:

1. variance commentary grounded only in fetched values;
2. anomaly flags for unusual transactions, receivables older than 60 days, and material cost spikes;
3. one plain-language executive summary paragraph suitable for an SME owner, without accounting jargon;
4. a structured presentation containing six KPI cards, a five-row variance table, anomaly list, and executive summary.

Clearly label generated commentary as analysis. Never invent causes for a variance; distinguish observed movement from a hypothesis.

## Delivery

Support only:

- in-app PDF download containing the four reports and management analysis;
- email with the PDF attached, after the bookkeeper reviews the editable draft;
- WhatsApp delivery of the executive summary paragraph only, after preview;
- scheduled auto-delivery when a persisted per-client schedule explicitly enables it.

Interactive delivery requires the bookkeeper's confirmation. Scheduled delivery may bypass active review only because the bookkeeper previously configured that schedule. Log generation and every delivery attempt.

## Output

Return report identifiers, period, source status, KPI values and deltas, five variances, anomaly flags, executive summary, delivery eligibility, and delivery result when requested.

## Do not

- Do not post, edit, clear, or void accounting entries.
- Do not process receipt or invoice OCR or reconcile bank transactions.
- Do not send a report to an unconfigured recipient or through an unapproved channel.
- Do not send the full report through WhatsApp; send the executive summary only.
- Do not present hypotheses as verified facts.
