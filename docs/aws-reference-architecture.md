# AWS Reference Architecture

## Purpose

This document describes a production-oriented AWS reference architecture for the Tanden Trust Audit PoC.

The purpose is to show how the local MVP could be extended into a secure, auditable, scalable, and tamper-evident evidence management architecture on AWS.

This document is conceptual and intended for design, learning, and portfolio purposes.

## Current MVP Summary

The current MVP provides:

- JSON evidence records
- JSON Schema validation
- deterministic JSON canonicalization
- SHA-256 hash generation
- hash verification
- automated tests
- audit procedure documentation
- control mapping documentation
- evidence lifecycle documentation
- threat model documentation

The MVP currently does not provide:

- production IAM
- immutable storage
- digital signatures
- centralized audit logging
- managed key protection
- retention enforcement
- multi-account security boundaries

## Target Architecture Goals

| Goal | Description |
|---|---|
| Integrity | Detect unauthorized changes to evidence records. |
| Immutability | Prevent or strongly restrict deletion and overwriting. |
| Authenticity | Prove which system created evidence. |
| Traceability | Record creation, access, verification, and administrative actions. |
| Reperformance | Allow reviewers to independently verify evidence. |
| Least Privilege | Restrict access by role and responsibility. |
| Retention | Preserve evidence for required periods. |
| Monitoring | Detect suspicious actions and operational failures. |
| Scalability | Support event-driven ingestion and verification. |
| Cost Control | Use managed services and lifecycle policies appropriately. |

## Trust Boundary Model

The production-oriented design separates trust boundaries explicitly.

| Boundary | Description | Design implication |
|---|---|---|
| Producer boundary | External or upstream systems that submit evidence events. | Producers are authenticated and authorized, but submitted payloads are still validated and canonicalized. |
| Ingestion boundary | API Gateway and Lambda receive, validate, and normalize evidence. | Direct writes to evidence storage should be restricted; ingestion should happen through controlled workflows. |
| Storage boundary | S3 and DynamoDB preserve evidence artifacts and metadata. | Evidence objects, digests, signatures, and metadata should be protected with least privilege and audit logging. |
| Key management boundary | AWS KMS protects signing keys. | Key administrators should not be able to sign evidence, and signing roles should not administer keys. |
| Audit boundary | CloudTrail, CloudWatch, Config, and security services record operational and administrative activity. | Audit logs should be stored separately and protected from modification. |
| Reviewer boundary | Auditors or reviewers reperform verification. | Reviewers should have read-only access to evidence, metadata, signatures, and verification material. |

This separation prevents the architecture from relying on a single trusted component.


## High-Level AWS Service Mapping

| Layer | AWS Services | Purpose |
|---|---|---|
| Ingestion | Amazon API Gateway, AWS Lambda | Receive evidence events from trusted producers. |
| Validation | AWS Lambda, JSON Schema | Validate evidence structure and required fields. |
| Canonicalization and Hashing | AWS Lambda | Produce canonical JSON and SHA-256 digest. |
| Signing | AWS KMS | Sign SHA-256 digests derived from canonical evidence records. |
| Evidence Store | Amazon S3 | Store original and canonical evidence artifacts. |
| Immutability | S3 Object Lock, S3 Versioning | Protect evidence from deletion or overwriting. |
| Metadata Store | Amazon DynamoDB | Store evidence metadata, digest, status, and lifecycle state. |
| Event Bus | Amazon EventBridge | Publish evidence lifecycle events. |
| Audit Logging | AWS CloudTrail, CloudWatch Logs | Record API activity and application logs. |
| Monitoring | CloudWatch Alarms, SNS, Security Hub, GuardDuty | Detect and notify on operational or security events. |
| Governance | AWS Config, IAM Access Analyzer | Monitor configuration drift and access exposure. |
| Archive | S3 Glacier storage classes | Archive evidence according to lifecycle policy. |

## Conceptual Data Flow

1. A trusted producer sends an evidence event to Amazon API Gateway.
2. API Gateway authenticates or authorizes the request.
3. AWS Lambda receives the evidence payload.
4. Lambda validates the payload against JSON Schema.
5. Lambda canonicalizes the evidence.
6. Lambda calculates a SHA-256 digest.
7. Lambda signs the digest using an AWS KMS asymmetric key.
8. Original and canonical evidence artifacts are stored in Amazon S3.
9. S3 Versioning and S3 Object Lock protect stored evidence.
10. Evidence metadata, digest, signature, schema version, and lifecycle state are stored in DynamoDB.
11. EventBridge publishes lifecycle events.
12. CloudTrail records AWS API activity.
13. CloudWatch Logs records application-level validation and verification logs.
14. Reviewers reperform validation and verification using stored evidence, digest, and signature.

## Reference Architecture Diagram

```text
Trusted Producer
      |
      v
Amazon API Gateway
      |
      v
AWS Lambda - Evidence Ingestion
      |
      |-- Validate JSON Schema
      |-- Canonicalize JSON
      |-- Calculate SHA-256 Digest
      |-- Sign Digest with AWS KMS
      |
      +----------------------+
      |                      |
      v                      v
Amazon S3              Amazon DynamoDB
Evidence Store         Metadata Store
S3 Versioning          evidenceId
S3 Object Lock         digest
Original JSON          signature
Canonical JSON         lifecycleState
      |                      |
      +----------+-----------+
                 |
                 v
        Amazon EventBridge
                 |
      +----------+-----------+
      |                      |
      v                      v
CloudWatch Logs        SNS / Alerts
CloudTrail             Security Hub / GuardDuty
AWS Config             IAM Access Analyzer
```

## S3 Evidence Storage Design

Amazon S3 can be used as the primary evidence object store.

Recommended controls:

- enable S3 Versioning
- enable S3 Object Lock
- use Governance Mode or Compliance Mode depending on requirements
- encrypt objects with SSE-KMS
- restrict access through IAM roles
- deny unauthorized delete operations with bucket policies
- enable CloudTrail data events where required
- separate evidence buckets from log buckets
- use lifecycle policies for archive storage classes
- consider cross-region replication for critical evidence

Example object layout:

```text
s3://evidence-bucket/
  evidence/
    schemaVersion=1.0.0/
      year=2026/
        month=06/
          day=02/
            evd-2026-000001/
              original.json
              canonical.json
              digest.txt
              signature.bin
```

## DynamoDB Metadata Design

Amazon DynamoDB can store evidence metadata and lifecycle state.

Example attributes:

| Attribute | Description |
|---|---|
| evidenceId | Unique evidence identifier. |
| schemaVersion | Evidence schema version. |
| eventType | Type of evidence event. |
| subjectId | Subject of the evidence. |
| actorId | Actor or producer identity. |
| occurredAt | Business event timestamp. |
| ingestedAt | Server-side ingestion timestamp. |
| hashAlgorithm | Hash algorithm such as SHA-256. |
| digest | Calculated evidence digest. |
| kmsKeyId | KMS key used for signing. |
| signature | Signature over digest or canonical evidence. |
| lifecycleState | Current lifecycle state. |
| s3ObjectKey | Location of evidence artifact. |
| retentionUntil | Retention expiration timestamp. |
| verificationStatus | Verification result. |

Potential indexes:

| Index | Purpose |
|---|---|
| eventType-occurredAt-index | Query events by type and time. |
| subjectId-occurredAt-index | Query evidence history for a subject. |
| lifecycleState-index | Query pending, rejected, or failed evidence. |

### Recommended key design

A simple metadata table can use the evidence ID as the primary access pattern.

| Key | Example | Purpose |
|---|---|---|
| PK | `EVIDENCE#evd-2026-000001` | Groups all records related to one evidence item. |
| SK | `METADATA#v1` | Stores the current metadata record. |

For lifecycle history or verification history, additional sort keys can be added.

| Record type | PK | SK |
|---|---|---|
| Metadata | `EVIDENCE#<evidenceId>` | `METADATA#v1` |
| Lifecycle event | `EVIDENCE#<evidenceId>` | `EVENT#<timestamp>#<eventType>` |
| Verification result | `EVIDENCE#<evidenceId>` | `VERIFICATION#<timestamp>` |

Recommended write controls:

- use conditional writes to reject duplicate `evidenceId` values
- store large artifacts in S3, not DynamoDB
- store digests, signatures, object keys, and lifecycle state in DynamoDB
- avoid updating immutable historical records
- append lifecycle and verification events instead of overwriting them

## KMS Signing Design

AWS KMS asymmetric keys can be used to sign evidence digests.

Recommended workflow:

1. Canonicalize the evidence record.
2. Calculate the SHA-256 digest.
3. Sign the digest using an AWS KMS asymmetric signing key.
4. Store the digest, signature, key ID, algorithm, and signing timestamp.
5. Verify the signature during reviewer reperformance.
   
### Signature target decision

The recommended signing target is the SHA-256 digest of the canonical evidence record, not the raw JSON payload.

| Option | Assessment |
|---|---|
| Sign raw JSON | Not recommended because semantically identical JSON can have different whitespace or key ordering. |
| Sign canonical JSON | Valid, but larger payloads increase operational complexity. |
| Sign SHA-256 digest of canonical JSON | Recommended because it is deterministic, compact, and easy to verify. |

Recommended signing approach:

- canonicalize the evidence record with RFC 8785 JCS
- calculate the SHA-256 digest
- call AWS KMS Sign using an asymmetric signing key
- store the digest, signature, key ID, signing algorithm, and canonicalization method
- verify by recomputing the canonical digest and checking the signature

This design makes the signature stable across formatting differences while keeping the signing operation small and auditable.


Benefits:

- private key material does not leave AWS KMS
- signing operations are logged in CloudTrail
- IAM and KMS key policies restrict key usage
- verification can be independently repeated
- unusual signing activity can be monitored

Important controls:

- separate KMS key administrators from key users
- restrict KMS signing to evidence ingestion roles
- allow KMS verification to reviewer or verification roles
- monitor unusual signing volume
- document key rotation and retirement policy

## IAM and Access Control

A production-oriented system should use least privilege IAM roles.

| Role | Permissions |
|---|---|
| Evidence Producer Role | Submit evidence through API Gateway only. |
| Ingestion Lambda Role | Validate, hash, sign, and write evidence metadata. |
| Reviewer Role | Read evidence, digest, metadata, and verify signatures. |
| Security Auditor Role | Read CloudTrail, Config, and security findings. |
| Storage Administrator Role | Manage bucket configuration without bypassing retention. |
| KMS Key Administrator Role | Manage key policy without signing evidence. |
| KMS Signing Role | Sign evidence without administering keys. |

Recommended controls:

- apply least privilege
- use separation of duties
- use MFA for privileged access
- restrict direct S3 writes
- require controlled API ingestion
- protect infrastructure code
- use IAM Access Analyzer
- use AWS Organizations SCPs for guardrails

## Audit Logging and Monitoring

Recommended logging sources:

| Source | Purpose |
|---|---|
| AWS CloudTrail | AWS API activity, KMS usage, S3 operations, IAM changes. |
| CloudTrail Data Events | Object-level S3 access tracking where required. |
| CloudWatch Logs | Application validation, hashing, signing, and verification logs. |
| EventBridge | Evidence lifecycle and exception events. |
| AWS Config | Configuration history and compliance checks. |
| Security Hub | Centralized security posture findings. |
| GuardDuty | Threat detection for suspicious activity. |

Recommended alerts:

- failed schema validation spike
- hash verification failure
- unauthorized delete attempt
- S3 Object Lock configuration change
- KMS key policy change
- unusual KMS signing volume
- CloudTrail logging disabled
- public S3 bucket exposure
- DynamoDB throttling or access anomalies

## Event-Driven Lifecycle

EventBridge can publish lifecycle events such as:

| Event | Description |
|---|---|
| EVIDENCE_RECEIVED | Evidence payload was received. |
| EVIDENCE_VALIDATED | Schema validation succeeded. |
| EVIDENCE_REJECTED | Schema validation failed. |
| EVIDENCE_HASHED | Evidence digest was calculated. |
| EVIDENCE_SIGNED | Digest was signed with KMS. |
| EVIDENCE_STORED | Evidence artifacts were stored. |
| EVIDENCE_VERIFIED | Evidence verification succeeded. |
| EVIDENCE_FAILED_VERIFICATION | Evidence verification failed. |
| EVIDENCE_ARCHIVED | Evidence transitioned to archive storage. |

## Retention and Immutability

S3 Object Lock can support retention requirements.

| Mode | Description |
|---|---|
| Governance Mode | Users with special permissions can override retention. |
| Compliance Mode | Retention cannot be shortened by any user, including root. |

Recommended considerations:

- enable Object Lock at bucket creation time
- define retention period by evidence type
- enable S3 Versioning
- restrict delete permissions
- log delete attempts
- document legal hold behavior
- test lifecycle transitions before production use

### Object Lock mode recommendation

For portfolio, development, and non-regulated environments, Governance Mode is usually safer because privileged users can still recover from configuration mistakes.

For strict regulated retention requirements, Compliance Mode may be appropriate, but it should be used carefully because retention cannot be shortened by any user, including the root user.

Recommended approach:

| Environment | Recommended mode | Reason |
|---|---|---|
| Local learning / portfolio | Not required | The local MVP does not deploy S3. |
| AWS prototype | Governance Mode | Allows testing immutability while retaining controlled administrative recovery. |
| Regulated production | Compliance Mode, if legally required | Provides stronger retention guarantees but increases operational risk. |

Object Lock mode should be selected with input from security, compliance, legal, and audit stakeholders.


## Reliability Considerations

Recommended reliability controls:

- use managed services
- design Lambda functions to be idempotent
- use DynamoDB conditional writes to prevent duplicate evidence IDs
- use failure destinations or dead-letter queues
- retry transient failures safely
- store failed evidence separately for review
- enable DynamoDB backups
- consider cross-region replication
- monitor ingestion and verification failures

## Failure Handling Matrix

A production-oriented evidence system should define how partial failures are handled.

| Failure scenario | Risk | Recommended handling |
|---|---|---|
| Schema validation fails | Invalid evidence could enter the audit trail. | Reject the event, log the reason, and publish `EVIDENCE_REJECTED`. |
| Duplicate `evidenceId` is received | Existing evidence could be overwritten or confused. | Use DynamoDB conditional writes and return a conflict response. |
| KMS signing fails | Evidence cannot be authenticated. | Do not mark evidence as signed; retry safely or move to a failed state for review. |
| S3 write succeeds but DynamoDB write fails | Artifact exists without searchable metadata. | Use idempotent retries and reconciliation jobs based on object keys. |
| DynamoDB write succeeds but S3 write fails | Metadata points to missing evidence. | Mark lifecycle state as failed and alert operations. |
| EventBridge publish fails | Downstream workflows may not run. | Retry or send to a dead-letter queue. |
| Verification fails | Evidence may be corrupted or metadata may not match. | Mark as failed verification, alert reviewers, and preserve all artifacts for investigation. |
| CloudTrail or logging disabled | Auditability is weakened. | Alert immediately and treat as a security incident. |

The design should prefer explicit failed states over silent retries that hide audit-relevant failures.

## Cost Optimization Considerations

Cost optimization options:

- use serverless services for event-driven workloads
- store large artifacts in S3 rather than DynamoDB
- store only metadata and pointers in DynamoDB
- transition older evidence to S3 Glacier classes
- tune CloudTrail data events based on risk and cost
- set CloudWatch Logs retention periods
- monitor cost with AWS Budgets and Cost Explorer

## Security Considerations

Key security considerations:

- validate all evidence before storage
- reject unknown schema versions
- canonicalize before hashing and signing
- use KMS for signing and encryption
- protect KMS key policies
- restrict direct writes to evidence storage
- enable S3 Object Lock
- log privileged actions
- alert on deletion attempts and policy changes
- review dependency and CI/CD security
- use protected branches and code review

## Well-Architected Framework Alignment

| Pillar | Alignment |
|---|---|
| Operational Excellence | Event-driven workflows, logs, runbooks, monitoring, CI/CD checks. |
| Security | IAM least privilege, KMS signing, S3 Object Lock, CloudTrail, Config, Security Hub. |
| Reliability | Managed services, idempotency, backups, retries, failure handling. |
| Performance Efficiency | Serverless ingestion, DynamoDB indexing, S3 scalable storage. |
| Cost Optimization | Pay-per-use services, lifecycle policies, log retention tuning. |
| Sustainability | Managed services, event-driven execution, storage lifecycle optimization. |

## Relationship to Other Design Documents

This document complements:

- `docs/framework-selection.md`
- `docs/audit-procedures.md`
- `docs/control-mapping.md`
- `docs/evidence-lifecycle.md`
- `docs/threat-model.md`

## Future Enhancements

Future versions may add:

- additional deployment-level diagrams for multi-account and multi-region designs
- Terraform or AWS CDK reference implementation
- API Gateway and Lambda ingestion prototype
- KMS signing and verification script
- S3 Object Lock sample configuration
- DynamoDB metadata schema
- EventBridge lifecycle event examples
- CloudTrail and Config monitoring examples
- IAM least privilege policy examples
- cost estimation
- multi-account landing zone design
- blockchain anchoring design

## Limitations

This reference architecture is conceptual.

It does not represent a deployed production architecture, formal audit opinion, compliance certification, legal conclusion, or retention policy.

Before production use, the architecture should be reviewed by qualified AWS architects, security engineers, compliance professionals, legal professionals, and auditors.