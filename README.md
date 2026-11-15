# BookAI Malaysian Bookkeeping Workflows

This upgrade separates customer invoices, collections, supplier bills, supplier payments, expense receipts, employee claims/reimbursements, goods inspection, faulty-goods claims, credits/refunds, bank matching, AR/AP review, SST review and month-end/report exports. It includes 16 focused Markdown task instructions in eight groups. No MyInvois/e-Invoice integration is enabled.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Local mode is the default. It bypasses cloud sign-in, starts with empty operational records for three sample companies, and saves each company's records separately in this browser. It does not connect to a bank, external ledger or tax portal. Use Reports → Workspace backup to export the full state. Browser data can be lost if site data is cleared; use cloud mode for shared durable records. Original uploads and AI processing require cloud configuration; manual documents and evidence references work locally.

## Cloud setup on the existing Vercel/Supabase stack

1. Apply migrations in filename order. For an existing project with migrations 001–003 already applied, apply only 004–005. Migration 004 adds company-scoped operational state with server-only compare-and-swap writes. Migration 005 creates a private immutable-original evidence bucket.
2. Ensure each authenticated user has a `public.users` row, and assign authorised company IDs in `company_users`. Existing company rows remain the client master; new client onboarding is not included here. Do not use sample company IDs for live records.
3. Set `VITE_BOOKKEEPING_MODE=cloud`, browser Supabase URL/anon key, and server-only Supabase URL/anon key/service-role key. See `.env.example`. Never prefix service-role or AI provider secrets with `VITE_`.
4. Set `OPENROUTER_API_KEY` and a supported `BOOKKEEPING_MODEL` for AI draft analysis. Configure Gemini OCR or the existing LM Studio adapter if using image/PDF extraction. Vite alone does not run Vercel `/api` functions: deploy this source to your existing Vercel project or use Vercel's local function runner.
5. In Client configuration, save the actual company profile, counterparty mappings, GL codes and policies. The server loads these saved values and exactly one selected task file. An explicit “none configured” note is permitted; unsupported classifications still require review.
6. Run the checks below, then deploy using the existing project settings. No live deployment, real bank action, tax submission or external ledger posting was performed during this upgrade.

## Use the workflows

- Stage an invoice/payment/expense; approve it after checking the evidence. Invoice recognition and cash documents remain separate.
- Allocate approved receipts/payments to the same party and currency. Partial allocations and multiple documents per payment are supported. Excess stays unallocated. Underpayments remain outstanding.
- For a paid invoice with a later credit, release the relevant allocation amount, then approve the linked credit. Record any refund against the released cash balance. Releases retain dates and history; they do not create cash movements.
- Inspect goods separately. Accepted and faulty units must equal delivered units. Faulty units are quarantined operationally; reporting a fault does not alter the invoice. Link an approved credit/refund or replacement evidence to resolve the claim.
- Record employee claims once, then allocate employee reimbursements against those claims.
- Import normalised single-account/currency statement rows. Validate opening + movements = closing. Confirm exact cash-record matches. Repeated or ambiguous amounts remain for review. The simple CSV input uses four unquoted columns; it is not a native parser for every Malaysian bank format.
- In Reports, choose an as-of date for invoice/payment balances and aging. Amounts remain in their original currencies; dashboard totals show MYR only. Export documents, allocations, allocation releases, current goods claims, bank matches and audit data.
- Month-end locks are operational locks. A reviewer must confirm source completeness and actual GL/control reconciliations; locking does not certify statutory accounts.

## Current boundary

Implemented: operational document approval, remaining balances, dated allocations/releases, refund and credit caps, goods claims, duplicate identity checks, exact bank cash matching, audit actions, operational period locks, browser persistence, authenticated company persistence, private evidence upload and task-specific AI proposals.

SST review, AR/AP statement review and month-end accounting are instruction-led review/handoff workflows. Full P&L, balance sheet, TB, inventory costing, payroll computation, FX conversion, automatic native-bank CSV parsing, grouped bank settlements and external accounting-system posting are not implemented. Bank row matching alone is not a complete bank-to-GL reconciliation. Proposed journals require the client's actual chart/ledger and human review.

Do not run real financial records through local sample companies or treat an AI confidence value as an approval. Live cloud storage/AI/database permissions must be verified in the target deployment.

## Validation

```sh
npm test
npm run build
npm run check:server
```

The regression suite covers exact sen arithmetic, partial/batched invoice allocation, cross-party/currency blocks, employee reimbursement, duplicate imports, evidence gates, faulty goods → credit → refund, historical releases/backdated credit protection, bank statement arithmetic, unique bank matching and operational period controls.

All 23 bookkeeping regression tests, the TypeScript client build and server type checks pass. Cloud integrations and database migrations were not executed against a live account. Interactive browser QA was unavailable because the managed preview relay was unavailable.
