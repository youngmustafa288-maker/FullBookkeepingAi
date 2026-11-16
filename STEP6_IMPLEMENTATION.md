# BookAI — Step 6: Month-end closing controls and period locking

**Current package is cumulative Steps 1–6.** This is a source-code handoff, not a live deployment or approval of accounts.

## Original UI preserved

- Original four AI workflow choices, document-upload/chat, company selector, sidebar, fonts, colors and global `src/styles.css` are unchanged.
- **Reports → Management Analysis** adds a month-end checklist beneath existing customer/supplier control reconciliation, using existing `panel`, `variance-table`, `Badge`, `button`, and `notice` styles. **Audit Log** retains its design and can filter *Period Closed* and *Period Reopened*.
- No main navigation items, workflow menus, dashboards, colors or CSS rules were replaced or created.

## Implemented

1. **Read-only reviewer checklist**: `src/bookkeeping/closing.mjs` (plus `.d.mts`) validates calendar month ends (including leap years), previous close sequence and cutoff not being in the future when invoked for an actual close. It checks pending AI cases, pending source documents through cutoff, unresolved goods claims, unmatched bank statement rows, **all recorded currencies** including non-base currencies, opening journals, approved document-to-journal coverage, internal TB/BS agreement, applicable mapped A/R and A/P subledgers, imported bank statement vs mapped GL difference, missing bank GL postings, and unreviewed bank-linked cash movements. It never invents source data, postings, adjustments or reconciliations.
2. **Manual review items** remain visible for external source coverage, mapped bank statement completeness, accruals, depreciation, inventory, payroll, FX and SST/tax considerations. A “Pass” means *only this recorded-data check passed*; never treat the checklist, GL equation or successful close as audited/statutory compliance.
3. **Enforced `close` action**: cannot close mid-month, a future month, or skip a month following a prior close. A reviewer must supply a reference/reason and independently tick (a) source/GL/reconciliation review, and (b) period-end adjustments/statutory review. All deterministic checks rerun inside the state transition (the same `applyAction` on the backend or explicit local demo), so disabling a UI control is not the only protection. Failed requests leave the stored state unchanged.
4. **Period protection**: postings/operational transactions with dates on/before `closedThrough` are blocked, as in earlier engine versions. This step additionally blocks changes to chart/policies and reviewed GL control mappings while a close is active, because those changes could alter prior reporting interpretations. Human-approved changes to historical periods require reopening.
5. **Recorded close/reopen history**: Each close stores reviewer, timestamp, reference, covered currencies, snapshot of checklist statuses and previous lock date. Reopening requires an explicit reason, timestamps the reopen and restores the **previous** closed-through month (rather than unnecessarily unlocking all prior months). The existing audit log tracks close/reopen actions and their reasons. Older `closedThrough` states without a Step 6 close snapshot can be reopened explicitly, without fabricating historic metadata.
6. **Reports UI & CSV**: select a month, inspect blocked/pass/manual-review checks, export review-pack CSV without evidence URLs, provide a reference and two attestations, close, or reopen the latest close with a reason. An already closed month and its reviewer/reference are shown.

## How to use

1. Back up your Supabase database and existing app source. Save this *complete* ZIP in your source project. Keep live environment variables private. For a clean checkout, use `npm ci` then `npm run build` and `npm test`.
2. Confirm that the company setup and opening trial balance are supported. Post reviewed source journals via Review Queue, reconcile customers/suppliers and imported banks in existing screens. The checklist cannot generate missing GL entries on its own.
3. Open **Reports → Management Analysis → Month-end review & period lock**. Select the completed month (by default the last completed month in Malaysia). Check all blocked findings. Resolve them through the ordinary existing workflows. If a bank statement or control schedule is absent and the checklist shows *Manual review*, investigate it separately.
4. Export the close checklist CSV to the company's controlled records, and separately retain signed close workpapers/backup evidence: **the CSV and text attestations are not a substitute for source documents**.
5. Enter the close review reference. After personally reviewing the source GL and the relevant adjustments, confirm both checkboxes. Click **Close month & lock period**. The app stores the close record and blocks backdated writes.
6. For a legitimate correction, enter a required reopening reason and click **Reopen last close**. The audit record persists. If several months are closed, only the newest close is reopened; older months stay locked. Then correct, reconcile and re-close chronologically.

## Verification performed

- **PASS: 75 of 75 deterministic accounting tests**, command:
  ```sh
  node --test tests/bookkeeping.test.mjs tests/journal.test.mjs tests/opening-import.test.mjs tests/reconciliation.test.mjs tests/statements.test.mjs tests/closing.test.mjs
  ```
- **PASS: 7 new Step 6 tests** verify month-end date handling, a fully linked opening-journal → sales invoice → receipt → allocation → GL → bank statement/match → close/reopen workflow, prior-period protection, no skipped months, blocked sources/bank movements and additional currency coverage. Older close tests were updated because the earlier loose checkbox-only close behavior was not safe.
- **PASS: source-file TypeScript/TSX parsing** (32 implementation `.ts`/`.tsx` files parsed without diagnostics) and ESM Node test imports.
- **UNCHANGED** `src/styles.css` bytes versus Step 5 ZIP; no new top-level workflow choices.
- **NOT VERIFIED**: full production TypeScript/Vite build and browser/mobile UI regression, due to missing/incomplete node_modules (types for React/Node and required esbuild/jsdom); full-source import tests, live API/OCR/AI connections, Supabase workspace permissions, deployment and accountant/statutory accounting treatment. These require running `npm ci`, `npm test`, `npm run build`, and end-to-end browser checks in a complete environment. Do not deploy without further review.

## Deliberate limits

- The checking algorithm only sees stored, recorded sources. It cannot know whether real-world invoices, bank accounts, payroll, taxes, or all adjusting journals were omitted. Unmapped control accounts without recorded activity and missing recorded bank statements are *manual review warnings* rather than magically verified reconciliations.
- P&L, Balance Sheet and Trial Balance remain internal journal-derived drafts; Cash Flow is still not produced. No external GL posting, tax calculation/filing, automatic year-end retained earnings close, bank feed, bank statement provenance verification, multi-user approval policy, or legal compliance certification is added.
- The existing backend uses authenticated company access and optimistic revision guards; this step does not add role-based approval permissions or external close sign-offs.
- `periodCloses` is additive to the existing workspace JSON format; no new database migration or reset is needed, and old company states load with empty history. **Back up data first.**
