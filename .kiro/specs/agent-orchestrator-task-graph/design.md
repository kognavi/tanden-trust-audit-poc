# Agent Orchestrator / Task Graph Design

## Source Context Pack

- `knowledge/20-research/loop-009-context.md`
- Context ID: `loop-009-context`

## Current State

Loop 008はrole contractを持つがworkflow state machineを持たない。

## Proposed Design

```text
agent-delegation.json
        ↓
agent:graph:init
        ↓
Builder READY
        ↓ builder-pass
Reviewer READY
   ┌────┴────┐
reviewer-pass reviewer-fail
   │              ↓
   │          Builder READY (retry)
   ▼
Security Reviewer READY? (if delegated)
   ┌────┴────┐
security-pass security-fail
   │              ↓
   │          Builder READY (retry)
   ▼
Verification READY
   ┌────┴────┐
verify-pass verify-fail
   │              ↓
COMPLETE      Builder READY (retry)
```

## Events

- `builder-pass`
- `builder-fail`
- `reviewer-pass`
- `reviewer-fail`
- `security-pass`
- `security-fail`
- `verify-pass`
- `verify-fail`

## Affected Components

- `scripts/agent-task-graph.js`
- `tests/agent-task-graph.test.js`
- `tests/agent-os-structure.test.js`
- `package.json`
- `AGENTS.md`
- `.kiro/agents/developer.md`
- `.kiro/agents/reviewer.md`
- `.kiro/agents/security-reviewer.md`
- `.github/pull_request_template.md`
- `docs/ai-development-os.md`
- `docs/agent-orchestrator-task-graph.md`
- `knowledge/00-inbox/loop-009-agent-orchestrator-task-graph.md`
- `knowledge/20-research/loop-009-context.md`

## Trust Boundary Impact

- product Evidence processing flow unchanged.
- development workflow gains a deterministic state boundary.

## Security

- no network calls
- no AWS/IAM/KMS changes
- invalid or out-of-order transitions fail closed
- terminal states cannot be silently reopened

## Cost and Operations

- no AWS resource or recurring cost
- negligible local/CI JSON processing cost
- provider execution cost remains outside Loop 009

## Alternatives Considered

- external workflow engine: deferred, unnecessary for local-first PoC
- autonomous agent spawn: deferred until state semantics are stable
- free-form LLM coordinator: rejected as primary control plane because transition semantics would be nondeterministic

## Validation Plan

- init tests
- valid transition tests
- invalid transition tests
- retry routing tests
- max retry terminal tests
- optional security reviewer branch tests
- governance structure tests
- repository CI

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims checked against Loop 008 implementation.
- [x] Trust boundary impact explicit.
- [x] Security/cost/operations explicit.
- [x] Human Approval preserved.
