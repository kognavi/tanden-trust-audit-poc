---
id: loop-009-context
type: research
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - knowledge/30-learnings/loop-008-multi-agent-delegation.md
  - scripts/create-agent-delegation.js
  - scripts/run-verification-evidence-gate.js
supports:
  - loop-009-agent-orchestrator-task-graph
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 009 Context

## Current gap

Loop 008でrole separationは固定できたが、実行順序、retry、failure routing、terminal stateをmachine-readableに管理していない。

## Decision

初版Orchestratorはprovider-specific agent executionを行わず、repository内JSON state machineとして実装する。

`.kiro/specs/<feature>/agent-task-graph.json` を正本とし、event-driven transitionをCLIで適用する。

## Default graph

```text
Builder
  ↓ PASS
Reviewer
  ├─ PASS → Security Reviewer or Verification
  └─ FAIL → Builder retry
Security Reviewer
  ├─ PASS → Verification
  └─ FAIL → Builder retry
Verification
  ├─ PASS → COMPLETE
  └─ FAIL → Builder retry
```

retry上限を超えた場合はFAILED terminal stateへ移行する。
