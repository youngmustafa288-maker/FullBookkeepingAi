# Review-feedback and vendor learning integration checks

These are manual Supabase end-to-end acceptance steps, **not automated-test claims**.

1. Execute all migrations in README order; verify browser roles may SELECT suggestions and feedback but cannot INSERT/UPDATE/DELETE these tables or invoke private trigger helpers.
2. Create companies A and B with different chart of accounts. From A's JWT confirm B's rows and learning summary are inaccessible.
3. In company A, approve an invoice while correcting AI GL and total. Verify one `review_feedback` row with `gl_code` and `amount`, and original vs final values in `audit_log`. Repeated approval must fail and must not add another row.
4. Approve three **different references** for the exact same vendor with consistent approved GL/category/tax. Verify **one** pending suggestion with `support_count=3`. The rule must NOT appear in approved `vendor_rules` yet.
5. Dismiss the suggestion. Verify status `dismissed`, audit entry created, and no vendor rule activated. Subsequent matching approvals must not reactivate it.
6. Repeat with a different exact vendor. Approve suggestion and verify the approved `vendor_rules` row and audit entry exist. Ensure future AI requests receive this mapping in **that company only**.
7. Approve two matching transactions for a third vendor, then one with a different GL or tax. Confirm no pending suggestion. For an existing pending suggestion, introduce a conflicting approval and verify `stale`.
8. Verify an invalid/inactive GL blocks suggestion approval. Verify client A cannot act on B's suggestion and cannot pass a different company ID.
9. Test an AI score 0.95 with an invalid subtotal. UI must show `95% · High` **and the validation warning**, without auto-approval.
10. Test 0.69, 0.70, 0.89, 0.90, `null`, and invalid scores against SOP-CF-001. No scoring thresholds alter posting/approval rights.
11. Verify `get_review_feedback_summary` counts reviewed approvals and reports original-vs-final agreement, not claimed accuracy. Old approved documents should backfill once.
12. Attempt to POST to an accounting platform: there must be **no automatic posting implementation** in this release.
