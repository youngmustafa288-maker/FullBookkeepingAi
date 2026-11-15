# STANDARD OPERATING PROCEDURE (SOP)

**SOP ID:** SOP-CF-001  
**Title:** Simple AI Confidence Scoring and Mandatory Review  
**System:** FullBookkeepingAI — Accounting Automation Layer  
**Version:** 1.0  
**Effective date:** Upon deployment and authorization by the process owner  
**Owner:** Accounting Operations / Product Administrator  
**Scope:** JPG/PNG purchase invoices and receipts processed through the review-first MVP

## 1. Purpose
Provide one consistent, easy-to-understand confidence indicator to help reviewers prioritize document checks, without treating a model's confidence as evidence of accounting accuracy.

## 2. Definition
- **AI confidence:** The AI model's self-reported value on a scale of 0 to 1, displayed as a whole-number percentage. For example, `0.86` becomes **86%**.
- **Not calibrated:** The percentage is **not** an independently validated probability that the transaction is correct. It must be described as an **AI estimate**.
- **Independent validation warnings:** Failing an arithmetic, date, currency, GL, or approved vendor-mapping check adds a **separate warning**; it does not silently change the AI's percentage.
- **No score returned:** Invalid, missing, out-of-range, or nonnumeric scores display **Not provided**. Do not invent a default such as 80%.

## 3. Confidence levels and required handling

| Displayed AI confidence | Label | Required reviewer action |
| --- | --- | --- |
| 90–100% | High | Compare the source image to all material accounting fields, especially totals, GL and tax, before approval. |
| 70–89% | Medium | Carefully verify all extracted fields and accounting classification; correct errors before approval. |
| 0–69% | Low | Prioritize for detailed manual checking. If the image or essential facts cannot be verified, reject and request a clearer source. |
| Not provided | Unscored | Perform full manual checking; the missing score does not block human review but does not justify approval. |

**Warning override:** Any unresolved validation warning must be investigated even at 100% AI confidence. The display may say **High · warnings present**, but must never imply that high confidence cancels an accounting exception.

**Mandatory policy:** NO document is automatically approved, exported as approved, or posted to another accounting system solely because of its confidence percentage. Final approval requires a human's explicit source-verification checkbox and a successful server-side review gate. An export is **not** confirmation of posting in the accounting software.

## 4. Procedure

1. **Upload:** An authenticated bookkeeper selects the correct client company, invoice or receipt type, and the original JPG/PNG image.
2. **AI processing:** OCR extracts visible data; the AI proposes amounts, vendor, GL code and other fields and may return one confidence score between 0 and 1.
3. **Calculate display:** If the score is valid, multiply by 100 and round to the nearest whole percent. Assign its level using the table above; otherwise show **Not provided**.
4. **Check independent warnings:** Review the date, required fields, arithmetic, currency, GL-code validity and approved vendor mapping warnings. Treat the list as separate from the percentage.
5. **Human verification:** Open the original source image. Verify vendor, document reference, date, amount, subtotal/tax, currency, GL, category and tax treatment against the actual evidence and approved company policies. Resolve discrepancies and document material corrections in the reviewer note.
6. **Decision:** Choose **Approve for export** only if the correct fields are confirmed and the server accepts the transaction. Otherwise correct, reject, or request a better document. Never treat approval as posting.
7. **Audit:** Retain the original AI proposal, original confidence, final approved values, reviewer identity, timestamp and review note according to the organization's retention policy. Do not alter the original confidence after review.

## 5. Roles and responsibilities
- **AI model:** Suggests document fields and a self-estimated confidence value. It cannot approve or post documents.
- **System validation:** Reports independent validation warnings and enforces mandatory server-side approval requirements.
- **Bookkeeper/reviewer:** Checks the source, resolves concerns, corrects fields and makes the decision.
- **Accounting supervisor/product owner:** Approves changes to this SOP and investigates repeated errors.

## 6. Examples

| AI output | Display | Handling |
| --- | --- | --- |
| `0.96` with no warning | **96% — High** | Human checks all material fields before approval. |
| `0.85` with GL mapping conflict | **85% — Medium; GL warning** | Investigate mapping mismatch; resolve classification before approval. |
| `0.45` with unreadable total | **45% — Low; missing total** | Use readable source or reject, never guess. |
| `null` | **Not provided** | Full manual review; no artificial score. |

## 7. Simple monitoring and improvement (separate from confidence)
When an accountant approves a document, the system stores a **field-level correction record** comparing AI suggestions with the final approved values. The client-rules screen summarizes the share of documents approved without edits, and the share for which the GL and amount remained unchanged. These are **AI/reviewer agreement measures**, not calibrated confidence or proof of accounting accuracy.

A client-specific vendor mapping may be **suggested** only after at least **three** approved documents for the exact normalized vendor have the **same GL code, category and tax code**, with no conflicting past approval and no existing applicable mapping. The suggestion stays pending until a human approves it. If evidence becomes inconsistent, a pending suggestion is marked stale. A dismissed suggestion does not auto-reactivate. Approved rules are supplied as context for future AI processing; they do not bypass source review or automatically post to accounting software.

**Do not:** automatically increase confidence because a vendor rule exists, train on unapproved drafts, learn across clients, silently overwrite existing GL rules, or rewrite financial records based on a confidence score.

## 8. Exceptions and escalation
Escalate to a supervisor if source documents are illegible, tax treatment is unclear, a vendor has multiple reasonable GL categories, evidence conflicts with an approved rule, or model output repeatedly disagrees with human decisions. Use the company's professional accounting policy and applicable law; the confidence score is not authoritative.

## 9. Change control
Changes to score thresholds or review policy require a new SOP version, approval by the process owner, updates to the displayed labels, and regression tests. Changes to the AI provider/model must not be represented as improvements without comparison against verified review outcomes.

**Status:** Operational SOP for the accompanying MVP implementation. Production use requires deployment testing and organizational approval.
