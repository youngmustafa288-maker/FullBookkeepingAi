# BookAI — Step 1 of the incremental bookkeeping upgrade

## Decision: preserve the original UI

The existing dashboard, four workflow choices, sidebar, colours, fonts, drag-and-drop composer, Review Queue, Client Configuration screen, Accounts table, and Audit Log are retained. No CSS, navigation, or layout redesign is included in Step 1.

## Completed in this step — internal general-ledger foundation

1. Added `src/bookkeeping/ledger.mjs` with structured chart-of-accounts validation, integer-sen debit/credit validation, account/type checks, and date-filtered, currency-separated trial-balance calculation.
2. Added a `journal` action to the deterministic bookkeeping engine. Journal entries reference already-approved source documents, or a separately evidenced opening balance. Duplicate document-to-journal posting and unbalanced entries are rejected. The source document's date, currency, and amount must agree with its journal.
3. A proposal may now contain a source document followed by a journal referencing it as `@0`; the existing atomic Review Queue approval posts them together or rolls all changes back on failure.
4. Journal actions in AI proposals require explicit full review; the existing quick-approve action is unavailable for those proposals. Posted GL codes cannot be removed or change account types in saved configuration.
5. Updated the AI workflow contract so it may propose journal entries only using active, approved GL codes and known evidence. It must not invent an opening balance or claim external posting.
6. The existing **Reports → Trial Balance** tab can display and export journal-based trial-balance data when any approved journal exists. It warns when an opening journal or posted source documents are missing; no full statutory statement is claimed.
7. The internal state adds an optional-on-load `journals` collection; previously saved company records remain readable. No migrations or private configuration files were changed.

## Not yet complete

- No new UI for opening-trial-balance onboarding/import yet: this step establishes the safe journal engine first.
- Existing company documents from earlier versions are **not** automatically converted to journal entries. They require source-backed review.
- Profit & Loss, balance sheet, cash flow, bank-to-GL matching, full period-close checklists and official SST integrations are not yet implemented.
- This is internal bookkeeping state, **not** a posting to any external GL/accounting platform.
- The upload/review integration relies on the configured AI provider and company context; live AI and production Supabase actions have not been tested in this environment.

## Test status

- PASS: `node --test tests/bookkeeping.test.mjs tests/journal.test.mjs` — 39/39 bookkeeping and journal checks.
- UNVERIFIED: full React browser test and production bundle build. `npm ci` could not finish installing dependencies in the current sandbox. The local Node runtime is v22.16.0, below the version required by this project's jsdom package. The updated TS/TSX files passed a syntax transpilation check, but that is not a replacement for a full build or visual QA.

## Deployment instructions

1. Back up the existing Git repository and production database/workspace JSON.
2. Copy the *contents* of this archive into the existing project root, retaining the current Git history, actual `.env` secrets, and Supabase data. Do not place the archive as a nested subdirectory.
3. Use a supported Node version (24.15+ as documented in the existing README). Run `npm ci`, `npm test`, `npm run build`, and `npm run check:server` locally or in CI before deployment.
4. Deploy through the existing Vercel/Git workflow only after verifying all checks. No database migration is necessary for this additive JSON-state update.
5. For journal proposals, save a structured approved chart, for example:

   | Code | Name | Type | Active |
   |---|---|---|---|
   | 1000 | Cash at bank | Asset | yes |
   | 1100 | Trade receivables | Asset | yes |
   | 2100 | Trade payables | Liability | yes |
   | 4100 | Revenue | Revenue | yes |

   These are **illustrative account codes only**; use each company's own approved chart.

## Suggested next steps

- Step 2: connect existing Client Configuration uploads to a reviewed opening trial balance and setup-completeness checklist, with no new main navigation.
- Step 3: enhance human review of AI-generated GL coding, journal splits, and SST evidence, with clear failure/reversal procedures.
- Step 4: complete cashbook and AR/AP reconciliation with the ledger.
- Step 5: add supported P&L, balance sheet and management reporting with completeness checks.
- Step 6: monthly close, controlled reopening, export/reconciliation testing and production QA.
