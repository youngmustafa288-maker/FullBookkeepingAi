# FullBookkeepingAI · SOP-FB-003
## Feedback & Issue Reporting
**Status:** Draft for internal adoption | **Version:** 1.0 | **Applies to:** Automation-layer MVP v4

### 1. Purpose
Allow authenticated users to report accounting suggestions, extraction mistakes, software defects or product suggestions without editing an accounting transaction or silently updating AI rules. Preserve reporter, company, linked document, priority, investigation status and a traceable history.

### 2. Report procedure (bookkeeper / user)
1. Choose the correct client company, then select **Report an issue** in the navigation or the **Report issue** button on an invoice, review dialog or decision trace.
2. Choose type: AI decision, extraction error, software bug, feature request or other. Set urgency to Low, Normal or Urgent.
3. Select the affected document where available. Write a specific problem description (at least 10, up to 3,000 characters). Include expected result, actual result and relevant reference; do not paste credentials or unnecessarily expose personal data.
4. Submit. Save the ticket number (`ISS-<number>`). The report is recorded separately from accounting approvals and vendor rules.
5. Check **Track issue status** for investigation updates. A report is not proof of a model defect until verified.

### 3. Investigation and resolution (assigned administrator)
1. Open **Report an issue** for an assigned company. Review the company ticket inbox.
2. Inspect the original document and AI decision trace where linked. Check the client chart of accounts, rules, human reviewer actions, and whether the issue reproduces.
3. Change status to Investigating, Resolved, or (after resolution) Closed. Record an investigation/resolution note of 8–1,000 characters every time status changes. Resolve only after documenting the outcome; reopen where necessary.
4. For verified accounting errors, instruct the accountant to correct the document through the normal human approval process if still pending. Once approved, the existing learning engine may evaluate the correction for a client-specific vendor-rule suggestion.
5. For system bugs, verify the fix separately before closing. The status itself does not repair documents or confirm an external accounting posting.

### 4. Access and history
- Reporters see their own tickets in companies where they retain membership. Assigned staff with `public.users.role='admin'` see all company tickets and can update their statuses.
- Ticket history captures submitter, changes and notes; company audit history gets a reference to the ticket, not unrestricted report descriptions.
- Report/activity tables use company-aware row-level security. Database functions enforce write authorization; browser clients cannot directly insert or update ticket records.
- Activity events are append-only for application users; database superusers/service roles require separate operational controls and backups.
- Basic abuse cap: 10 submissions per user per company per hour. Add perimeter rate limits for launch.

### 5. What this does not do
- Does not retrain the model, calibrate the simple confidence score, auto-accept new rules, alter approved accounting entries, or post into accounting platforms.
- Does not guarantee email alerts, support SLAs, uploads of arbitrary screenshots, or a two-way chat thread; v4 offers admin status updates with documented notes only.
- The interface shows up to 200 recent tickets and 200 history events per ticket; older records remain in the database.

**Owner:** Accounting operations lead and product administrator | **Review cycle:** After pilot and each workflow/role change
