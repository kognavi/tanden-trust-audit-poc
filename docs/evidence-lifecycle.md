# Evidence Lifecycle

## Purpose

This document describes the target lifecycle for AI Agent audit evidence in Tanden Trust Audit PoC.

The lifecycle starts with a security-relevant agent event and ends with review, retention, and eventual disposition.

This is a technical design, not a formal audit or legal retention policy.

## Lifecycle Overview

1. Agent event occurs
2. Runtime signal is collected
3. Evidence envelope is created
4. Schema validation
5. Canonicalization
6. Cryptographic signing
7. Versioned evidence storage
8. Ledger append
9. Optional immutable retention
10. Independent review / reperformance
11. Exception and reconciliation handling
12. Retention / archival / disposition
13. Optional external trust anchoring

## 1. Agent Event

A security-relevant action occurs.

Examples:

- an agent calls a write-capable tool
- an agent sends a message
- an agent updates a customer or financial record
- an agent requests or receives human approval
- an agent is blocked by policy
- an agent performs a destructive action

The current repository contains a synthetic tool-call sample.

## 2. Runtime Collection

Target state:

A collector/adapter receives runtime metadata from an agent platform.

The collector is not yet implemented.

It should collect only the context required for the control objective and must avoid unnecessary secrets/PII.

## 3. Evidence Envelope

The collector maps the event to:

- `schemas/ai-agent-evidence.schema.json`

Key categories include:

- actor
- agent
- model
- execution
- policy
- action
- approval
- side effect
- context references
- artifact references
- governance metadata

## 4. Schema Validation

Validation occurs before signing.

Invalid evidence fails closed.

For the synthetic profile:

~~~bash
npm run validate:agent-evidence
~~~

## 5. Canonicalization

The evidence object is canonicalized using RFC 8785 JCS-compatible behavior.

This creates stable cryptographic input.

## 6. Signing

The evidence is signed using the configured signing provider.

Current implementations include:

- local ECDSA provider
- `AwsKmsProvider`

A signature contributes authenticity relative to a key, but does not prove that the source event was truthful.

## 7. Versioned Storage

`PgEvidenceStore` supports versioned evidence persistence.

The target architecture may also use S3 for immutable object retention.

## 8. Ledger Append

`PgSigningLogger` records signing events in a hash-chained PostgreSQL ledger.

`EvidenceProcessingService` enforces the ordered flow and exposes reconciliation data when storage succeeds but ledger append fails.

## 9. Immutable Retention

Target state:

- S3 Versioning
- S3 Object Lock
- controlled retention
- legal hold where required
- least-privilege administration

A Terraform S3 WORM module exists, but production retention operations are not yet deployed.

## 10. Independent Review

A reviewer should be able to:

1. retrieve the evidence
2. validate schema
3. recalculate the digest
4. verify the signature
5. inspect actor/agent/model/policy/action/approval/side-effect context
6. resolve referenced artifacts where authorized
7. inspect store/ledger references
8. identify missing evidence or unresolved exceptions

## 11. Exception and Reconciliation

Examples:

- schema validation failure
- signing failure
- duplicate evidence version
- storage failure
- ledger append failure
- missing referenced artifact
- verification failure
- approval mismatch
- side-effect mismatch
- missing sequence / suspected evidence gap

The current implementation already distinguishes partial failure after storage and preserves reconciliation metadata for ledger retry.

## 12. Retention / Archival / Disposition

A production policy should define:

- retention period
- retention class
- archive tier
- legal hold
- deletion authority
- evidence expiration
- verification requirements before disposal

These decisions require audit, legal, privacy, compliance, and security input.

## 13. Optional External Trust Anchor

After off-chain verification, a verified digest may be anchored outside the primary storage boundary.

Current prototype:

- Ethereum Sepolia
- `VerifiedAnchorService`
- `TrustAnchor.sol`

This step is optional.

It must not become a substitute for source authenticity, IAM controls, approval evidence, retention, or operational monitoring.

## Target State Model

| State | Meaning |
|---|---|
| `COLLECTED` | Runtime signal captured |
| `VALIDATED` | Evidence profile validation passed |
| `REJECTED` | Validation failed |
| `SIGNED` | Cryptographic signature created |
| `STORED` | Versioned evidence persisted |
| `LEDGERED` | Signing/processing event recorded |
| `RECONCILIATION_REQUIRED` | partial failure requires repair |
| `VERIFIED` | reviewer/system successfully reperformed verification |
| `FAILED_VERIFICATION` | integrity/authenticity verification failed |
| `RETAINED` | retention control active |
| `ARCHIVED` | moved to archive |
| `DISPOSED` | retention period ended and authorized disposal completed |

This state model is conceptual and not yet implemented as a persistent state machine.

## Security Notes

- logs and evidence are not identical
- integrity does not prove truthfulness
- completeness remains a major future control
- raw secrets should not be copied into evidence by default
- references/digests require resolvers and retention guarantees
- external anchors are optional

## Current Next Step

Implement one live runtime collector and run the full lifecycle for one security-relevant tool call.
