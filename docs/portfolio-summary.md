# Portfolio Summary

## Project

**Tanden Trust Audit PoC**

## Positioning

An AWS-oriented **AI Agent Evidence Layer** proof of concept.

The project explores how security-relevant AI agent actions can be transformed into structured, tamper-evident evidence that can later be independently reviewed.

## Problem

Modern AI agents can invoke tools, update records, send messages, and create external side effects.

Runtime observability may show that an event occurred, but audit and compliance reviewers often need stronger answers:

- who or what initiated the action
- which agent/model configuration executed it
- what policy decision applied
- which tool and target were involved
- whether human approval was required
- what side effect occurred
- which source/context objects influenced the action
- whether the evidence was altered after creation

This project treats that as an **evidence engineering** problem rather than a logging problem.

## Core Design

~~~text
AI Agent Event
    ↓
Structured Evidence
    ↓
Schema Validation
    ↓
Cryptographic Signing
    ↓
Versioned Evidence Storage
    ↓
Hash-Chained Ledger
    ↓
Independent Verification
    ↓
Optional External Trust Anchor
~~~

The repository-wide invariant is:

~~~text
Evidence → Schema → Sign → Store → Ledger
~~~

## AI Agent Evidence Profile

Added in the portfolio repositioning:

- `schemas/ai-agent-evidence.schema.json`
- `samples/ai-agent-tool-call.json`
- `tests/ai-agent-evidence-schema.test.js`
- `docs/ai-agent-evidence-profile.md`

The profile records:

- actor identity
- agent ID and version
- model provider and model ID
- trace/session/task correlation
- policy ID/version/decision
- tool/action/target
- approval context
- resulting side effect
- referenced context objects and digests
- output artifact references and digests
- PII/secrets/retention metadata

Raw prompts, secrets, credentials, and unnecessary customer payloads are intentionally not part of the default profile.

## Implemented Technical Capabilities

### Software engineering

- Node.js
- JSON Schema
- RFC 8785 JCS
- automated tests
- dependency-boundary checks
- GitHub Actions

### Security engineering

- SHA-256 tamper detection
- local ECDSA verification
- AWS KMS signing provider
- threat modeling
- STRIDE analysis
- attack scenarios
- fail-closed validation
- partial-failure reconciliation
- sidecar integrity verification

### Evidence storage

- local JSON object store
- S3-compatible object store
- PostgreSQL versioned evidence store
- PostgreSQL signing-event hash chain

### AWS architecture

- AWS KMS integration
- S3 Object Lock Terraform module
- AWS Budgets cost guardrail
- production-oriented IAM / CloudTrail / CloudWatch / retention design
- explicit distinction between current PoC and target architecture

### External proof

- Ethereum Sepolia `TrustAnchor.sol`
- off-chain verification gate
- digest-only anchoring
- no raw evidence or PII on-chain

The external anchor is optional and is no longer the project’s primary positioning.

## What This Demonstrates to Employers

The project is intended to demonstrate ability in:

- Cloud Security
- AI Security / AI Governance
- GRC-oriented engineering
- DevSecOps
- AWS architecture
- cryptographic integrity
- secure system design
- threat modeling
- auditability and evidence lifecycle design

## What This Demonstrates to Potential Customers

The product hypothesis is:

> Organizations deploying AI agents may need a standardized way to reconstruct important agent actions and verify that the resulting audit evidence has not been altered.

The next validation step is not more cryptography.

It is customer discovery with:

- AI Agent / SaaS teams
- internal audit
- compliance
- security engineering
- cloud platform teams
- AWS audit trail owners

## Current Limitations

This repository is not:

- a production SaaS
- a compliance certification
- an audit opinion
- a legal conclusion
- proof that source events were truthful
- a complete AI Agent runtime integration

Remaining gaps include:

- live runtime collectors
- production identity binding
- deployed WORM retention
- CloudTrail/CloudWatch correlation
- completeness/gap proofs
- multi-tenant isolation
- formal control-framework mappings

## Interview Explanation

> I built an AWS-oriented evidence integrity PoC for AI agent actions. It validates structured evidence, canonicalizes it deterministically, signs it with local or AWS KMS providers, stores versioned evidence, and records signing events in a PostgreSQL hash chain. I added an AI-agent-specific evidence profile covering actor, agent, model, policy, tool action, approval, side effect, and evidence lineage. The project also includes threat modeling, security automation, immutable-retention design, and an optional external blockchain anchor. My next step is integrating a live AI agent runtime and validating evidence requirements with audit and compliance practitioners.

## Next Milestone

Build one real collector/adapter for a live AI agent runtime and demonstrate:

1. security-relevant tool call
2. AI Agent Evidence envelope generation
3. schema validation
4. signing
5. storage
6. ledger append
7. tamper detection
8. auditor-facing verification
