# BookAI — Step 3: reviewed AI GL proposals and editable journal coding

## Design preservation

No changes were made to `src/styles.css`, the four workflow choices, sidebar, dashboard, chat/composer, client picker or navigation. This upgrade adds compact editing controls **within the original Review Queue drawer**. No new workflow tabs, external accounting platform, or automatic posting route were introduced. Includes all Step 1 + Step 2 work.

## Added in Step 3

1. **Active, approved GL coding context.** The authenticated `/api/process` prompt receives a structured list of codes, names and account classes parsed from the selected company's saved chart. It asks AI to explain the selected debit/credit treatment and propose a `document` action followed by a related `journal` action **only when supported by evidence**. Neither the prompt nor model output proves a correct accounting treatment.
2. **Deterministic draft preflight.** On staging and editing a proposal, `journalProposalIssues` reuses the same journal checks as posting: active chart codes; non-negative two-decimal major-unit values; a positive debit or credit per line; exact integer-sen balance; journal reference uniqueness; a previously approved or earlier-in-proposal source document; equal source amount, date and currency; no double-posting. A proposed opening journal is forbidden here: use Step 2's separate import. Failing drafts remain **blocked** in the queue with a clear reason. Preflight does not post anything.
3. **Human-editable journal lines.** In the existing review drawer, the bookkeeper may edit a suggested journal reference, date, currency, supporting evidence note, explanation, account code and debit/credit amounts, and add/remove lines. Only saved, active GL codes are offered as choices. A visible total warns if the draft is not balanced. The authoritative posting validation still runs on the server/bookkeeping engine; the screen's totals are only a preview.
4. **Reviewer sign-off and corrections.** Journal cases cannot use the workflow's quick-approve button. Full-review acknowledgement is required. When an AI case was blocked because of unknown evidence or failed draft checks, the reviewer must document how the issue was resolved before approval. The reviewer note and modifications are recorded in the existing audit history. Editing a source amount or journal after sign-off cancels the previous journal sign-off; fresh validation and acknowledgement are needed. Source-document linking (`@0` or a real approved document ID) cannot be changed through the journal editor.
5. **Private evidence preservation.** The original `evidence://bookkeeping-evidence/…` upload reference cannot be silently swapped using an editable document evidence field; a separate GL explanation/evidence note is still available. Original source attachment viewing continues through the existing short-lived signed URL flow.
6. **Atomic internal approval.** After reviewer confirmation, the existing `approve-case` action applies related documents and journals atomically. Any invalid action rolls back the entire batch. The journal and bookkeeping audit entries are kept company-scoped, and internal posting is now labelled `Posted` in the audit display.

## How to use Step 3

1. **Client Configuration** → approve and save a structured `Code | Name | Type | Active` chart for the chosen client. Complete the other required context slots. Verify the chart against company documentation; do not accept invented account codes.
2. In the existing **Workflow workspace**, choose Receipt or Invoice and upload the real invoice, receipt, claim, etc. (or describe a transaction with its supporting facts). The configured AI may propose a document plus an internal GL journal. For unsupported/ambiguous accounting it should ask for clarification and leave posting pending.
3. Open **Review queue** → **Review**. Compare the original attachment on the left with the proposed fields and **Journal · GL coding** on the right. Select valid active GL codes and correct the debit/credit lines, reference, explanation and evidence as necessary. Confirm equal totals and that the journal amount, currency and date correspond to the source document.
4. If the case was blocked, explain how you resolved the specific discrepancy in **Reviewer explanation / resolution note**. Tick the review acknowledgement checkbox. Click **Save corrections** if you want to retain the draft; otherwise click **Approve**. The system revalidates and refuses incorrect/unreviewed journals, regardless of what the UI preview displays.
5. Check **Audit log** and **Reports → Trial Balance**. A posted journal is internal to BookAI; it is **not** sent to an external accounting package, bank, government filing service or e-Invoice platform.

## Important boundaries

- The assistant can be incorrect about GL classification, document amounts, indirect tax treatment or completeness. Only the selected company chart and reviewed evidence can justify a journal; its model confidence is not an accounting approval.
- This step does not automatically journal previously approved documents, convert operational payment allocations into additional GL movements, or create missing supplier/customer aging schedules.
- SST registration/rules and China/multi-currency regulatory accounting cannot be inferred from a generic prompt. Only reviewed documented treatments may be posted.
- No general journal reversal/correction UI for **already posted** entries is available yet. Do not edit saved database JSON to fix posted entries; a controlled reversal/adjustment workflow is a future change.
- No Supabase SQL migration, secrets or `.env` changes were made. The company-scoped workspace JSON now permits an additional optional `proposalIssues` and `reviewNote` on review cases. Past data remains readable.

## Test results for this package

- **PASS:** 49 of 49 deterministic tests: bookkeeping engine, atomic cases, journal controls, proposed-journal correction, invalid/missing/inactive accounts, source-linked posting, reviewer notes, protected original evidence, and Step 2 opening balances.
- **PASS:** TypeScript syntax transpilation of changed TSX / TS server files using the local TypeScript parser (not a full type check).
- **NOT VERIFIED:** full `npm test` suite (includes the source-import and browser UI integration suites), full `npm run build`, `npm run check:server`, browser visual comparison, real AI model/provider calls, and authenticated cloud Supabase integration. The bundled working environment has incomplete dependencies (`esbuild`, React typings, etc.) and Node v22.16.0 rather than the project-recommended Node 24.15+. These unverified checks must pass before release.

## Safe deployment checklist

1. Back up the current Git tree, `.env` credentials (outside the archive), and live Supabase data.
2. Extract the **contents** of this archive into the existing application repository root, without nesting the project folder, deleting `.git`, or replacing deployment secrets. This zip contains all Step 1–3 source changes.
3. With Node 24.15+ in a normal developer environment run: `npm ci`, `npm test`, `npm run build`, `npm run check:server`.
4. Test complete upload → proposed GL draft → incorrect-code rejection → correction → full human approval → internal trial balance → audit log. Verify layout at mobile and desktop widths. Repeat with a test company and actual source data, not production books.
5. Deploy through your existing Git/Vercel pipeline only after passing all the above checks. Verify `/version.json` now shows `bookai-step3-ai-gl-proposal-review` on the **deployed** copy. The release JSON included in this source archive says `source_only_not_deployed` to avoid falsely claiming deployment.

**Next planned Step 4:** connect customer/supplier schedules, cashbook and bank matches back to the reviewed GL control accounts; preserve the original UI.
