# FullBookkeepingAI · SOP-AI-002
## AI Decision Explanation & Audit Trail
**Status:** Draft for internal adoption | **Version:** 1.0 | **Applies to:** Receipt and purchase-invoice MVP

### 1. Purpose
Allow any authorized team member assigned to a company to reconstruct what FullBookkeepingAI proposed, which approved client rules were available, which checks fired, what the accountant changed, and whether an export response was prepared. This automation layer does not confirm postings in external accounting software.

### 2. Minimum evidence for each processed document
- Original source image in company-scoped private storage; source SHA-256 for later integrity comparison.
- Extraction and classification proposal; model name, workflow version and fingerprints of approved client context and packaged workflow reference files.
- One **AI-generated explanation** of suggested classification, with brief source observations and uncertainties. This is a justification for review, **not** the model's hidden chain-of-thought or a guarantee that the explanation is accurate.
- Independently checked facts: GL existence, vendor mapping match or conflict, and deterministic validation messages.
- Model's simple confidence level per SOP-CF-001 (High 90–100%, Medium 70–89%, Low below 70%, Unscored when absent); it is not recalibrated from audit events.
- Accountant's decision, original versus approved fields, reviewer user ID, timestamp and optional review note.

### 3. Recorded event types
- `submitted`: AI draft staged; source hash, model and configuration fingerprint.
- `failed`, `retried`: errors and retry activity (sanitized; no raw credentials, prompts or OCR in event note).
- `approved`, `rejected`: human decision, original proposed values and final approved values.
- `config_changed`: additions, updates and deletions to GL codes, vendor mappings and policies; changes to company tax regime.
- `edited`, `override`: vendor-rule suggestion approved or dismissed (existing learning workflow).
- `export_prepared`: an approved document was included in a CSV response prepared by the server. **Not proof of download, import, reconciliation, or posting.**

### 4. Operating procedure
1. Upload an invoice/receipt. Verify the source image is accessible.
2. Open the review queue and click **Trace** (or **AI explanation & full trace** in the review dialog).
3. Check the extracted facts, suggested GL and AI explanation against the original source, company chart of accounts and vendor rules. Do not treat model-described evidence as independently verified.
4. Correct fields and record a human review note of at least five characters for any field correction or rejection; approve or reject.
5. For follow-up investigations, open the document's **Trace** to see the time-ordered event log, reviewer ID and corrections; use the **Audit history** page to filter recent events or search all retained events by document reference.
6. Prepare CSV export only from approved documents. Record that a CSV was prepared; confirm any external import/posting separately in the target accounting software.

### 5. Access, integrity and retention
- Documents and audit data are isolated by company membership via Supabase row-level security; do not share source URLs outside authorized personnel.
- Browser clients are not allowed to write arbitrary audit events. Database triggers and security-definer functions record transactional changes; the existing no-update/delete trigger makes application-level audit records append-only.
- Append-only does **not** mean immune to database administrators or a compromised service-role key. Restrict privileges; configure regular backups and independent retention/monitoring appropriate to client contracts, Malaysian legal obligations and your firm's retention policy.
- Avoid putting passwords, API tokens or unrestricted OCR into explanations or event notes. The document itself remains in private storage.
- Existing documents pre-dating v3 will not gain an invented AI explanation or historical model provenance. Show **Not recorded**.

### 6. Exceptions and limits
- Failed processing may have only a job and failure event, not a staged document. These failures appear in company Audit history.
- Company Audit history UI shows the newest 200 entries; document Trace fetches up to 200 events for its own job. Database records are not limited to 200.
- There is no live integration with external accounting systems or audit proof of actual GL posting.
- Reviewers must not interpret AI reasoning summaries or confidence as evidence of accounting correctness.

**Owner:** Accounting operations lead | **Review cycle:** After initial pilot and every major workflow/model change
