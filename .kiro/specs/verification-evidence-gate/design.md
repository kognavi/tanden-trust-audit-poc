# Verification & Evidence Gate Design

## Source Context Pack

- `knowledge/20-research/loop-007-context.md`
- Context ID: `loop-007-context`

## Current State

Loop 006はImplementation Conformanceをdeterministicに判定するが、validation resultsを一つのdurable Evidence Packへまとめていない。

## Proposed Design

```text
READY Spec + Implementation Handoff
  ↓
Implementation Conformance
  ↓
npm run check:structure
  ↓
Sensitive path?
  ├─ no  → continue
  └─ yes → security-review.md PASS required
  ↓
Verification Evidence payload
  ↓
SHA-256 digest
  ↓
verification-evidence.json
  ↓
VERIFIED / NOT VERIFIED
```

## Affected Components

- `scripts/run-verification-evidence-gate.js`
- `tests/verification-evidence-gate.test.js`
- `tests/agent-os-structure.test.js`
- `package.json`
- `AGENTS.md`
- `.kiro/agents/developer.md`
- `.github/pull_request_template.md`
- `docs/ai-development-os.md`
- `docs/verification-evidence-gate.md`
- `knowledge/00-inbox/loop-007-verification-evidence-gate.md`
- `knowledge/20-research/loop-007-context.md`

## Trust Boundary Impact

- Product Evidence → Schema → Sign → Store → Ledger flow is unchanged.
- Loop 007 operates only on repository development governance artifacts.

## Security

- No new IAM/KMS/AWS permissions.
- No network calls.
- Sensitive implementation paths require an explicit independent security-review artifact.
- SHA-256 digest is integrity-only and not treated as signer authenticity.

## Cost and Operations

- No AWS resource or recurring cost.
- Local/CI CPU cost increases only by one existing `npm run check:structure` execution when the Gate CLI is run.

## Alternatives Considered

- PR/GitHub API based release gate: deferred because it introduces network/token coupling.
- LLM semantic judge: deferred because it is nondeterministic and less auditable.
- Always require security review: rejected as excessive ceremony for non-sensitive changes.

## Validation Plan

- Unit tests with injected conformance/structure results.
- Sensitive-path positive and negative cases.
- Digest verification and tamper case.
- Existing `npm run check:structure` remains the repository validation interface.

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims were checked against code/tests/module registry.
- [x] Trust boundary impact is explicit.
- [x] Security/cost/operations are explicit.
- [x] Human Approval identified where required.
