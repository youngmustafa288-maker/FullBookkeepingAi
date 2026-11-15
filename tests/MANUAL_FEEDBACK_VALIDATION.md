# v4 issue reporting — staging verification checklist

Use a **staging** Supabase project. Apply migrations through `202611140004_issue_reporting.sql` and configure at least two companies and three real test identities: reporter A (company 1), reporter B (company 1), admin C (assigned to company 1). Include a test user assigned only to company 2.

- [ ] A submits a general software issue; gets `ISS-<number>`; sees it in My Reports; company Audit history records `feedback_submitted` but does not disclose the report description.
- [ ] A submits an AI issue using **Report issue** on a real document; the ticket links the correct document, and the document Trace shows a matching audit event.
- [ ] A cannot submit a ticket linking a document belonging to company 2 by changing the client request parameters; database rejects it.
- [ ] A cannot read tickets created by B using direct REST/RPC or table queries.
- [ ] C (company-assigned admin) can see A and B's tickets, change the status with a note, and A can see the appended note.
- [ ] Reporter A cannot call `update_issue_report`, and cannot update issue_reports/events directly.
- [ ] Admin C cannot update tickets in company 2 without membership (even if global users.role = admin).
- [ ] A report shorter than 10 characters, or longer than 3000, is rejected server-side; an invalid type or priority is rejected.
- [ ] Eleven same-user same-company submissions within an hour are rejected on the eleventh attempt.
- [ ] A ticket cannot close straight from New/Investigating; only Resolved can become Closed.
- [ ] Every admin status change requires an 8–1000-character note, records old and new state, actor ID and timestamp, and produces `feedback_status_changed` in company Audit history.
- [ ] Attempt to delete/edit an issue event fails; direct browser insert/update/delete on tickets fails.
- [ ] Triggering a ticket alone leaves the original AI proposal, confidence, GL mapping, human approval status and CSV export data unchanged.
- [ ] Existing v3 document Trace, CSV audit, client learning engine and SOP-CF-001 confidence score thresholds behave identically.
- [ ] Test with the report author removed from the company: they must no longer access company tickets through the app.
- [ ] Review secure role assignment, data retention, privacy notices and operational backup before production use.

**These tests require a live database and have not been executed by merely running unit tests.**
