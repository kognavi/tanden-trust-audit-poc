# Agent Runtime Adapter Design

## Source Context Pack
- `knowledge/20-research/loop-010-context.md`
- Context ID: `loop-010-context`

## Flow

```text
Task Graph READY task
  ↓
Runtime Adapter
  ↓
Run Evidence
  ↓
PASS / FAIL / TIMEOUT
  ↓
Task Graph event
```

## Affected Components
- `scripts/agent-runtime-adapter.js`
- `scripts/agent-task-graph.js`
- `scripts/run-verification-evidence-gate.js`
- `tests/agent-runtime-adapter.test.js`
- `tests/verification-evidence-gate.test.js`
- `tests/agent-os-structure.test.js`
- `package.json`
- `AGENTS.md`
- `.kiro/agents/developer.md`
- `.kiro/agents/reviewer.md`
- `.kiro/agents/security-reviewer.md`
- `.github/pull_request_template.md`
- `docs/ai-development-os.md`
- `docs/agent-runtime-adapter.md`
- `docs/verification-evidence-gate.md`
- `knowledge/00-inbox/loop-010-agent-runtime-adapter.md`
- `knowledge/20-research/loop-010-context.md`

## Security
- external execution disabled by default
- no shell command adapter in Loop 010
- dry-run never advances workflow
- scripted adapter is deterministic and intended for tests/local validation
- run evidence excludes raw prompt/response/secret

## Cost and Operations
- no AWS resources
- no external model/API cost
- negligible JSON artifact overhead

## Review Checklist
- [x] Requirements aligned
- [x] Security boundary explicit
- [x] Cost boundary explicit
- [x] Human Approval preserved
