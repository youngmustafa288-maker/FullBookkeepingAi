# BookAI — Restored Original AI Workspace

Current cumulative source release: **`bookai-step8-release-gates`** (available at `/version.json` after deployment). Historical step-by-step change notes are retained below.

This revision restores the original drag-and-drop workspace, AI chat composer, client summary, Review Queue, side-by-side review drawer, Accounts table, Audit Log and AI Client Configuration. The original four workflow choices remain. The sixteen bookkeeping subtask guides are internal references; they are not sixteen workflow buttons or manual transaction screens. E-Invoice integration is excluded.

## What changed

- Upload documents by drag/drop or the attachment button. Multi-file batches are processed sequentially, with up to 20 files and a 3 MB limit per file. PDF, JPG, PNG, CSV, XLSX and text are supported by the configured source extraction path.
- AI uses the selected workflow's instructions, stronger case-decision guidance, reviewed client context and actual available company records. The conversation supports explaining faulty goods, partial payments, overpayments, credits, returns, refunds and other transactions without changing screens.
- The assistant returns conversational answers and linked proposed actions. These go into the existing Review Queue. An upload result is no longer replaced with a seeded demo review item.
- The restored review drawer shows the original source alongside editable proposal fields. Missing evidence and questions remain visible. A reviewer must explicitly resolve/document blockers. Unsupported proposals without actions cannot be approved.
- Approved cases apply atomically through deterministic bookkeeping controls. If any linked action fails, no partial document/settlement changes are saved. Cases can link newly proposed invoice/payment records internally without exposing extra menus.
- Actual approved operational records appear in the restored Accounts table with original currency, amount and remaining balance. Activity appears in the restored Audit Log. Approval is distinct from external ledger posting, which is not connected.
- Client Configuration restores file import, AI clarification questions and Configure with AI dialogs for profile, chart of accounts, mappings and policies. AI output remains draft until the reviewer approves and saves it. Saved context stays scoped to that company.
- Static sample report claims were replaced with supported operational source summaries. Full TB/P&L/balance sheet/cash flow still require the actual ledger and supporting information; the application does not manufacture balanced financial statements.

## Existing deployment setup

1. Replace the existing application source with the contents of this archive. Keep the existing `.git` directory and actual environment/secrets. Do not put the archive or an extra nested project folder inside the deployed source directory.
2. Keep migrations 001–005 if already applied. Apply only `supabase/migrations/202610110006_evidence_document_formats.sql` for this revision: it keeps evidence private and allows CSV, XLSX and text attachments. It does not delete or reset bookkeeping records. For a new database, apply all migrations 001–006 in order. For an older deployment without 004–005, apply those before 006.
3. Ensure the authenticated user's `public.users` record and authorised `company_users` relationships already exist. The client master is the real `companies` table; this revision does not invent or auto-create live companies.
4. Set browser `VITE_BOOKKEEPING_MODE=cloud`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Set server-only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, and the supported `BOOKKEEPING_MODEL` selected for the deployment. Never prefix private keys with `VITE_`.
5. Configure `GEMINI_API_KEY` for PDF/image OCR or the existing LM Studio adapter for supported images. CSV/XLSX/text imports are parsed directly. Legacy XLS should be exported as XLSX or CSV. Large workbooks must be split without losing supporting control totals.
6. Use Client Configuration to review and save all four context slots. Use explicit unknown/none notes where appropriate; do not invent policies to make the setup appear complete.
7. Build and deploy through the existing Git/Vercel project. Verify the source commit, configured root directory and production branch. `/version.json` should show the release identifier for the installed source package.

Vite's local dev server alone does not run Vercel `/api` functions. Use the existing Vercel deployment or its local function runner for authenticated AI calls. This revision has not been pushed to your application repository or deployed to your live website by ChatGPT.

## Local demonstration mode

`VITE_BOOKKEEPING_MODE=local` is an explicit browser-only test mode with empty sample company workspaces; it does not replace cloud sign-in by default. Existing browser operational state is retained under the same per-client keys. Live AI/source extraction requires a real authenticated company; the app does not pretend an offline assistant succeeded. Browser-only state is not automatically transferred to Supabase.

## Controls and boundaries

The deterministic engine preserves integer-sen arithmetic, duplicate identities, same-party/currency allocations, partial settlements, overpayment balances, credit/refund caps, dated allocation releases, historical balance validation, faulty-goods evidence, unique bank cash matches and operational locks. Proposal creation does not approve or post its actions. Case approval cannot execute configuration writes, bank payments, tax filings or external GL posting.

Existing workspace data and client context are retained. New review cases are stored in the same company-scoped workspace JSON and use the existing server-only revision guard. Original attachments remain in private storage and are opened through short-lived signed URLs. A generated facsimile is never shown as the original evidence.

Simple bank cash matching is available; complete bank-to-GL reconciliation, grouped/net settlement automation, native bank-specific import adapters, inventory valuation and full statutory accounts still require their proper source systems/review. SST reasoning requires the relevant effective official rules and client facts. This revision does not add e-Invoicing.

## Validation

Use Node.js 24.15 or later in the Node 24 series (the tested runtime is 24.22) and run:

```sh
npm ci
npm test
npm run build
npm run check:server
```

All 36 tests pass. The regression tests cover financial controls and atomic review cases. A DOM interaction test exercises original four-workflow navigation, upload-to-review staging, editable review approval, accounts/audit updates, and AI configuration drafting followed by explicit approval. CSV/XLSX import tests read real generated workbooks. AI replies/authentication are mocked in automated interaction tests; no live provider or production database action was executed.

Browser visual QA remains unverified because the managed preview relay is unavailable in the build environment. The original layout files and styles were restored, and client/server compilation and functional interaction checks pass.


## Incremental upgrade — Step 1

A reviewed, internal double-entry journal foundation was added with no changes to the original navigation, styles, or screen layout. The existing Trial Balance report can now show journal-backed entries but clearly labels missing opening balances and unposted source documents. This is not a complete statutory trial balance or external posting. See [`STEP1_IMPLEMENTATION.md`](STEP1_IMPLEMENTATION.md) for exact changes, verification limits, and future steps.

## Incremental upgrade — Step 2

A one-time client setup checklist and reviewer-controlled CSV/XLSX opening trial-balance import have been added **inside the existing Client Configuration screen**, preserving navigation and global styling. Imported balances must use active approved GL accounts, balance exactly in sen, and have a supported as-of date and reviewer evidence before being recorded as an opening journal. The source file is **not retained by this importer**. See [`STEP2_IMPLEMENTATION.md`](STEP2_IMPLEMENTATION.md) for features, limitations, instructions and the current Step 2 verification status (44 deterministic tests passed; full UI/production build not verified in this sandbox). Earlier test counts above refer to the original restored workspace revision.


## Incremental upgrade — Step 3

AI prompts now receive the saved **active** chart-of-accounts entries explicitly and are directed to propose an evidence-backed debit/credit journal after a corresponding source document when the accounting treatment is supportable. This remains an untrusted draft until review. The review drawer now permits a bookkeeper to correct journal references, dates, currency, evidence, explanations, accounts and individual debit/credit lines within the existing layout. A deterministic preflight uses the same validation as actual posting; unmatched source dates/amounts, inactive GL codes, unbalanced entries and duplicate posting remain blocked.

Journal approval requires explicit full-review acknowledgement; flagged exceptions require a documented reviewer resolution. A correction invalidates a previous GL sign-off, and audit events retain reviewer changes. Private uploaded source links cannot be silently replaced by editing the proposal. The original four workflow tabs, sidebar, global CSS, fonts and overall design remain unchanged.

See [`STEP3_IMPLEMENTATION.md`](STEP3_IMPLEMENTATION.md) for detailed instructions, limits and tests. The source package is **not deployed**. Prior release descriptions above are retained as implementation history, not the current verification status.

## Step 4 — customer/supplier schedules and bank reconciliation (source-only)

- Existing Accounts screen now includes reviewed customer/supplier aging, dated open balances, unallocated receipts/payments, CSV schedules and controlled payment allocation.
- Existing Bank Reconciliation workflow now includes human-confirmed statement matches, exact/manual exception review, cashbook CSV, saved statement closing totals and bank-to-GL difference status.
- Existing Management Analysis screen shows receivable/payable subledger vs mapped approved GL control accounts. Incomplete source/journal coverage is never labelled balanced.
- No changes to the original styling, four workflow tabs, sidebar or document chat layout.
- See `STEP4_IMPLEMENTATION.md` for instructions, tests, important limitations and safe install process. This is **not a deployed release**.


## Step 5: internal financial reporting

The existing **Reports** screen can now calculate a date-filtered trial balance, a selectable-period Profit & Loss, and a cumulative Balance Sheet from reviewed internal journal lines. Period P&L excludes brought-forward opening journal entries. The Balance Sheet adds unclosed cumulative earnings once to posted equity and checks the Assets = Liabilities + Equity difference. All values are in integer minor units, separated by currency; signed contra balances are kept. Export GL detail, P&L, Balance Sheet and trial balance CSVs from their existing report tabs. Reports are labeled internal drafts, with warnings when opening balances or approved source journals are missing; do not present them as audited or statutory accounts. Cash Flow remains unavailable until cash movement classifications are established. See `STEP5_IMPLEMENTATION.md`.


## Step 6: month-end close, period locks, review checklist (current cumulative source release)

The existing **Reports → Management Analysis** screen now includes an additional **Month-end review & period lock** section using existing cards, badges and buttons. No global CSS, navigation, sidebar, typography, colors or four workflow tabs were changed. The review checklist evaluates recorded data in every encountered currency, enforces completed calendar months and sequential month-end closes, checks opening journals, approved source-to-GL coverage, financial equation, mapped AR/AP GL controls, imported bank statement reconciliations, unmatched bank rows/cash movements, open cases and unresolved goods claims. Warning-only items (missing optional control schedules without activity and missing recorded bank evidence when no bank accounts are mapped) explicitly require human investigation, not an automatic certification.

Two separate review confirmations and a reference are needed to close. The core action also re-evaluates those checks on the server, not only in the browser. `closedThrough` blocks backdated journal and operational changes, with GL chart/policy and control mappings protected while a close is active. The latest close may be reopened with a documented reason, preserving recorded close/reopen history and the prior lock date. Export the close checklist as CSV; review all items before closing.

**Source only.** 75/75 deterministic accounting tests passed (including 7 new close tests). Source syntax parsed without errors; full Vite/TypeScript build, browser/device regression, live Supabase/API integrations and accountant sign-off remain **unverified** because development dependencies in this runtime are incomplete. Nothing was deployed. Review `STEP6_IMPLEMENTATION.md` for precise usage, limitations and required verification. Earlier reported test counts apply to earlier development snapshots.


## Step 7: source and integration verification — database read safety

The authenticated bookkeeping API now treats company/workspace database read failures as visible HTTP 503 errors instead of returning empty records, preventing false "blank books" impressions. Four new deterministic regression checks pass. **79/79 deterministic tests passed.** `npm test` and `npm run build` cannot fully execute in this sandbox because packages are missing and the npm registry is unreachable; the React UI, live providers, and deployment remain unverified. All original styling and navigation remain unchanged. See `STEP7_VERIFICATION.md` for the test matrix and steps to complete staging verification.


## Incremental upgrade — Step 8: deployment verification (source package only)

Step 8 adds a fail-closed saved workspace state guard, offline release preflight, GitHub CI configuration for a full `npm ci` + tests + Vite build + server type-check, and a non-destructive staging HTTP smoke script. **85 deterministic tests passed** in the supplied environment; full browser/production builds and integrations remain unverified and were not deployed. Global CSS, shell, app navigation and four workflow tabs are unchanged. See [`STEP8_DEPLOYMENT_READINESS.md`](STEP8_DEPLOYMENT_READINESS.md) for exact commands, blockers and staging checklist.
