# Multi-Agent Delegation

## Purpose

Loop 008 separates implementation from review using a portable repository contract.

The first version does not auto-spawn AI agents. It defines who is allowed to act as Builder, Reviewer and Security Reviewer, then connects those roles to Verification Evidence.

## Command

```bash
npm run agent:delegate -- <feature-slug> <builder-id> <reviewer-id> [security-reviewer-id]
```

Example:

```bash
npm run agent:delegate -- my-feature codex-builder codex-reviewer codex-security
```

This writes:

```text
.kiro/specs/<feature>/agent-delegation.json
```

## Roles

### Builder

- implements the reviewed Spec
- adds/updates tests
- runs implementation checks
- must not approve its own implementation as Reviewer

### Reviewer

- is independent from the Builder
- reviews requirements/design against diff and tests
- records outcome in `reviewer-review.md`
- should remain read-oriented while reviewing

Required format:

```markdown
# Reviewer Review

- Status: PASS
- Reviewed by: codex-reviewer
```

### Security Reviewer

Required only when Implementation Conformance detects sensitive paths.

- must differ from Builder
- reviews trust boundary, IAM/KMS, secrets, evidence handling and negative tests
- records outcome in `security-review.md`

```markdown
# Security Review

- Status: PASS
- Reviewed by: codex-security
```

## Verification integration

`npm run verify:gate -- <feature-slug> [base-ref]` now requires:

1. valid `agent-delegation.json`
2. distinct Builder / Reviewer identities
3. Reviewer PASS artifact matching delegated Reviewer
4. for sensitive changes, delegated Security Reviewer
5. Security Review PASS artifact matching delegated Security Reviewer
6. existing Implementation Conformance and structure validation

PASS Evidence includes:

- Builder identity
- Reviewer identity
- Security Reviewer identity when applicable
- Reviewer result
- Security Reviewer result
- changed/sensitive files
- existing provenance and SHA-256 digest

## Important limitation

Role IDs are provenance labels. They do not cryptographically prove who controlled a model/account/session.

Loop 008 therefore improves separation of duties and auditability, but does not provide strong identity attestation.

## Standard flow

```text
Context
  ↓
Spec
  ↓
Readiness
  ↓
Implementation Handoff
  ↓
Agent Delegation
  ├─ Builder
  ├─ Reviewer
  └─ Security Reviewer (risk-based)
  ↓
Implementation
  ↓
Conformance
  ↓
Independent Review(s)
  ↓
Verification Evidence
  ↓
Human Merge Decision
```

## Non-goals

- provider-specific multi-agent spawning
- autonomous merge
- autonomous deployment
- cryptographic reviewer identity
- removal of Human Approval
