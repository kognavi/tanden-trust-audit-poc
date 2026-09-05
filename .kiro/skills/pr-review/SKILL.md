---
name: pr-review
description: Perform an independent adversarial review of a diff for correctness, security, architecture, tests, documentation and cost. Use after implementation and before merge.
---

# Pull Request Review

Review the change as if the implementation may be wrong.

Check requirement coverage, correctness, edge cases, trust-boundary preservation, privilege expansion, evidence/secret/PII leakage, tests, dependency direction, documentation, AWS operations and cost.

Do not rewrite the implementation during independent review unless explicitly asked.

Return blocking findings, non-blocking findings, validation evidence, residual risks and merge recommendation.
