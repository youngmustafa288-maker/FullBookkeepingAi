# BookAI — Step 2: client setup checklist and reviewed opening balances

## Existing UI preserved

The original sidebar, dashboard, four workflow tabs, document-upload/AI chat flow, client context cards, Review Queue, Accounts table, report tabs, font choices, colour scheme and `src/styles.css` are **unchanged**. Step 2 adds one subsection **inside the existing Client Configuration page**; it does not create a fifth workflow tab or replace any component.

## What Step 2 adds

1. **Setup completion checklist**: shows whether the saved business profile, active structured chart of accounts, vendor mappings, policies and currency-specific opening journal are present. This is *completeness*, not an audit opinion or assessment of source accuracy.
2. **Opening trial balance CSV/XLSX import**: bookkeeper exports the previous-period trial balance with columns `Code, Debit, Credit` (optional `Account`, `Currency`). A CSV template is generated from the existing reviewed chart. The import accepts up to 3 MB and 1,500 spreadsheet rows; a journal supports up to 100 non-zero GL lines. Files are parsed locally; the source file itself is **not** stored in cloud storage by this import.
3. **Deterministic validation**: imported account codes must be active and approved; no repeated codes; no negative/malformed amounts; no debit and credit in the same account row; debit and credit totals must match exactly in integer sen. Optional CSV/XLSX total row must match computed totals. Currency mismatches are refused, and each currency must be imported separately.
4. **Explicit human approval**: user supplies the source trial balance date, evidence/reviewer note, and a confirmation checkbox after viewing all proposed journal lines. Only then can they click **Approve and post opening balances**. A SHA-256 file checksum is recorded in the journal evidence where browser support permits. This is an internal journal: there is no external accounting software posting.
5. **Protected ledger**: one opening journal per currency, no silent replacement, and no opening date later than an existing approved financial transaction/journal in that currency. Posted journals remain in the company-scoped JSON and immutable audit events using the existing save/revision mechanism.
6. **Clear scope boundary**: importing the opening trial balance does not fabricate aged receivables, supplier invoices or paid/unpaid schedules. Opening customer/supplier detail and reconciliation with GL control accounts are separate steps.

## How to use

1. Open **Client Configuration** for the intended client. Save and approve the **Chart of Accounts** as a structured Markdown table (columns `Code | Name | Type | Active`), with codes and account types checked against actual client records.
2. Scroll to **One-time client setup checks** and **Opening trial balance**. Click **CSV template** if you need a starting file. Fill one account code per row, and put balances in the Debit or Credit column (not both). A validated `Total` row is optional. Save as CSV, or prepare an XLSX workbook using the same headings.
3. Select the currency and the **as-of date shown on the previous-period trial balance**. Ensure it does not fall after already recorded transactions for that currency.
4. Click **Import CSV / XLSX**. Fix any validation error in the source and import again. Review the proposed lines in the scrollable preview and check that debit and credit totals match the signed/approved source.
5. Enter a reviewer note identifying where the original signed/authorised trial balance is retained. Check the review confirmation box and click **Approve and post opening balances**. The ledger and **Reports → Trial Balance** will reflect the approved opening journal, without assuming other transactions are complete.
6. Save outstanding customer/supplier invoices and supporting schedules separately. Cross-check their control-account totals before relying on accounts balances or management reports.

## Control boundaries / limitations

- A checksum records *which bytes were viewed*, if available. It is not evidence that the file was legitimate, nor a replacement for storing the original document safely. The source file is not uploaded to the existing private attachment store by the new opening import.
- Only the first worksheet of an XLSX workbook is read. Values-only cells are supported; spreadsheet formulas are rejected. Complex templates should be exported to a simple reviewed CSV first.
- An opening journal is **not reversable/editable** through this screen. Corrections require separately designed, auditable reversal/adjustment procedures; do not delete or manually alter saved JSON.
- A balanced trial balance cannot prove completeness or financial correctness. Account classes, opening equity, receivables/payables subsidiary schedules and tax treatments still need human accounting review.
- No data migrations, environment settings, global CSS, workflow tabs, external general-ledger integrations or new statutory reporting claims were introduced.

## Testing on this delivered copy

- **PASS**: 44/44 deterministic tests in `tests/bookkeeping.test.mjs`, `tests/journal.test.mjs`, `tests/opening-import.test.mjs`.
- **PASS**: local TypeScript syntax transpilation of the changed React component and configuration page; no parser diagnostics.
- **NOT VERIFIED**: full `npm test`, TypeScript/production bundle, XLSX parsing in a real browser, cloud database end-to-end saves, screenshot-by-screenshot visual QA. The provided sandbox has an incomplete `node_modules` installation, so UI tests requiring `esbuild`, `jsdom`, and the application's dependencies cannot run here. Node is v22.16.0; the project's baseline README requires Node 24.15+.

## Deployment/verification (do this in your own project repo)

1. Back up current code, current Supabase/bookkeeping data and environment variables.
2. Extract this Step 2 archive into the existing Git repository root without replacing `.git` or your actual `.env`. It includes Step 1 changes as well; **do not install it as a nested folder**.
3. Install using Node 24.15+ and run `npm ci`, `npm test`, `npm run build`, `npm run check:server` in that order. Test both local demo and authenticated cloud mode with a non-production company.
4. Check Client Configuration at desktop/mobile viewport widths, including the new import preview and evidence note; confirm the rest of the UI and workflow tabs are unchanged.
5. Reconcile the opening journal with an actual client TB and keep the original source. Only then deploy via your existing Vercel/Git workflow. ChatGPT has not changed or deployed the live application.

**Next: Step 3** — improve AI journal coding/review and corrections, then integrate AR/AP and bank reconciliation in later steps.
