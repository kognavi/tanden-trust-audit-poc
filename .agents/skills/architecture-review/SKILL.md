---
name: architecture-review
description: Review architecture for trust-boundary integrity, AWS trade-offs, maintainability and cost. Use before significant implementation or architecture-sensitive changes.
---

# Architecture Review

1. Read root AGENTS.md, docs/architecture.md, docs/module-registry.md, relevant spec, code and tests.
2. Preserve Evidence → Schema → Sign → Store → Ledger.
3. Separate current implementation, target state, assumptions and risks.
4. Check dependency direction, responsibility overlap and operational complexity.
5. Evaluate AWS Well-Architected pillars when AWS is affected.
6. Prefer existing modules and managed services when they satisfy the requirement.
7. Flag unnecessary services, persistent idle cost and new operational burden.

Report finding, severity, evidence, trade-off, recommendation and residual risk.
