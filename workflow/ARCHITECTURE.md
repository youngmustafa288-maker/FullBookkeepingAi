# FullBookkeepingAI: automation layer, not a second ledger

```text
Existing accounting platform (source of truth)
                  ^
                  | future reviewed adapter; currently approved CSV export ONLY
                  |
Company-scoped private source uploads (JPG/PNG)
  -> server-side identity and company verification
  -> immutable source + content-hash idempotency key
  -> external OCR
  -> ONE Markdown task reference + common rules
  -> approved GL / vendor / policy context from Supabase RLS
  -> model draft + deterministic validations
  -> transactionally persisted proposal + submission audit
  -> human crosscheck and edit against original source
  -> atomic SQL approval/rejection + append-only audit
  -> approved CSV with source_id for downstream deduplication

Separate human feedback path (v4):
  company-scoped Report issue -> validated ticket with optional document reference
  -> append-only ticket event + audit event
  -> assigned administrator investigates, records status + resolution note
  -> verified corrections only enter learning through the EXISTING human approval workflow
```

Only `invoice` and `receipt` routes are live in the new UI. The old sample dashboard, reports and bank reconciliation UI are not routed. Source-side model confidence is an uncalibrated suggestion and never a posting gate. The database is the source of truth for approved company-specific rules, rather than the sample Markdown client folders. The application deliberately does not create accounting journal entries or claim an external sync without a real adapter.

Upgrade roadmap: test and verify first accounting adapter with dry-run and remote idempotency; add PDF processing; build bank reconciliation against a live platform ledger; support tax validation and review roles; establish retention and redaction policies; add background workers and integration test coverage.
