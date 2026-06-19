# Attack Scenarios

## Purpose

This document describes practical attack scenarios for the Tanden Trust Audit PoC.

The purpose is to connect the threat model, evidence lifecycle, AWS reference architecture, and KMS signing design to concrete adversarial scenarios.

This document is conceptual and intended for design, learning, and portfolio purposes.

## Scope

This document focuses on threats against:

- evidence records
- hash generation
- signature generation
- metadata integrity
- storage immutability
- verification workflows
- IAM and KMS permissions
- audit logging
- CI/CD and dependencies

The current MVP is a local prototype. Some controls described here are future production-oriented controls.

## Scenario Summary

| Scenario | Main Risk | Primary Controls |
|---|---|---|
| Evidence tampering | Evidence JSON is modified after creation. | Canonicalization, SHA-256 digest, verification. |
| Expected hash substitution | Evidence and expected hash are replaced together. | KMS signing, metadata protection, audit logs. |
| Replay attack | Old valid evidence is submitted again. | Unique evidenceId, ingestedAt, producer identity, conditional writes. |
| Unauthorized producer | Untrusted actor submits fake evidence. | API authentication, IAM, producer allowlist. |
| Schema bypass | Malicious fields are added to evidence. | JSON Schema, additionalProperties false, schema version control. |
| Timestamp manipulation | Business event time is falsified. | Server-side ingestedAt, clock controls, audit review. |
| S3 deletion attempt | Evidence artifacts are deleted or overwritten. | S3 Object Lock, Versioning, bucket policy, CloudTrail. |
| KMS key misuse | Unauthorized actor signs misleading evidence. | Least privilege, KMS key policy, CloudTrail alerts. |
| KMS key deletion | Historical evidence becomes unverifiable. | Key lifecycle policy, deletion alerts, retention planning. |
| Insider admin risk | Privileged user modifies multiple trust layers. | Separation of duties, SCPs, reviews, audit logs. |
| CI/CD compromise | Verification logic is changed maliciously. | Branch protection, tests, reviews, dependency checks. |
| Dependency compromise | Hashing or validation dependency is compromised. | Lockfiles, minimal dependencies, audits, reproducible tests. |

## Scenario 1: Evidence Tampering

### Description

An attacker modifies an evidence JSON file after it has been created.

Examples:

- changing consent status from denied to granted
- changing subjectId
- changing occurredAt
- changing metadata fields
- removing evidence fields

### Attack Path

1. Attacker obtains write access to an evidence file.
2. Attacker modifies the JSON content.
3. Attacker attempts to present the modified evidence as authentic.
4. Reviewer runs verification.

### Expected Detection

The recalculated digest should differ from the expected digest.

### Current MVP Controls

- deterministic JSON canonicalization
- SHA-256 digest generation
- digest verification
- negative tests for tampered evidence

### Future AWS Controls

- S3 Object Lock
- S3 Versioning
- CloudTrail data events
- KMS signature verification
- DynamoDB metadata registry

### Residual Risk

If the attacker can also replace the expected digest or verification metadata, hash-only verification may not be sufficient.

This leads to the next scenario: expected hash substitution.

## Scenario 2: Expected Hash Substitution

### Description

An attacker modifies both the evidence and the expected digest so that verification still appears valid.

### Attack Path

1. Attacker changes evidence content.
2. Attacker recalculates the SHA-256 digest.
3. Attacker replaces the stored expected digest.
4. Hash verification passes because the evidence and digest match.

### Impact

Hash verification alone confirms consistency, not authority.

It proves that the evidence matches the digest, but not that the digest came from a trusted system.

### Current MVP Controls

- hash mismatch detection
- tests for wrong expected hash

### Future AWS Controls

- AWS KMS asymmetric signing
- signature over digest or canonical evidence
- CloudTrail logs for KMS Sign
- restricted kms:Sign permission
- immutable storage for metadata
- separation between evidence producers and signers

### Recommended Control Logic

Verification should check:

1. schema validity
2. canonicalization result
3. recalculated digest
4. stored digest match
5. KMS signature validity
6. authorized signer identity
7. metadata consistency

## Scenario 3: Replay Attack

### Description

An attacker resubmits a previously valid evidence record to create misleading duplicate evidence.

### Attack Path

1. Attacker obtains a valid old evidence record.
2. Attacker resubmits it through the ingestion endpoint.
3. System accepts the old record as new evidence.
4. Audit trail contains misleading or duplicated events.

### Impact

Replay may create false audit history even if the evidence is cryptographically valid.

### Controls

- globally unique evidenceId
- server-side ingestedAt timestamp
- producer identity
- DynamoDB conditional writes
- duplicate evidenceId rejection
- event sequence checks where appropriate
- replay detection based on event type and subjectId

### Future AWS Controls

- API Gateway authentication
- Lambda idempotency
- DynamoDB conditional PutItem
- EventBridge duplicate monitoring
- CloudWatch alarms for repeated evidence submissions

## Scenario 4: Unauthorized Producer

### Description

An untrusted actor submits fake evidence into the system.

### Attack Path

1. Attacker discovers or accesses ingestion endpoint.
2. Attacker submits syntactically valid evidence.
3. System validates schema and stores evidence.
4. Fake evidence enters the audit trail.

### Impact

Valid schema does not mean trusted origin.

### Controls

- API authentication and authorization
- producer allowlist
- IAM roles for trusted producers
- request signing where appropriate
- mTLS or private network access for high-trust systems
- producer identity stored in metadata
- CloudTrail and application logs

### Future AWS Controls

- API Gateway authorizers
- IAM authorization
- AWS WAF where appropriate
- VPC endpoints for internal producers
- EventBridge rules for unexpected producers

## Scenario 5: Schema Bypass

### Description

An attacker adds unexpected fields or malformed structures to evidence records.

Examples:

- hidden approval field
- nested object with misleading data
- additional metadata not reviewed by auditors
- unsupported schema version

### Attack Path

1. Attacker crafts JSON with extra or misleading fields.
2. System accepts the data without strict validation.
3. Reviewers interpret the evidence incorrectly.

### Current MVP Controls

- JSON Schema validation
- required fields
- data type validation
- date-time validation
- enum validation
- rejection of additional properties

### Recommended Controls

- reject unknown schema versions
- maintain schema change review process
- test negative cases
- document schema migration rules
- store schemaVersion with evidence metadata

## Scenario 6: Timestamp Manipulation

### Description

An attacker manipulates the business event timestamp, such as occurredAt.

### Attack Path

1. Attacker submits evidence with false occurredAt.
2. System accepts the timestamp as true.
3. Audit timeline becomes misleading.

### Impact

Even if the evidence is intact, the represented business event time may be false.

### Controls

- store server-side ingestedAt
- record producer identity
- compare occurredAt and ingestedAt
- alert on large timestamp skew
- use trusted time sources for producer systems
- document timestamp semantics

### Future AWS Controls

- Lambda-generated ingestedAt
- CloudTrail eventTime
- CloudWatch Logs timestamps
- EventBridge event time
- monitoring for abnormal time gaps

## Scenario 7: S3 Deletion or Overwrite Attempt

### Description

An attacker attempts to delete, overwrite, or hide evidence artifacts stored in S3.

### Attack Path

1. Attacker gains S3 write or delete permission.
2. Attacker deletes or overwrites original evidence.
3. Reviewer cannot access the correct artifact.

### Impact

Evidence availability and integrity are compromised.

### Future AWS Controls

- S3 Object Lock
- S3 Versioning
- bucket policy deny for delete actions
- least privilege IAM
- CloudTrail data events
- S3 server access logs where appropriate
- replication for critical evidence

### Recommended Alerts

- DeleteObject attempted
- PutBucketObjectLockConfiguration changed
- bucket policy changed
- version deletion attempted
- public access configuration changed

## Scenario 8: KMS Key Misuse

### Description

An attacker or overly privileged role uses KMS Sign to sign misleading evidence.

### Attack Path

1. Attacker obtains access to a role with kms:Sign.
2. Attacker creates misleading evidence.
3. Attacker signs the digest with the legitimate KMS key.
4. Signature verification passes.

### Impact

Cryptographic validity does not guarantee business validity if signing authority is misused.

### Controls

- restrict kms:Sign to ingestion role only
- separate KMS key administrators from signers
- require controlled ingestion workflow
- log all kms:Sign events
- alert on unusual signing volume
- alert on signing by unexpected principal
- require code review for ingestion logic changes

### Future AWS Controls

- KMS key policy restrictions
- IAM Access Analyzer
- CloudTrail alerts
- Security Hub findings
- Organizations SCP guardrails

## Scenario 9: KMS Key Deletion or Disablement

### Description

A KMS key needed for historical evidence verification is disabled or scheduled for deletion.

### Attack Path

1. Privileged actor disables the KMS key.
2. Historical signatures can no longer be verified through normal workflow.
3. Audit evidence becomes harder to validate.

### Impact

Long-term evidence verifiability is weakened.

### Controls

- restrict kms:DisableKey and kms:ScheduleKeyDeletion
- alert on key disablement or deletion scheduling
- document key lifecycle policy
- retain old keys for evidence retention period
- record kmsKeyId with every signature
- test verification of historical evidence

## Scenario 10: Insider Admin Risk

### Description

A privileged insider modifies multiple layers of the system.

Examples:

- changing evidence files
- changing metadata
- changing IAM permissions
- changing KMS key policy
- disabling CloudTrail
- modifying verification code

### Impact

A single highly privileged actor may bypass multiple controls.

### Controls

- separation of duties
- least privilege
- multi-party review for sensitive changes
- protected branches
- CloudTrail organization trails
- AWS Config
- Security Hub
- SCP guardrails
- break-glass access monitoring

### Key Principle

No single actor should be able to create, modify, sign, approve, and delete audit evidence without detection.

## Scenario 11: CI/CD Compromise

### Description

An attacker modifies validation or verification code through the software delivery pipeline.

### Attack Path

1. Attacker compromises a developer account or CI/CD token.
2. Attacker changes verification logic.
3. Tests are weakened or bypassed.
4. Malicious logic is merged or deployed.

### Impact

The system may report invalid evidence as valid.

### Controls

- branch protection
- pull request reviews
- required status checks
- signed commits where appropriate
- least privilege CI/CD tokens
- dependency review
- test coverage for negative cases
- review of security-sensitive code paths

### Relevant Files

- validation scripts
- hash generation scripts
- verification scripts
- schema files
- tests
- GitHub Actions workflows

## Scenario 12: Dependency Compromise

### Description

A third-party package used for validation, canonicalization, hashing, or tooling is compromised.

### Attack Path

1. Dependency package is compromised.
2. Malicious version enters the project.
3. Validation or hashing behavior changes.
4. Evidence verification becomes unreliable.

### Controls

- use package-lock.json
- minimize dependencies
- review dependency updates
- run npm audit where appropriate
- pin major versions
- maintain deterministic tests
- test canonicalization behavior
- avoid unnecessary runtime dependencies

## Control Mapping by Scenario

| Scenario | Prevent | Detect | Recover |
|---|---|---|---|
| Evidence tampering | S3 Object Lock, IAM | Hash verification, CloudTrail | Restore previous version |
| Hash substitution | KMS signing | Signature verification | Rebuild metadata from immutable records |
| Replay attack | Unique ID, conditional writes | Duplicate detection | Reject duplicate evidence |
| Unauthorized producer | API auth, IAM | Unexpected producer alerts | Revoke access |
| Schema bypass | JSON Schema | Validation failure logs | Reject evidence |
| Timestamp manipulation | Server-side timestamps | Skew alerts | Reviewer investigation |
| S3 deletion | Object Lock | DeleteObject alerts | Restore version or replica |
| KMS misuse | Key policy | kms:Sign anomaly alerts | Disable role, investigate logs |
| Key deletion | Restricted admin actions | deletion scheduled alerts | Cancel deletion |
| Insider admin risk | Separation of duties | CloudTrail, Config | Incident response |
| CI/CD compromise | Branch protection | review and CI alerts | revert commit |
| Dependency compromise | lockfile | audit and tests | pin or replace dependency |

## Relationship to Current MVP

The current MVP already demonstrates important controls:

- schema validation
- deterministic canonicalization
- SHA-256 digest generation
- hash verification
- positive and negative tests
- documented audit procedures
- control mapping
- evidence lifecycle
- threat model
- AWS reference architecture
- KMS signing design

This document extends those controls by describing how they respond to practical attack scenarios.

## Relationship to Other Design Documents

This document complements:

- `docs/framework-selection.md`
- `docs/audit-procedures.md`
- `docs/control-mapping.md`
- `docs/evidence-lifecycle.md`
- `docs/threat-model.md`
- `docs/aws-reference-architecture.md`
- `docs/kms-signing-design.md`

## Well-Architected Framework Alignment

| Pillar | Alignment |
|---|---|
| Operational Excellence | Scenarios support runbooks, alerts, and reviewer procedures. |
| Security | Attack paths are mapped to preventive and detective controls. |
| Reliability | Recovery controls support evidence availability and verification continuity. |
| Performance Efficiency | Scenario controls favor managed services and targeted verification. |
| Cost Optimization | Controls can be prioritized by risk and evidence criticality. |
| Sustainability | Managed detection and lifecycle controls reduce operational burden. |

## Limitations

This document is a conceptual security design artifact.

It does not represent a formal penetration test, threat intelligence report, incident response plan, compliance certification, legal conclusion, or production security approval.

Before production use, the scenarios and controls should be reviewed by qualified security engineers, AWS architects, compliance professionals, legal professionals, and auditors.
