# FullBookkeepingAI — accounting automation layer (review-first MVP)

**Product role:** document intake, classification proposals, human approval and safe exports *on top of* an existing accounting system. **Not a replacement ledger.** Nothing is directly posted to an accounting platform in this release.

## What the live application actually does

1. Authenticated bookkeeper creates a real client company in Supabase.
2. Bookkeeper supplies the company's approved chart of accounts, vendor mappings and optionally verified policies.
3. Bookkeeper uploads a JPG/PNG purchase invoice or receipt (up to 8 MB) into an immutable private, company-scoped storage bucket.
4. Server checks the bearer token, company membership, source path and file signature. It uses OCR and the **single** selected task reference (`workflow/references/invoice.md` or `receipt.md` plus `common.md`). AI receives approved data for **only** the selected company.
5. Server checks required values, totals, currency, valid GL codes and approved vendor mappings. AI confidence is explicitly marked **uncalibrated**.
6. A single database transaction persists the draft, audit submission event and pending-review job status.
7. Human opens the source, corrects fields and approves/rejects. Corrections or rejections require a short explanation. A database function atomically validates and saves the decision, preserving original and final values in an append-only audit log. Repeated approvals and obvious vendor+reference duplicates are blocked.
8. **Only approved** documents are exportable as CSV with formula-injection protection. Preparation of the response is audited per document; this does **not** confirm download, accounting import or posting. The operator must map/import the CSV into their chosen accounting software.

## Setup

**Prerequisites:** Node.js 20+, Supabase (Postgres/Auth/Storage), Vercel, an HTTPS-secured OpenAI-compatible vision/OCR service (e.g. LM Studio behind a secure gateway), and an OpenRouter API key. Production sends document contents to the configured processors—ensure an appropriate customer data-processing agreement, consent, retention policy and secure access controls.

1. Start from a **new Supabase project** or back up your existing schema.
2. Execute SQL migrations in filename order: `202610110001_initial.sql`, `202610110002_review_attachments.sql`, `202610110003_client_context_files.sql`, `202611140001_automation_layer.sql`, **`202611140002_feedback_learning.sql`**, **`202611140003_decision_audit.sql`**, **`202611140004_issue_reporting.sql`**. Confirm the storage bucket and RPC permissions; do not apply on a production database without reviewing the RLS changes.
3. Enable email/password authentication in Supabase. Auth user profiles populate automatically after the migration; verify existing company memberships if upgrading a database.
4. Copy `.env.example` to `.env.local` for local development and set the same required secrets in Vercel's **server** environment. `SUPABASE_SERVICE_ROLE_KEY` is server-only and should never have a `VITE_` prefix.
5. Run `npm ci`, `npm run build`, and use `vercel dev` (or deploy to Vercel) to exercise the serverless `/api` endpoints; `npm run dev` alone is **Vite only** and will not serve the Vercel backend.
6. Register, create a company, configure approved GL codes, choose the verified tax registration status, add vendor rules, then upload and review a sample invoice image. Check that the company scope is enforced before onboarding real financial data.

### Review feedback and learning

- The SQL trigger stores field-level differences only on transition from **pending** to **approved**, after human review. The original model suggestion remains intact.
- The DB-backed learning summary compares **original proposal vs human-approved fields**; it is **not** measured independent accuracy. No learning mechanism changes the confidence score.
- Candidate vendor mappings require three approved, exact-normalized-vendor matches with the same GL, category and tax code, no contradictory approvals, an active GL and no existing applicable mapping.
- Suggestions appear in **Client rules** where reviewers can **Approve rule** or **Dismiss**. Only explicitly approved rules become active vendor mappings. Cross-company learning is prohibited.
- Procedure: `docs/SOP-CF-001_Confidence_Scoring.md`. Manual integration tests: `tests/MANUAL_LEARNING_VALIDATION.md`.

### Decision explanation and audit trail (v3)

- Review queue and approved export screens have a **Trace** button for each document. A trace includes the original file link, AI confidence, short AI-generated explanation, *separately* checked client rules, warnings, final human corrections, job event timeline and source/configuration fingerprints.
- Explanation is an **auditable, short justification**; model-reported evidence is labelled as unverified. This is not hidden chain-of-thought, nor an assurance that suggested accounting treatment is correct.
- Company Audit history displays recent changes and can search the database by document reference; per-document Trace queries events by job ID.
- Database events include submitted, failed, retried, approved/rejected, configuration changes, learning-rule decisions, and `export_prepared`. Config changes are logged in SQL triggers, and application clients cannot forge audit entries. Every field correction and every rejection must include a human review note of at least five characters.
- Original images are stored privately with a SHA-256 fingerprint. Model, OCR and workflow fingerprints support later investigations; a hash is **not a complete snapshot** of settings or external posting confirmation.
- SOP: `docs/SOP-AI-002_Decision_Explanation_Audit_Trail.md`. Staging checklist: `tests/MANUAL_AUDIT_VALIDATION.md`.

### Required API and access controls

- `GET /api/automation?companyId=<uuid>` reads document drafts for the authenticated company.
- `POST /api/automation` `action=process` consumes a private stored image and stages a proposal; `action=review` calls the atomic SQL approval/rejection gate.
- `GET /api/export?companyId=<uuid>` prepares approved, adapter-neutral CSV only and records `export_prepared` events before responding; these events do not prove successful download or posting.
- Public old OCR, processing and AI configuration endpoints were **removed** because they did not reliably enforce company membership and persisted approvals.
- Legacy mock dashboards remain as source files but are **not routed** in the live app. No mock numbers are represented as real accounting records.

## Limitations / NOT production-certified

- **Only JPG/PNG purchase invoices and receipts** are enabled, one image at a time. PDFs, multi-page documents, CSV/XLSX import and scanned PDF OCR are deliberately disabled until properly implemented; we do not decode Excel as text or send PDFs disguised as images.
- Old documents do not acquire retrospective AI explanations. Audit history is append-only for app users, but administrators with elevated access may still alter database records; backups, retention controls and privileged-access monitoring remain necessary. UI results are capped at 200 per query, with server-side reference search for older events.
- There is no accounting-platform adapter yet. The approved CSV is a staging artifact, not confirmation of posting, payment or reconciliation. Exports are not idempotent external writes; the destination import must deduplicate on `source_id`.
- No real bank-reconciliation pipeline or trial-balance based reporting, and no verified SST/e-Invoice tax decision engine.
- A **single, simple AI confidence score** is shown as High (90–100%), Medium (70–89%), Low (0–69%), or Not provided, per **[SOP-CF-001](docs/SOP-CF-001_Confidence_Scoring.md)**. This self-report is not a measured reliability probability. The separate validation warnings and mandatory human approval remain regardless of score.
- Review corrections are recorded and summarized as **original AI vs final reviewer agreement**. Vendor rules are proposed only after ≥3 consistent, conflict-free, approved documents. Suggestions cannot silently update accounting rules and never auto-post. Reviewers must cross-check original source images. Mapping and subtotal checks are necessary, not sufficient, for accounting accuracy.
- Rate limits, virus scanning, job queues/timeouts, robust OCR PDF support, retention and deletion controls, comprehensive permission roles, mandatory dual approval for high-value items, regulator-specific controls, complete adapter certification, and end-to-end integration tests are still required before commercial launch.
- The Vercel function runtime must allow enough execution time for OCR + AI. Plan a queued worker before production scaling.

## Recommended next adapters

Implement a generic `AccountingAdapter` interface (`validateConnection`, `listAccounts`, `listTaxCodes`, `dryRunImport`, `createPurchaseInvoice`, `getPostingStatus`) with platform-specific implementations for an actual first customer system. Only queue an adapter write after persisted approval; use a company- and document-specific idempotency key and record the remote posting reference. Do not silently re-post on retries.

## Verification in this delivery

The source was inspected, 16 automated tests were executed successfully (including four static v4 permission/wiring checks) and the new implementation is packaged. The two modified/new v4 TSX files passed syntax transpilation (not full type-checking). The SQL migration and live Supabase/Vercel deployment were not exercised. If dependency installation/build cannot be executed in the current environment, **do not treat this delivery as build-tested or deployment-certified**. Run the commands above and smoke-test the end-to-end workflow with a test company before processing customer data.

### Feedback and issue reporting (v4)

- Apply `supabase/migrations/202611140004_issue_reporting.sql` **after v3** (do not rerun earlier migrations on a live database without backup and review).
- Use **Report an issue** in the sidebar for general problems, or **Report issue** beside a document, in a review dialog, or in **Trace** to pre-link an invoice/receipt. Types include AI decision, extraction, software bug, feature request, and other; priority is a user-provided flag, not automatic severity validation.
- Each submission creates a company-scoped `ISS-<number>` ticket, an append-only ticket activity event and an audit event. It does **not** change document approval, accounting values, AI confidence, accounting-system posting, or approved learning rules.
- Bookkeepers can read only tickets **they reported**. Members whose `public.users.role` is `admin` can see all tickets for **companies they are assigned to**, and change a ticket's status with an investigation/resolution note. Set admin roles through your controlled staff onboarding; **do not allow self-service role upgrades**.
- Supported statuses: **new → investigating → resolved → closed**. An admin may reopen a resolved report. Closing a report is only permitted after resolution. Notes are visible to the reporter in the ticket history.
- An issue about an AI decision can become learning evidence only **after the accountant separately verifies/corrects the original document through the established review workflow**. A ticket alone never activates a mapping, and old approved documents are not automatically rewritten.
- The new function `submit_issue_report` enforces company/document boundaries, character limits and a basic 10-reports-per-hour-per-company-and-user rule; these are not substitutes for production API rate limiting and anti-abuse protections. No attachment uploads yet; document links reference the existing private company source.
- In-app ticket list currently shows up to 200 newest accessible reports; detailed history shows up to 200 events. Database rows are not subject to those display limits. A production ticketing system should add pagination, retention policies and notification delivery.
- SOP: `docs/SOP-FB-003_Feedback_Issue_Reporting.md`; manual test checklist: `tests/MANUAL_FEEDBACK_VALIDATION.md`.
