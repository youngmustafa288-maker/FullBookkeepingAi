# Manual staging validation — AI explanation and audit trail (v3)

Use a **test Supabase instance**, never real customer records for these checks.

1. Apply migrations 202610110001–003 then 202611140001–003. Confirm `decision_explanation`, `processing_context`, audit action constraint, configuration triggers, and export RPC exist.
2. Sign in to test company A. Configure one active GL and one vendor rule. In Audit history verify each configuration write produced a `config_changed` event with the current user ID.
3. Upload a JPG receipt or invoice with matching vendor. Open **Trace**; verify model-generated explanation is distinctly labelled **unverified**, the independently checked GL/vendor match appears separately, and warnings and the original image remain accessible.
4. Confirm processing provenance includes file SHA-256, rules fingerprint, model name and OCR model. Ensure secrets and raw prompts are not shown in the audit trace.
5. Modify the proposed GL code, try approval with an empty note; both UI and SQL RPC should reject. Add a five-character reason, approve, and verify original vs final values, reviewer ID and timestamp are preserved.
6. Reject a second document with empty note; reject should be blocked. Enter a reason, reject, and confirm a corresponding audit event.
7. Export a valid approved document. Verify `export_prepared` is logged for that document. The event MUST NOT claim that import/posting to Xero/AutoCount/SQL Account succeeded.
8. Upload a duplicated document and inspect the retry/duplicate behavior. Simulate AI failure and confirm `failed` is logged without confidential OCR or token data. Confirm service-role write access is server-only.
9. Change a vendor rule, GL name, client policy and tax regime; verify `config_changed` before/after payload and actor. Unauthorized company B user must not read company A's document history.
10. In Audit history, test an older document reference via **Search all**; note the 200-result cap. Try browser/client UPDATE or DELETE on an audit_log entry and confirm it fails.
11. For documents staged before v3, Trace must display **Not recorded** for unavailable AI explanations instead of inventing one.
12. Run `npm ci && npm run build && npm test`; deploy to a staging Vercel + Supabase instance and perform complete OCR, AI, approval and export checks. This file is a checklist, not evidence that these tests have run.
