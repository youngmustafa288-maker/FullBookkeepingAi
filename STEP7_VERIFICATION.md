# BookAI — Step 7: Integration verification and fail-closed database reads

**Cumulative handoff:** This source package includes Steps 1–6 plus a targeted Step 7 reliability fix. It is not a deployed release, certified set of accounts, or a verified browser build.

## User interface preserved

The original four workflow choices, sidebar, AI upload/chat workflow, navigation, layout, fonts and global `src/styles.css` were not changed in Step 7. This update is limited to server-side database-read handling, its deterministic tests, and release documentation.

## Issue verified and fixed

Previously, `GET /api/bookkeeping` returned `{clients:[],states:{}}` if the Supabase company query failed, or quietly treated a failed bookkeeping-workspace query as an empty set. That makes a genuine database timeout, permission fault or other read error look like the user's books do not exist. The endpoint now **fails closed** with HTTP 503 and a clear retry message when either read fails or returns an unexpected payload, while logging the underlying error in the handler. A successful empty company result remains a valid empty company list, and a successfully queried company with no workspace row remains a newly initialized workspace.

- `server/bookkeeping-read.mjs` and `.d.mts`: reusable read-result guard and TypeScript declaration.
- `api/bookkeeping.ts`: use the guard for company and workspace queries.
- `tests/api-read.test.mjs`: four no-dependency tests covering valid empty results, query failures and malformed payloads.

**No schema changes, no edits to stored records, and no new UI controls.** The existing server authentication and Supabase optimistic revision checks remain in place.

## Verification performed on 2026-11-16

| Gate | Result | Evidence / limit |
|---|---|---|
| Source-level bookkeeping, ledger, statements, reconciliation, closing and DB-read tests | **PASS: 79/79** | `node --test tests/bookkeeping.test.mjs tests/journal.test.mjs tests/opening-import.test.mjs tests/reconciliation.test.mjs tests/statements.test.mjs tests/closing.test.mjs tests/api-read.test.mjs` |
| Full test suite (`npm test`) | **BLOCKED: 79 pass / 2 suites cannot load** | `source-import.test.mjs` and `workspace-ui.test.mjs` require missing `esbuild`, `exceljs`, `jsdom`, React modules; these did not run |
| Production build (`npm run build`) | **BLOCKED** | `node_modules` lacks required type definitions and binaries |
| Dependency install in this runtime | **BLOCKED** | DNS cannot resolve npm registry (`EAI_AGAIN`); fresh `npm ci` not possible here |
| Static syntax parse | **PASS** | Source files checked using the globally available TypeScript parser |
| Original design and CSS | **UNCHANGED** | `src/styles.css` SHA-256 matches Step 6 package |
| Live AI / Supabase API / Vercel / desktop/mobile browser QA | **NOT EXECUTED** | Requires a configured integration/staging environment and installed dependencies |

Automated integration in an isolated DOM requires packages from `npm ci`. No real financial records, attachments, secrets, or customer data were used or changed here.

## Mandatory follow-up before any production release

1. Back up your live source and Supabase data. Use an isolated staging copy. Preserve private environment variables; never include service-role or AI keys in ZIP archives.
2. On a development machine with Node.js and npm registry access, run `npm ci`, `npm test`, `npm run build`, and `npm run check:server`. Investigate and correct any failed checks. Existing `README.md` documents environment variables and migrations.
3. Run authenticated staging tests of `GET /api/bookkeeping` under normal load, temporary database failure, and a user with no company access. Failures must be errors—not blank books.
4. Verify the current four-workflow UI against screenshots at mobile and desktop widths, including source upload, proposal corrections, journal approval, opening balance import, customer/supplier allocation, bank reconciliation, reporting CSV and month-end close/reopen.
5. Test separate companies for isolation, cross-session revision conflicts, private evidence access, and role permissions. Verify failed/partial uploads do not silently mutate records.
6. Have a qualified accounting reviewer verify the chart, opening balances, transaction treatments, financial statement completeness, foreign currency, taxes and month-end adjustments. Never treat mathematical balance or successful close as a statutory accounting certification.

## Known deliberate boundaries

- Cash Flow report is still not generated; existing report screen says so.
- Source coverage is limited to records supplied to the system; external completeness is not proven.
- No bank-feed ingestion, automatic financial adjustments, external GL posting, tax filing, real-time source verification, or statutory approval is implemented.
- Closing must not be used as a substitute for external audit or reviewer signoff.
