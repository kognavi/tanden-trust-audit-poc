---
name: testing
description: Plan and execute repository validation including unit, integration, negative and tamper-detection tests. Use during implementation or before completion.
---

# Testing Workflow

1. Read relevant implementation and existing tests first.
2. Add the smallest tests that prove changed behavior.
3. Security-sensitive code should include relevant negative, failure and tamper cases.
4. Use repository package scripts as the primary interface.
5. Run npm run check:structure for implementation changes unless clearly unnecessary.
6. Run AWS integration tests only when required resources and credentials are intentionally available.
7. Never weaken tests to make CI pass.
8. Report what ran, what passed and what could not run.
