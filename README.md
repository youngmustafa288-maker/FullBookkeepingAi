# BookAI — Restored Original AI Workspace

Release: `bookai-original-ai-workspace-r2` (also available at `/version.json` after deployment).

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
7. Build and deploy through the existing Git/Vercel project. Verify the source commit, configured root directory and production branch. `/version.json` must show `bookai-original-ai-workspace-r2`.

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
