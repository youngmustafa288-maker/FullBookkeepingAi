# Bank Reconciliation Workflow

Use the BookAI runtime to execute four ordered stages. These are deterministic workflow stages, never separate agents.

## Required input

Require `company_id`, `bookkeeper_id`, `session_id`, selected bank, reconciliation date range, and bank-statement CSV. Support configured Maybank, CIMB, RHB, and Public Bank adapters only. Reject unsupported or ambiguous formats without guessing column meanings.

## Stage 1 — Fetch and normalize

Use deterministic rules, not model inference.

1. Confirm a persisted `recon_sessions` job record.
2. Normalize each statement row to stable transaction ID, date, signed amount, debit/credit direction, currency, description, reference when present, and source row number.
3. Preserve original row values.
4. Require date, amount, and description. Flag missing data and out-of-period dates.
5. Read payment entries, journal entries, and outstanding invoices from the accounting system for the same company and period.
6. Normalize ledger candidates to stable ID, type, date, signed amount, currency, party, reference, status, and clearance date.
7. Do not continue when required rows are invalid or the accounting read fails.

## Stage 2 — Match

For each transaction, score ledger candidates from 0 through 100 using auditable signals:

- exact signed amount and currency;
- date distance within 3 calendar days;
- partial normalized reference match;
- fuzzy party-name match tolerant of abbreviations, capitalization, and extra spaces.

Prevent reuse of one ledger entry across multiple matches unless modeled as a split and forced to manual review. Return per-signal scores, alternatives, and plain-language rationale.

Tier proposals exactly as follows:

- above 90: `auto_confirmed`, eligible for bulk review but not approved or posted;
- 70 through 90 inclusive: `needs_review`, requiring individual confirmation or reassignment;
- below 70: `manual_review`, requiring detail review;
- no defensible candidate: `unmatched`.

Persist proposals in `recon_matches` with `proposed` status. If evidence is ambiguous, lower confidence; never guess.

## Stage 3 — Handle exceptions

Classify each unmatched item as exactly one of:

- `bank_charge_or_fee`
- `timing_difference`
- `missing_ledger_entry`
- `duplicate_transaction`
- `unknown`

For bank charges or fees, draft a journal suggestion with supporting rationale and proposed expense account. For timing differences, propose `outstanding` with no write. For missing ledger entries, direct the bookkeeper to create an entry manually or through the Receipt or Invoice workflow. For duplicates, provide evidence and require a resolution. For unknown items, explain the uncertainty plainly.

All exceptions require full bookkeeper review regardless of confidence. Do not offer one-click approval.

## Stage 4 — Difference and post

Calculate bank credits, bank debits, confirmed ledger total, approved journal total, unresolved items, and running difference. Enable posting only when:

- every non-auto item and every exception is resolved;
- selected auto-confirmed items have persisted bookkeeper confirmation;
- the running difference equals exactly zero using currency-safe decimal arithmetic;
- confirmation records belong to the same company and session;
- a final approval audit event exists;
- every planned write has an idempotency key.

Then, and only then, set clearance dates on confirmed ledger entries and post approved exception journals. Reuse idempotency keys on retry. Append an audit entry for every attempted write and return per-item results; never report all-or-nothing success if only some writes succeeded.

## Output

Return the session identifiers, normalized counts, match tiers, exception classifications, unresolved items, difference summary, gate status, and any write results. Keep source lineage and rationales available for review.

## Do not

- Do not process invoices, receipts, or reports inside this workflow.
- Do not write during normalization, matching, or exception classification.
- Do not treat `auto_confirmed` as bookkeeper approval.
- Do not post while the difference is non-zero.
- Do not create a journal for an unknown item.
