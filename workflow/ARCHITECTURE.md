# BookAI workflow architecture

The registry contains sixteen focused tasks in eight groups. The server authenticates the user/company, loads shared controls and one task file, and obtains saved company context. Documents are staged for human approval. The deterministic engine manages sen arithmetic, remaining balances, allocations, returns, refund caps, bank matching, idempotency and period locks.

Local mode stores a company workspace in this browser. Cloud mode authenticates with Supabase and persists versioned company state through a server-only compare-and-swap function. Both use the same engine. Approval records the operational subledger; it does not post to an external accounting system or execute a payment. Operational reports are not full financial statements. MyInvois integration is excluded.
