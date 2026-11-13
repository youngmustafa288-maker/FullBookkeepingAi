# Markdown-first workflow architecture

The application has one workflow engine. The user selects a task, and the router constructs a narrow prompt from versioned Markdown files. This replaces the original multi-agent design while preserving strict task boundaries and human approval.

```text
structured input
  -> route task
  -> common rules
  -> one task reference
  -> one client profile + vendors + GL codes + policies
  -> structured proposal
  -> persisted review
  -> human approval
  -> idempotent accounting write
```

Client folders are intentionally plain text so bookkeepers can review and diff context without editing code. In production, Client Configuration uploads versioned Markdown files to private storage; the database records the active file for each required context slot, and the runtime loads only those active client files.
