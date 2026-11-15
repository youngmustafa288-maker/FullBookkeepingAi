---
name: bookai-workflow
description: Route Malaysian bookkeeping documents, allocations, returns, reconciliation and close reviews through scoped task instructions.
---

# BookAI task router

Load references/common.md, exactly one selected task reference, and the selected company profile, vendor mappings, GL codes and policies. Use src/workflow/catalog.ts as the task registry. Split mixed requests into linked sequential jobs. Keep extraction, human approval, allocation, goods resolution and bank matching distinct. Use the deterministic bookkeeping engine for monetary controls. No e-Invoice integration is enabled.
