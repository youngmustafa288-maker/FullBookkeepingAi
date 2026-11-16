# BookAI — Step 5: Financial statements and ledger CSV exports

## Scope / unchanged UI

This ZIP contains the **cumulative project source for Steps 1–5**, not just a patch. The original `src/styles.css`, fonts, colors, sidebar, company picker, AI workspace, existing **four workflow choices**, Review Queue and routing remain unchanged. The only front-end change is inside the pre-existing **Reports** page and uses its existing statement-table, report-tab, panel, button and badge styles. No new global stylesheet or main tab was created.

## Features added

1. **Pure read-only accounting report engine** (`src/bookkeeping/statements.mjs`, declaration `statements.d.mts`): Derives statements only from approved, internally posted `state.journals` in integer minor units. The approved chart's account-type snapshot comes from each posted journal. It never reads raw AI suggestions as actual books and does not post missing adjustments.
2. **Period Profit & Loss** (`Reports → Profit & Loss`): Choose a start date and end/as-of date. Income and expense accounts are grouped; revenue is credit minus debit, expense is debit minus credit, net profit is revenue minus expense. Opening journals are excluded from **period activity**, even if their date is in the selected period. Contra/reversal amounts remain signed. No fiscal year has been guessed: the date picker defaults to January 1 but can be changed to the actual reporting period.
3. **Balance Sheet** (`Reports → Balance Sheet`): Assets are debit-normal, liabilities/equity credit-normal, all cumulatively as of date. It preserves negative/contra accounts and displays **unclosed cumulative earnings** (total Revenue minus Expense across all posted journal history) once with equity, producing a mathematically reconcilable Assets = Liabilities + Equity + Unclosed Earnings check. This unclosed earnings total is not necessarily the selected-period P&L. No fabricated retained earnings or profit distributions are posted.
4. **Internal completeness checks**: Opening journal present? Every recorded, approved, dated source document in the company currency represented by a posted journal? Missing source count and date/currency scope are shown. Coverage is NOT a certification that every real-world transaction has been captured, or that journals are appropriately classified. All statements clearly say **draft internal**, not audited/statutory. Zero differences without complete evidence do not imply completeness.
5. **Exports**: Date- and company-scoped GL detail CSV in the Reports header (journal reference/date, source ID, account, signed debit/credit, **no private evidence URLs**), date-range P&L CSV, cumulative balance sheet CSV and the pre-existing trial balance / approved source CSV. Amounts are decimal strings and exported CSV is formula-injection escaped by the existing helper. Currency is not mixed.
6. **Honest Cash Flow placeholder**: The Cash Flow tab deliberately stays **Not generated**, because the existing chart/journals lack reviewed operating, investing and financing classifications and cash account reconciliations; future work must establish these first.

## How to check

1. Load the updated project, choose a company, and use **Client Configuration** to save its approved GL chart and verify the opening balance journal.
2. Use the existing **AI workspace** and **Review Queue** to create, correct, review and approve source-document journals (Step 3).
3. Open **Reports → Trial Balance**. Check opening/completeness warnings and export reviewed GL details if needed.
4. Open **Reports → Profit & Loss**, set the correct inclusive reporting period, check revenue, expenses and net profit, and export P&L CSV.
5. Open **Reports → Balance Sheet**, check assets, liabilities, posted equity, unclosed cumulative earnings and the balancing difference, and export CSV. Explain and correct any omitted sources rather than overriding totals.
6. Compare Bank Reconciliation / Accounts and Management Analysis control statements from Step 4 before relying on the results; Step 6 will add month-end close and additional period-lock checks.

## Testing / limitations

- **PASS: 68 of 68 deterministic accounting tests** via `node --test tests/bookkeeping.test.mjs tests/journal.test.mjs tests/opening-import.test.mjs tests/reconciliation.test.mjs tests/statements.test.mjs`.
- **PASS: 7 new financial reporting tests**, covering correct P&L date windows, balance-sheet equation, contra signs, currency/date isolation, evidence-safe GL detail, incomplete coverage flags, and invalid date protection.
- **PASS: JSX transpilation syntax check** for `src/pages/Reports.tsx`; **unchanged** `src/styles.css` content.
- **NOT VERIFIED:** Full TypeScript production build, browser visual/mobile regression, integration tests needing `esbuild` or `jsdom`, live Supabase/API and AI/OCR calls, accounting-policy classification, external bank connections and deployment. The installed `node_modules` snapshot is incomplete (the TypeScript build reports missing type libraries and the two full-suite tests fail on missing packages). Run `npm ci`, `npm run build`, `npm test`, and human browser/accountant review in a complete development environment before deployment.

## Safety and accounting caveat

The GL classification is as reviewed by the bookkeeper, not independently audited. Period-end accruals, tax, depreciation, foreign exchange, inventory valuation, account groupings by liquidity, retained-earnings roll-forward, and statutory requirements are **not automated by this Step 5**. These are transparent internal ledger-derived reports, not a substitute for an accountant's close.
