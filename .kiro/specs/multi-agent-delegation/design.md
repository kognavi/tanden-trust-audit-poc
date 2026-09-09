# Multi-Agent Delegation Design

## Source Context Pack

- `knowledge/20-research/loop-008-context.md`
- Context ID: `loop-008-context`

## Current State

DeveloperとSecurity Reviewerは存在するが、delegation identityとreview evidenceがVerification Gateに接続されていない。

## Proposed Design

```text
Spec Readiness
  ↓
Implementation Handoff
  ↓
Agent Delegation
  ├─ Builder
  ├─ Reviewer
  └─ Security Reviewer (risk-based)
  ↓
Builder implements
  ↓
Implementation Conformance
  ↓
Reviewer Review
  ↓
Security Review (sensitive only)
  ↓
Verification & Evidence Gate
  ↓
Role provenance in Evidence Pack
  ↓
Human merge decision
```

## Affected Components

- `scripts/create-agent-delegation.js`
- `scripts/run-verification-evidence-gate.js`
- `tests/multi-agent-delegation.test.js`
- `tests/verification-evidence-gate.test.js`
- `tests/agent-os-structure.test.js`
- `package.json`
- `AGENTS.md`
- `.kiro/agents/developer.md`
- `.kiro/agents/reviewer.md`
- `.kiro/agents/security-reviewer.md`
- `.github/pull_request_template.md`
- `docs/ai-development-os.md`
- `docs/multi-agent-delegation.md`
- `knowledge/00-inbox/loop-008-multi-agent-delegation.md`
- `knowledge/20-research/loop-008-context.md`

## Trust Boundary Impact

- Product Evidence processing boundary is unchanged.
- New boundary is development governance only: Builder cannot satisfy Reviewer role.

## Security

- No AWS/IAM/KMS/network permission changes.
- Reviewer is read-oriented and should not modify source unless explicitly reassigned.
- securityReviewer is required only when Loop 006 marks sensitive paths.
- Role IDs are provenance labels, not cryptographically authenticated identities.

## Cost and Operations

- No AWS resource or recurring cost.
- Additional local/CI cost is negligible JSON/Markdown validation.
- Multi-agent provider execution is outside this Loop.

## Alternatives Considered

- Auto-spawn 3 AI agents: deferred due provider coupling and operational complexity.
- One general Agent with self-review: rejected due weak separation of duties.
- Security review for every change: rejected as unnecessary ceremony.

## Validation Plan

- delegation generator unit tests
- same-identity negative tests
- Verification Gate reviewer artifact tests
- sensitive security reviewer identity tests
- governance structure tests
- repository CI

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims were checked against agents/code/tests.
- [x] Trust boundary impact is explicit.
- [x] Security/cost/operations are explicit.
- [x] Human Approval identified where required.
