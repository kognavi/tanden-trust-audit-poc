# Threat Model

## Purpose

This document describes the threat model for the Tanden Trust Audit PoC.

The purpose is to identify potential threats against evidence records, hash verification, auditability, and future production-oriented architectures.

This PoC is not a production security system. The threat model is intended for design, demonstration, learning, and portfolio purposes.

## Scope

This threat model focuses on the following assets:

- evidence JSON records
- JSON Schema validation rules
- canonicalized evidence representation
- SHA-256 evidence digest
- verification process
- sample evidence files
- design documents
- future immutable storage design
- future signing and audit logging design

The current MVP runs locally and uses synthetic demo data only.

## Out of Scope

The following items are out of scope for the current MVP:

- production identity and access management
- production key management
- network perimeter security
- runtime intrusion detection
- formal compliance certification
- legal retention enforcement
- third-party audit attestation
- real personal data processing
- production blockchain anchoring
- smart contract security review

These may be considered in future versions.

## Trust Boundaries

| Boundary | Description |
|---|---|
| Local developer environment | The PoC currently runs on a local machine. |
| Evidence file boundary | Evidence JSON files are treated as input to validation, hashing, and verification. |
| Schema boundary | JSON Schema defines expected evidence structure. |
| Hash calculation boundary | Canonicalization and SHA-256 digest generation create the tamper-evident fingerprint. |
| Reviewer boundary | A reviewer independently re-runs validation and verification commands. |
| Future storage boundary | Production versions may store evidence in controlled or immutable storage. |
| Future key boundary | Production versions may use KMS-backed signing and verification. |

## Key Security Assumptions

The current MVP assumes:

- evidence samples are synthetic and do not contain real personal data
- the local development environment is trusted for demonstration purposes
- commands are executed by an authorized reviewer or developer
- the schema file has not been maliciously modified
- the verification script has not been maliciously modified
- the expected hash value is obtained from a trusted source
- Node.js and npm dependencies are trusted within the local environment

In production, these assumptions would need stronger technical controls.

## Threat Summary

| ID | Threat | Current MVP Coverage | Future Mitigation |
|---|---|---|---|
| T1 | Evidence tampering | SHA-256 verification detects content changes | Immutable storage, digital signatures, audit logs |
| T2 | Hash substitution | Not fully mitigated | Trusted digest registry, KMS signing, blockchain anchoring |
| T3 | Schema bypass | JSON Schema rejects unexpected or invalid fields | CI enforcement, schema registry, version governance |
| T4 | Replay attack | Not fully mitigated | Nonce, sequence number, event ID uniqueness, timestamp validation |
| T5 | Timestamp manipulation | Format validation only | Trusted timestamping, server-side event time, signed timestamps |
| T6 | Unauthorized evidence creation | Not mitigated in MVP | IAM, signed producer identity, API authentication |
| T7 | Evidence deletion | Not mitigated in local files | S3 Object Lock, retention policy, backups, CloudTrail |
| T8 | Insider misuse | Not mitigated in MVP | Least privilege, separation of duties, immutable logs |
| T9 | Verification script tampering | Partially covered by tests | Code review, protected branches, CI checks |
| T10 | Key compromise | Not applicable in MVP | KMS key policy, rotation, monitoring, separation of duties |
| T11 | Dependency compromise | Partially mitigated by tests only | Lockfile review, dependency scanning, SCA tools |
| T12 | Audit log tampering | Not applicable in MVP | CloudTrail, log integrity validation, centralized logging |

## Threat Details

### T1. Evidence Tampering

An attacker modifies an evidence JSON record after it has been created.

Examples include:

- changing `consent.status`
- changing `actorId`
- changing `occurredAt`
- modifying `purpose`
- deleting metadata
- changing the evidence subject

The current MVP calculates a SHA-256 hash over canonicalized JSON. If the evidence content changes, the calculated digest changes.

Current command:

- `npm run verify`

Future mitigations include S3 Object Lock, AWS KMS signatures, protected digest registries, CloudTrail logging, and blockchain anchoring.

### T2. Hash Substitution

An attacker modifies both the evidence file and the expected hash value.

The current MVP demonstrates hash verification but does not provide a trusted digest source. The expected hash is currently passed as a command-line argument.

Future mitigations include an immutable digest registry, KMS-signed digest records, transparency logs, and blockchain anchoring.

### T3. Schema Bypass

An attacker attempts to submit malformed, incomplete, or unexpected evidence data.

Examples include:

- missing required fields
- invalid `eventType`
- invalid `consent.status`
- malformed `occurredAt`
- additional unexpected properties
- wrong data types

The current MVP validates evidence records against JSON Schema.

Current command:

- `npm run validate:evidence`

Future mitigations include CI enforcement, schema registry governance, schema version checks, compatibility tests, and schema hash tracking.

### T4. Replay Attack

An attacker reuses a previously valid evidence record in a different context.

Examples include:

- resubmitting an old consent event
- reusing a valid evidence ID
- presenting outdated consent as current
- replaying evidence after consent revocation

The current MVP includes `evidenceId` and `occurredAt`, but it does not enforce uniqueness or freshness.

Future mitigations include unique evidence ID enforcement, sequence numbers, nonce values, freshness checks, duplicate rejection, and consent state indexing.

### T5. Timestamp Manipulation

An attacker changes the event timestamp or submits a misleading timestamp.

The current MVP validates that `occurredAt` uses a valid date-time format, but it does not prove that the timestamp is true or trusted.

Future mitigations include server-side timestamping, trusted timestamp authorities, signed timestamps, separate ingestion time, CloudTrail timestamps, and EventBridge timestamps.

### T6. Unauthorized Evidence Creation

An unauthorized actor creates fake evidence records, such as forged consent events or fabricated audit records.

The MVP does not implement identity, authentication, or authorization.

Future mitigations include IAM-based producer identity, API authentication, signed evidence, producer identity metadata, AWS KMS asymmetric signing, and least privilege access.

### T7. Evidence Deletion

An attacker deletes evidence records to hide activity.

The MVP uses local files and does not prevent deletion.

Future mitigations include S3 Object Lock, S3 Versioning, retention policies, replication, backup, CloudTrail monitoring, and alerts on suspicious delete operations.

### T8. Insider Misuse

A privileged insider misuses access to alter, delete, or selectively disclose evidence.

The MVP does not implement access controls or separation of duties.

Future mitigations include least privilege IAM, separation of duties, CloudTrail logging, AWS Organizations SCPs, restricted KMS key policies, approval workflows, immutable storage, and append-only logging.

### T9. Verification Script Tampering

An attacker modifies the verification script so that it always returns valid results.

Automated tests validate expected behavior.

Current command:

- `npm test`

Future mitigations include protected branches, code review, CI checks, commit signing, release checksums, code signing, restricted modification rights, and independent verification implementations.

### T10. Key Compromise

In future versions, signing keys may be compromised or misused.

The MVP does not use cryptographic signing keys.

Future mitigations include AWS KMS asymmetric keys, restricted key policies, CloudTrail logging for KMS operations, key rotation, separation of key administrators and key users, careful grant usage, and anomaly monitoring.

### T11. Dependency Compromise

A malicious dependency or compromised package may affect validation, hashing, or testing behavior.

The MVP includes automated tests, but does not perform formal dependency security scanning.

Future mitigations include `package-lock.json` review, dependency scanning, `npm audit` in CI, pinned versions, minimal dependencies, transitive dependency review, SCA tools, and SBOM generation.

### T12. Audit Log Tampering

In a production system, attackers may attempt to modify or delete logs that record evidence creation, access, verification, or deletion events.

The MVP does not implement production audit logging.

Future mitigations include CloudTrail organization trails, dedicated log accounts, S3 Object Lock for log buckets, CloudWatch Logs retention policies, centralized log aggregation, log delivery monitoring, and suspicious activity alerts.

## STRIDE Mapping

| STRIDE Category | Example Threats |
|---|---|
| Spoofing | Unauthorized evidence creation, impersonated source systems |
| Tampering | Evidence tampering, hash substitution, script tampering |
| Repudiation | Missing audit logs, lack of signed producer identity |
| Information Disclosure | Unauthorized access to evidence metadata |
| Denial of Service | Deletion of evidence, blocking verification process |
| Elevation of Privilege | Insider misuse, excessive IAM permissions |

## Current MVP Security Posture

The current MVP provides:

- deterministic canonicalization
- SHA-256 evidence digest generation
- tamper detection when expected digest is trusted
- JSON Schema validation
- negative tests for invalid evidence
- negative tests for tampered evidence
- reviewer reperformance using local commands

The current MVP does not provide:

- tamper prevention
- trusted timestamping
- trusted digest storage
- digital signatures
- access control
- immutable storage
- production audit logging
- key management
- automated alerting
- compliance certification

## Recommended Production Architecture Controls

| Control Area | Recommended Controls |
|---|---|
| Identity | IAM roles, producer identity, reviewer identity |
| Integrity | JCS canonicalization, SHA-256, KMS signatures |
| Immutability | S3 Object Lock, versioning, retention policies |
| Traceability | CloudTrail, CloudWatch Logs, EventBridge events |
| Authorization | Least privilege, separation of duties, SCPs |
| Key Management | AWS KMS asymmetric keys, restricted key policies |
| Availability | Cross-region replication, backup and restore |
| Monitoring | Security alerts, deletion detection, KMS anomaly detection |
| Governance | Schema registry, change review, protected branches |
| Long-term Trust | Blockchain anchoring, timestamping, transparency logs |

## Relationship to Other Design Documents

This threat model complements the following documents:

- `docs/framework-selection.md`
- `docs/audit-procedures.md`
- `docs/control-mapping.md`
- `docs/evidence-lifecycle.md`

| Document | Main Question |
|---|---|
| `framework-selection.md` | Why were the current tools and architecture selected? |
| `audit-procedures.md` | How can a reviewer inspect or reperform verification? |
| `control-mapping.md` | Which control objectives are supported by which evidence fields and checks? |
| `evidence-lifecycle.md` | What lifecycle does evidence follow from creation to retention or archival? |
| `threat-model.md` | What threats are considered, and how are they currently or potentially mitigated? |

## Future Enhancements

Future versions may add:

- attack scenario test cases
- dedicated tampered evidence samples
- duplicate evidence ID detection
- replay attack simulation
- expected digest registry
- AWS KMS signing and verification workflow
- S3 Object Lock reference implementation
- CloudTrail-based audit logging design
- threat-to-control mapping table
- risk severity and likelihood scoring
- blockchain anchoring design
- CI-based security checks
- dependency scanning
- SBOM generation

## Limitations

This document is a conceptual threat model for a local PoC.

It does not represent a formal security assessment, penetration test, compliance audit, legal opinion, or production security certification.

Before production use, the architecture should be reviewed by qualified security, compliance, legal, and audit professionals.
