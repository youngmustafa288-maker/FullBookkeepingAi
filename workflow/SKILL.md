---
name: bookai-workflow
description: Route professional bookkeeping work through one runtime using scoped Markdown instructions.
---

# BookAI workflow runtime

BookAI is one execution runtime, not a collection of agents. Behaviour comes from small, versioned Markdown files.

## Context assembly

For every job, load context in this order:

1. `references/common.md`
2. exactly one task file from `references/`
3. the selected client's `profile.md`
4. the selected client's `vendors.md`
5. the selected client's `gl-codes.md`
6. the selected client's `policies.md`

Never load two task references into one job. Mixed requests become separate sequential jobs with fresh context.

| Input signal | Task reference |
|---|---|
| Receipt OCR JSON, merchant, expense category | `references/receipt.md` |
| Purchase or sales invoice OCR JSON, SST, duplicate invoice | `references/invoice.md` |
| Bank statement CSV, reconciliation, matching | `references/bank-reconciliation.md` |
| Financial reports, KPIs, commentary, delivery | `references/reporting.md` |

## Client expansion

Each client owns four active Markdown files matching the structure under `clients/_template/`. Bookkeepers upload or replace them through Client Configuration. Vendor rules and GL codes are client-supplied context, never hidden global knowledge. A mapping learned from one client must never leak to another client.

## Hard gates

- All accounting reads and writes are server-side.
- Scope every job to the authenticated bookkeeper and company.
- Stage proposals before approval.
- Submission and approval are separate append-only audit events.
- Require an idempotency key for every write.
- Return a non-destructive error when a dependency cannot be reached.
