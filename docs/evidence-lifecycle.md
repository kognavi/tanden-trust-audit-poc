# Evidence Lifecycle

## Purpose

This document describes the assumed lifecycle of evidence records in the Tanden Trust Audit PoC.

The purpose is to clarify how evidence is created, validated, canonicalized, hashed, verified, reviewed, and eventually retained or archived.

This PoC does not provide formal audit assurance. The lifecycle described here is intended for design, demonstration, and portfolio purposes.

## Lifecycle Overview

The evidence lifecycle consists of the following stages:

1. Event Occurrence
2. Evidence Creation
3. Schema Validation
4. Canonicalization
5. Hash Generation
6. Hash Verification
7. Evidence Storage
8. Review and Reperformance
9. Exception Handling
10. Retention and Archival

## Lifecycle Stages

### 1. Event Occurrence

A business or system event occurs.

Examples include:

- consent granted
- consent revoked
- activity recorded
- approval completed
- document acknowledged
- exception detected

In the current MVP, the primary sample event is `CONSENT_GRANTED`.

### 2. Evidence Creation

An evidence record is created as a structured JSON document.

The evidence record includes key metadata such as:

- `evidenceId`
- `schemaVersion`
- `eventType`
- `subjectId`
- `actorId`
- `occurredAt`
- `sourceSystem`
- `purpose`
- `consent`
- `metadata`

The current MVP uses synthetic demo data only.

### 3. Schema Validation

The evidence record is validated against a JSON Schema.

This stage checks whether the evidence record:

- contains required fields
- uses valid data types
- follows expected enum values
- rejects unexpected additional properties
- uses a valid date-time format for `occurredAt`

Current command:

- `npm run validate:evidence`

### 4. Canonicalization

The evidence record is converted into deterministic canonical JSON.

The current MVP uses RFC 8785 JSON Canonicalization Scheme compatible behavior.

Canonicalization ensures that equivalent JSON objects produce the same byte representation even if object key order differs.

This is important because cryptographic hashes must be calculated from stable input.

### 5. Hash Generation

A SHA-256 digest is calculated from the canonicalized evidence record.

Current command:

- `npm run hash`

The hash acts as a tamper-evident fingerprint of the evidence record.

If the evidence content changes, the calculated hash changes.

### 6. Hash Verification

A reviewer or system recalculates the hash and compares it with the expected digest.

Current command:

- `npm run verify`

If the calculated hash matches the expected hash, the evidence is considered unchanged with respect to the verified digest.

If the calculated hash does not match, the evidence should be treated as potentially tampered with or inconsistent.

### 7. Evidence Storage

In the current MVP, evidence records are stored as local sample JSON files.

Future production-oriented designs may store evidence in immutable or controlled storage.

Potential AWS implementation options include:

- Amazon S3
- S3 Object Lock
- DynamoDB
- AWS KMS
- AWS CloudTrail
- Amazon EventBridge
- Amazon CloudWatch

Storage should support integrity, traceability, access accountability, and retention requirements.

### 8. Review and Reperformance

A reviewer can independently reperform the verification process.

A typical review flow is:

1. Select an evidence record.
2. Validate it against the JSON Schema.
3. Canonicalize the evidence record.
4. Recalculate the SHA-256 hash.
5. Compare the calculated hash with the expected digest.
6. Inspect event metadata.
7. Determine whether the evidence supports the relevant control objective.

This supports audit reperformance and technical transparency.

### 9. Exception Handling

Exceptions may occur when evidence records are invalid, inconsistent, tampered with, revoked, or incomplete.

Examples include:

- schema validation failure
- missing required fields
- invalid consent status
- malformed timestamp
- hash mismatch
- unexpected additional properties
- revoked consent
- duplicate evidence ID
- missing expected digest

The current MVP includes negative tests for schema violations and tampered evidence scenarios.

Future versions may add dedicated exception evidence samples and lifecycle states.

### 10. Retention and Archival

The current MVP does not enforce retention or archival rules.

Future production-oriented designs should define:

- retention period
- archival policy
- deletion policy
- legal hold behavior
- immutable storage requirements
- lifecycle transitions
- evidence expiration rules

Potential AWS implementation options include:

- S3 Object Lock Governance Mode
- S3 Object Lock Compliance Mode
- S3 Lifecycle policies
- Glacier storage classes
- CloudTrail audit logs

## State Model

The following conceptual states may be used in future versions:

| State | Description |
|---|---|
| `CREATED` | Evidence record has been generated. |
| `VALIDATED` | Evidence passed schema validation. |
| `REJECTED` | Evidence failed schema validation. |
| `CANONICALIZED` | Evidence was converted to canonical JSON. |
| `HASHED` | Digest was calculated. |
| `VERIFIED` | Calculated digest matched expected digest. |
| `FAILED_VERIFICATION` | Calculated digest did not match expected digest. |
| `STORED` | Evidence was stored in a controlled location. |
| `REVIEWED` | Evidence was reviewed by a human or automated process. |
| `RETAINED` | Evidence is under retention control. |
| `ARCHIVED` | Evidence was moved to archival storage. |
| `EXPIRED` | Retention period has ended. |

## Current MVP Coverage

The current MVP supports:

- evidence creation using sample JSON
- JSON Schema validation
- deterministic canonicalization
- SHA-256 hash generation
- hash verification
- negative tests for invalid and tampered evidence
- basic reviewer reperformance

The current MVP does not yet support:

- trusted timestamping
- external signature verification
- AWS KMS signing
- immutable object storage
- retention enforcement
- deletion protection
- lifecycle state persistence
- automated exception workflow
- production monitoring

## Relationship to Other Design Documents

This lifecycle document complements the following documents:

- `docs/framework-selection.md`
- `docs/audit-procedures.md`
- `docs/control-mapping.md`

The relationship can be summarized as follows:

| Document | Main Question |
|---|---|
| `framework-selection.md` | Why were the current tools and architecture selected? |
| `audit-procedures.md` | How can a reviewer inspect or reperform verification? |
| `control-mapping.md` | Which control objectives are supported by which evidence fields and checks? |
| `evidence-lifecycle.md` | What lifecycle does evidence follow from creation to retention or archival? |

## Limitations

This document is conceptual and implementation-oriented.

It does not represent a formal audit opinion, certification, compliance attestation, legal conclusion, or production-ready retention policy.

The lifecycle should be reviewed by qualified audit, compliance, security, and legal professionals before production use.

## Future Enhancements

Future versions may add:

- lifecycle state machine implementation
- `case_id` and correlation ID fields
- consent revocation lifecycle
- rollback and cancellation events
- exception evidence samples
- attack scenario tests
- AWS KMS signing workflow
- S3 Object Lock retention model
- CloudTrail-based access accountability
- automated lifecycle report generation
