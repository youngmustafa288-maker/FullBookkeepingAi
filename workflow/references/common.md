# Common BookAI Rules

Apply these rules to every task.

## Product boundaries

- Serve professional bookkeepers managing Malaysian SME clients.
- Keep the underlying accounting platform hidden. Say `accounting system`, `ledger`, or `records` only.
- Scope every operation to the authenticated bookkeeper and selected `company_id`.
- Treat OCR as an external frontend step. The BookAI agent receives structured OCR JSON, not raw invoice or receipt files.
- Store timestamps in UTC and display them in Malaysia Time (GMT+8).
- Use MYR by default while preserving recognized foreign currency codes.

## Human-in-the-loop gate

- Preserve original values and all corrections.
- Stage extracted or proposed records before approval.
- Never write to the accounting system without a persisted approval or confirmation record.
- Record submission and approval as separate append-only audit events with distinct timestamps.
- Validate that approval identifiers and company scope match the staged record.
- Use an idempotency key for every write and reuse it on retries.
- Execute accounting API calls server-side; never expose credentials to a browser.

## Data and audit controls

- Treat `audit_log` as append-only. Never update or delete its rows.
- Record actor, action, company, session, job, document/reference, UTC timestamp, original values, and final values.
- Preserve raw OCR and source-row lineage.
- Never silently repair, infer, or overwrite missing source data. Return `null` with a warning.
- On an unreachable dependency, return a non-destructive error. Never pretend that a read or write succeeded.
- Allow up to three retry attempts using 2, 8, and 32 second backoff. Move an exhausted job to `dead_letter`.

## Security

- Never reveal credentials, tokens, connection details, or internal infrastructure.
- Never access a company not associated with the authenticated bookkeeper.
- Never rely on frontend-only authorization or approval checks.
- Require encrypted-at-rest credentials, TLS 1.2 or newer in transit, and database row-level security.
