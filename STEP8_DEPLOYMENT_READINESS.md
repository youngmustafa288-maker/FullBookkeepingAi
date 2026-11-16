# BookAI — Step 8: release checks, safer workspace reads, and staging verification

**Status: SOURCE READY FOR CI/STAGING VERIFICATION ONLY — NOT PRODUCTION-APPROVED OR DEPLOYED.** This is a cumulative package containing Steps 1–7 and the Step 8 checks. No changes were made to the UI components, four workflow tabs, navigation, fonts, or global CSS.

## Implemented

1. **Reject corrupt saved workspace records instead of treating them as fresh blank books.** `server/bookkeeping-read.mjs` now exposes `requireWorkspaceState`. A missing workspace row may be initialized, but an existing row containing invalid state is returned as an HTTP 503 error. Both GET and POST paths in `api/bookkeeping.ts` use this rule. Four additional tests cover missing, valid, null/incompatible, and malformed saved state. Two release-gate tests verify successful offline checking and deliberate rejection of unsafe production settings.
2. **Offline release preflight:** `npm run verify:release` checks package/lock metadata, essential source files, migrations 001–006, Vercel rewrite ordering, source-ignore rules, the release marker, and SHA-256 preservation of `src/styles.css`, `src/App.tsx` and `src/components/Shell.tsx`. It requires no external packages. This is a source/config gate, *not* proof of a functioning browser UI.
3. **Deployment configuration gate:** `npm run verify:release -- --deployment` requires cloud mode and the configured public and server-only variables without displaying credential values. The command deliberately fails when required settings are absent. This gate checks presence, not whether a credential works or whether the database has correct permissions.
4. **GitHub CI workflow:** `.github/workflows/verify-bookai.yml` runs `npm ci`, the offline preflight, all tests, the full application build, and the server TypeScript check on Node.js 24. It does **not** deploy. An optional manual invocation can run staging HTTP smoke tests.
5. **Read-only staging smoke test:** `BOOKAI_STAGING_URL=https://your-staging.example npm run smoke:staging` checks `/`, `/version.json`, that an unauthenticated `GET /api/bookkeeping` returns 401, and that GET requests to write-oriented AI/OCR routes return 405. It does not send source files, make payments, write bookkeeping records, or verify authenticated UI workflows.
6. **Release version marker:** `public/version.json` identifies the Step 8 release as not deployed and preserves the previously declared feature flags.

## Tests run in the supplied workspace (2026-11-16)

| Gate | Observed | Meaning |
| --- | --- | --- |
| `node --test tests/bookkeeping.test.mjs tests/journal.test.mjs tests/opening-import.test.mjs tests/reconciliation.test.mjs tests/statements.test.mjs tests/closing.test.mjs tests/api-read.test.mjs tests/release-check.test.mjs` | **PASS: 83/83** | Deterministic accounting and workspace-read tests pass. |
| `npm run verify:release` | **PASS: 11 checks, 2 warnings, 0 errors** | Source and offline release configuration pass. |
| `npm run verify:release -- --deployment` without credentials | **INTENTIONAL FAIL** | Missing deployment settings are blocked instead of producing a false ready signal. |
| `npm test` | **BLOCKED** | UI/source import suites require missing React, esbuild, jsdom, exceljs and other packages. Run `npm ci` in CI or a normal development environment. |
| `npm run build` and `npm run check:server` | **NOT VERIFIED** | Required runtime packages/types are not installed in this workspace. CI workflow added but not executed here. |
| Browser UI on phone/desktop | **NOT VERIFIED** | UI source retained; screenshots alone do not prove actual responsive rendering. |
| Supabase, private evidence, AI, Vercel, and live accounting | **NOT VERIFIED** | No real external requests, migrations or deployments executed. |

## Run in your own GitHub/Vercel staging environment

1. Back up the actual source repository and Supabase company/bookkeeping/evidence data first. Do not overwrite live workspaces with sample data or run unreviewed migrations on production.
2. Extract the ZIP directly into an existing BookAI repository root, preserving your real `.git` history, Vercel project connection and private environment variables. Do not add an extra parent folder.
3. Use a dedicated staging Supabase project/database where possible. Review and apply the ordered migrations in `supabase/migrations/` only if not already applied. Do not reapply them blindly.
4. Set public Vite configuration: `VITE_BOOKKEEPING_MODE=cloud`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` server-only, alongside `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Configure `GEMINI_API_KEY` if image/PDF OCR is needed. Never paste these credentials in a chat or commit them to Git.
5. In a trusted terminal with Node.js 24 and network-enabled npm registry, run:

   ```sh
   npm ci
   npm run verify:release
   npm test
   npm run build
   npm run check:server
   ```

   Use the GitHub Actions workflow for a repeatable verification log. If any step fails, **do not deploy to production**. The CI build uses dummy public placeholders only to verify bundling; it cannot verify real authentication.
6. Before promoting staging, run the deployment gate in a protected environment with the actual variables set:

   ```sh
   npm run verify:release -- --deployment
   ```

   Then deploy to a **preview/staging** project using your normal Vercel process. Verify the deployed `/version.json` release string is `bookai-step8-release-gates`.
7. Perform unauthenticated staging HTTP checks using `BOOKAI_STAGING_URL=https://<your-staging-host> npm run smoke:staging`. Do **not** point this at an unrelated system. Run authenticated QA manually with a dedicated test bookkeeper and at least two test companies:

   - Verify company isolation, permissions, sign-in/out and no access without a token.
   - Upload and review a test original document; check signed evidence access and reviewer corrections.
   - Post approved journals, import opening balances, allocate a part payment, and reconcile a bank statement against the GL.
   - Export TB, P&L and Balance Sheet; confirm that reports remain drafts when coverage is incomplete.
   - Close and reopen a month with a reason; confirm duplicate/backdated actions are rejected.
   - Compare desktop and mobile appearance with the **original** BookAI design, including all four workflow tabs and chat/upload/review controls.
   - Confirm that a database outage shows an error and **does not** display an empty customer ledger or erase saved work.
8. Have a qualified bookkeeper/accountant independently review the example accounting transactions, chart, control accounts, taxation and month-end adjustments before real client use. Passing deterministic code tests cannot establish financial-statement completeness or statutory compliance.

## Important release limitations

- **Do not deploy this ZIP directly as a production-approved build.** Browser and CI tests still need to pass where dependencies can be installed.
- The existing `Load Sample Malaysian Companies` fallback uses local browser demonstration data. Avoid using it for actual client accounts; verify cloud mode on production. The original control and styling were deliberately left unchanged in this step.
- Cash Flow reports, external accounting-system posting, bank feeds, e-Invoicing and tax filing are not implemented.
- This package does not contain private database records, login credentials or a production build.

## Files added/changed in Step 8

- `server/bookkeeping-read.mjs`, `server/bookkeeping-read.d.mts` — saved workspace data guard.
- `api/bookkeeping.ts` — guard used on GET and POST.
- `tests/api-read.test.mjs` — four new read safety tests.
- `tests/release-check.test.mjs` — two new tests of the offline and deployment gates.
- `scripts/release-check.mjs`, `scripts/ui-baseline.json` — offline and deployment readiness gates.
- `scripts/staging-smoke.mjs` — non-destructive staging smoke tests.
- `.github/workflows/verify-bookai.yml` — automated full CI gate without deployment.
- `package.json` — new release/smoke scripts (no dependency additions).
- `public/version.json` — Step 8 version marker and verification flags.
- `README.md`, this file — updated release instructions.

**Original styles, navigation and components are byte-identical to Step 7.** No migration files were changed; no live database write was performed.
