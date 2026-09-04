# Architecture

## Purpose

Tanden Trust Audit PoC is now positioned as an AWS-oriented **AI Agent Evidence Layer**.

The product problem is not merely "store logs safely." The goal is to preserve enough security-relevant context about an AI agent action that a reviewer can later reconstruct the control path and verify that the evidence was not altered after creation.

## Repository Trust Boundary

~~~text
Evidence → Schema → Sign → Store → Ledger
~~~

This is the repository invariant.

`EvidenceProcessingService` enforces this sequence for the production-oriented application path.

External anchoring is outside the core boundary and is optional.

## AI Agent Evidence Boundary

The AI Agent-specific profile is defined by:

- `schemas/ai-agent-evidence.schema.json`
- `docs/ai-agent-evidence-profile.md`

The intended flow is:

~~~text
AI Agent Runtime
      ↓
Collector / Adapter                planned
      ↓
AI Agent Evidence Profile
      ↓
EvidenceProcessingService
      ↓
Schema → Sign → Store → Ledger
      ↓
Independent Verification
      ↓
Immutable Retention               target
      ↓
External Trust Anchor             optional
~~~

The collector must not bypass schema validation or store raw secrets by default.

## Current Implementation

The Node.js PoC currently implements:

- JSON Schema validation
- RFC 8785 JCS canonicalization
- SHA-256 evidence digest generation
- local ECDSA P-256 signing and verification
- sidecar metadata signing and verification
- `AwsKmsProvider` using AWS KMS `ECC_SECG_P256K1` / `ECDSA_SHA_256`
- local and S3-compatible JSON object stores
- `PgEvidenceStore` for versioned PostgreSQL evidence persistence
- `PgSigningLogger` for a PostgreSQL signing-event hash chain
- `EvidenceProcessingService` for ordered processing and partial-failure reconciliation
- `VerifiedAnchorService` and `TrustAnchor.sol` for optional verified-digest anchoring
- Terraform modules for KMS signing and S3 Object Lock-oriented infrastructure

The repository also includes:

- threat modeling
- attack scenarios
- ADRs
- control mapping
- verification runbook
- CodeQL
- Semgrep
- Dependabot
- dependency-boundary validation

These are implementation and portfolio artifacts. They do not imply that a production AWS environment, PostgreSQL cluster, CloudTrail correlation pipeline, or retention policy is already deployed.

## Observability vs Evidence

The design separates:

- **runtime observability**: what an agent/runtime emits
- **audit evidence**: what a reviewer must preserve, correlate, and verify for a control objective

A runtime trace may become a source for evidence, but the system does not assume every log line belongs in the evidence record.

For AI Agent evidence, the profile prioritizes:

- actor
- agent version
- model identity
- execution correlation
- policy decision
- tool/action
- approval
- side effect
- context references
- artifact references
- privacy/retention metadata

## Data Minimization

The default AI Agent profile avoids raw:

- prompts
- responses
- credentials
- secrets
- unnecessary customer payloads

Where possible, it stores:

- references
- versions
- digests
- correlation identifiers

This is a security design default, not a universal legal conclusion.

## External Anchor

The current Web3 prototype is downstream of the core trust boundary.

~~~text
Signed + Stored Evidence
        ↓
Off-chain verification
        ↓
Verified SHA-256 digest
        ↓
TrustAnchor.sol
~~~

The contract does not prove:

- that the source event was true
- that an agent was authorized
- that human approval was valid
- that the source system was uncompromised
- that all expected events are present

It only contributes an external proof about a digest.

For that reason, blockchain is treated as an optional trust mechanism rather than the product core.

## Target AWS Architecture

A production-oriented target would add:

- agent runtime collector / adapter
- ingestion API
- least-privilege IAM
- KMS key policy and separation of duties
- S3 Versioning / Object Lock
- hardened PostgreSQL or metadata index
- CloudTrail / CloudWatch correlation
- event reconciliation
- retention operations
- backup / HA
- incident response
- independent verification tooling
- optional external trust anchoring

## Planned / Not Yet Implemented

- live AI Agent runtime collector
- production API/Lambda/EventBridge deployment
- production IAM/KMS policy enforcement
- production PostgreSQL provisioning and role separation
- deployed S3 Object Lock retention enforcement
- CloudTrail / CloudWatch evidence correlation
- completeness/gap proofs
- multi-tenant SaaS isolation
- formal compliance control certification

## Security Principles

- fail closed on schema or verification failure
- do not treat storage as the cryptographic trust boundary
- do not claim that integrity proves truthfulness
- preserve least privilege and separation of duties
- keep raw PII/secrets/private key material out of external anchors
- keep blockchain optional
- make current vs target implementation status explicit
