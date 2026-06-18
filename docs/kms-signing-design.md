# KMS Signing Design

## Purpose

This document describes a production-oriented AWS KMS signing design for the Tanden Trust Audit PoC.

The purpose is to explain how evidence records or evidence digests can be digitally signed and verified using AWS KMS asymmetric keys.

This document is conceptual and intended for design, learning, and portfolio purposes.

## Background

The current MVP provides tamper-evident verification by:

- validating evidence records with JSON Schema
- canonicalizing JSON records deterministically
- calculating a SHA-256 digest
- comparing the calculated digest with an expected digest
- running automated positive and negative tests

This provides an important integrity control, but it does not fully solve authenticity.

For example, a simple hash can detect content changes, but it cannot independently prove which trusted system produced the evidence or whether the expected hash came from an authorized source.

Digital signing helps address this gap.

## Design Goals

| Goal | Description |
|---|---|
| Integrity | Detect unauthorized changes to evidence records. |
| Authenticity | Prove that evidence was signed by an authorized system or role. |
| Non-repudiation Support | Provide stronger audit evidence that a signing action occurred. |
| Reperformance | Allow reviewers to independently verify signatures. |
| Key Protection | Ensure private key material is protected by AWS KMS. |
| Auditability | Record signing and verification activity through AWS CloudTrail. |
| Least Privilege | Restrict signing permissions to trusted ingestion components. |
| Separation of Duties | Separate key administration from signing usage. |

## Why AWS KMS Asymmetric Signing

AWS KMS asymmetric keys can perform signing and verification operations without exposing private key material to the application.

Benefits:

- private key material does not leave AWS KMS
- signing operations can be controlled with IAM and KMS key policies
- signing and verification calls can be logged in AWS CloudTrail
- applications do not need to manage private keys directly
- access can be restricted to specific roles and services
- reviewer workflows can verify signatures using controlled processes

## Signing Target Options

There are two main signing target options.

### Option A: Sign the Canonical Evidence Record

The system signs the complete canonical JSON representation of the evidence.

Benefits:

- the signature is directly tied to the full evidence content
- verification is conceptually simple
- reviewers can reproduce canonicalization and verify the signature

Trade-offs:

- larger payloads may require careful handling
- KMS signing input size limits must be considered
- application code must ensure canonicalization is stable

### Option B: Sign the SHA-256 Digest

The system canonicalizes the evidence, calculates a SHA-256 digest, and signs the digest.

Benefits:

- compact signing input
- efficient for large evidence records
- aligns with the current MVP hash verification model
- easier to store and compare digests

Trade-offs:

- reviewers must verify both digest calculation and signature validation
- digest metadata must be protected from substitution
- the digest algorithm and canonicalization method must be clearly recorded

## Recommended MVP Extension

For this project, the recommended production-oriented extension is:

1. Validate the evidence record with JSON Schema.
2. Canonicalize the evidence record using deterministic JSON canonicalization.
3. Calculate a SHA-256 digest of the canonical evidence.
4. Sign the digest using an AWS KMS asymmetric signing key.
5. Store the original evidence, canonical evidence, digest, signature, key ID, algorithm, and timestamps.
6. Allow reviewers to reperform canonicalization, digest calculation, and signature verification.

This approach builds naturally on the current MVP.

## Conceptual Signing Flow

```text
Evidence Producer
      |
      v
API Gateway
      |
      v
Lambda Ingestion Function
      |
      |-- Validate JSON Schema
      |-- Canonicalize Evidence JSON
      |-- Calculate SHA-256 Digest
      |-- Call AWS KMS Sign
      |
      +----------------------+
      |                      |
      v                      v
Amazon S3              Amazon DynamoDB
Evidence Artifacts     Evidence Metadata
original.json          evidenceId
canonical.json         digest
digest.txt             signature
signature.bin          kmsKeyId
                       signingAlgorithm
                       signedAt
```

## Conceptual Verification Flow

```text
Reviewer or Verification Job
      |
      v
Read Evidence from S3
      |
      v
Read Metadata from DynamoDB
      |
      |-- Validate JSON Schema
      |-- Canonicalize Evidence JSON
      |-- Recalculate SHA-256 Digest
      |-- Compare Stored Digest
      |-- Call AWS KMS Verify
      |
      v
Verification Result
VALID or INVALID
```

## Evidence Metadata Fields

Recommended metadata fields:

| Field | Description |
|---|---|
| evidenceId | Unique evidence identifier. |
| schemaVersion | Evidence schema version. |
| canonicalizationMethod | Canonicalization method, such as RFC 8785 JCS. |
| hashAlgorithm | Hash algorithm, such as SHA-256. |
| digest | SHA-256 digest of the canonical evidence. |
| signature | Signature over the digest or canonical evidence. |
| signingAlgorithm | KMS signing algorithm. |
| kmsKeyId | KMS key ID or key ARN used for signing. |
| signedAt | Server-side signing timestamp. |
| signerRoleArn | IAM role ARN that performed the signing operation. |
| verificationStatus | Latest verification result. |
| verifiedAt | Latest verification timestamp. |

## KMS Key Type

A production design should use an asymmetric KMS key for signing and verification.

Example key specification options may include:

| Key Spec | Use Case |
|---|---|
| RSA_2048 | Broad compatibility and common audit use cases. |
| RSA_3072 | Stronger RSA security margin. |
| RSA_4096 | Higher security margin with larger signatures. |
| ECC_NIST_P256 | Efficient elliptic curve signing. |
| ECC_NIST_P384 | Stronger elliptic curve option. |

A practical default for audit evidence signing is often RSA or NIST elliptic curve signing, depending on organizational standards and compatibility needs.

## Signing Algorithm Considerations

The signing algorithm should be explicitly recorded with the evidence metadata.

Examples:

| Algorithm | Notes |
|---|---|
| RSASSA_PSS_SHA_256 | Modern RSA-PSS signature scheme. |
| RSASSA_PKCS1_V1_5_SHA_256 | Broad compatibility but older RSA padding style. |
| ECDSA_SHA_256 | Efficient elliptic curve signing option. |
| ECDSA_SHA_384 | Stronger elliptic curve signing option. |

The selected algorithm should match the KMS key type and organizational cryptographic standards.

## IAM Role Design

Recommended roles:

| Role | Purpose |
|---|---|
| Evidence Ingestion Role | Calls KMS Sign and writes evidence artifacts. |
| Evidence Verification Role | Calls KMS Verify and reads evidence artifacts. |
| Reviewer Role | Reads evidence and verification results. |
| Security Auditor Role | Reads CloudTrail and security configuration. |
| KMS Key Administrator Role | Manages key policy without signing evidence. |
| CI/CD Deployment Role | Deploys infrastructure with controlled permissions. |

## Least Privilege Permissions

The ingestion function should have permission to sign evidence but should not administer the key.

Example conceptual permission:

```json
{
  "Effect": "Allow",
  "Action": [
    "kms:Sign",
    "kms:GetPublicKey"
  ],
  "Resource": "arn:aws:kms:region:account-id:key/key-id"
}
```

The verification function should be able to verify signatures.

```json
{
  "Effect": "Allow",
  "Action": [
    "kms:Verify",
    "kms:GetPublicKey"
  ],
  "Resource": "arn:aws:kms:region:account-id:key/key-id"
}
```

Key administrators should manage the key but should not automatically have signing permission.

## Separation of Duties

Recommended separation:

| Responsibility | Should Be Separate From |
|---|---|
| KMS key administration | Evidence signing |
| Evidence ingestion | Security audit review |
| Storage administration | Retention bypass authority |
| CI/CD deployment | Manual evidence approval |
| Reviewer access | Evidence producer authority |

This reduces the risk of a single actor being able to create, modify, sign, and approve misleading evidence.

## CloudTrail Audit Points

AWS CloudTrail should capture important KMS and AWS API actions.

Important events include:

| Event | Why It Matters |
|---|---|
| kms:CreateKey | New signing key was created. |
| kms:ScheduleKeyDeletion | Signing key deletion was requested. |
| kms:DisableKey | Signing key was disabled. |
| kms:PutKeyPolicy | Key policy changed. |
| kms:Sign | Evidence digest was signed. |
| kms:Verify | Signature was verified. |
| kms:GetPublicKey | Public key was retrieved. |
| s3:PutObject | Evidence artifact was stored. |
| s3:DeleteObject | Evidence artifact deletion was attempted. |
| dynamodb:PutItem | Evidence metadata was written. |
| dynamodb:UpdateItem | Evidence metadata was updated. |

## Monitoring and Alerting

Recommended alerts:

- KMS key disabled
- KMS key deletion scheduled
- KMS key policy changed
- unusual signing volume
- signing attempted by unexpected role
- verification failures
- repeated digest mismatch
- evidence object deletion attempt
- S3 Object Lock configuration changed
- CloudTrail logging disabled

## Storage Design

Evidence signing outputs should be stored in a way that supports independent review.

Recommended S3 artifacts:

```text
s3://evidence-bucket/
  evidence/
    schemaVersion=1.0.0/
      evidenceId=evd-2026-000001/
        original.json
        canonical.json
        digest.txt
        signature.bin
        signing-metadata.json
```

Recommended metadata storage in DynamoDB:

```text
PK: evidenceId
schemaVersion
hashAlgorithm
canonicalizationMethod
digest
signatureLocation
kmsKeyId
signingAlgorithm
signedAt
signerRoleArn
verificationStatus
verifiedAt
```

## Verification Result Design

Verification results should be explicit and auditable.

Recommended statuses:

| Status | Description |
|---|---|
| VALID | Schema, digest, and signature verification succeeded. |
| INVALID_SCHEMA | Schema validation failed. |
| INVALID_DIGEST | Recalculated digest did not match stored digest. |
| INVALID_SIGNATURE | KMS signature verification failed. |
| MISSING_ARTIFACT | Required evidence artifact was missing. |
| UNSUPPORTED_SCHEMA_VERSION | Evidence schema version is not supported. |
| UNSUPPORTED_ALGORITHM | Hash or signing algorithm is not supported. |
| VERIFICATION_ERROR | Verification could not be completed due to system error. |

## Failure Handling

Recommended failure handling:

- reject evidence that fails schema validation
- do not sign invalid evidence
- store rejected evidence separately only if required for diagnostics
- avoid overwriting existing evidence with the same evidenceId
- use DynamoDB conditional writes for uniqueness
- send failed events to a dead-letter queue
- alert on verification failures
- preserve logs for reviewer investigation

## Replay and Substitution Considerations

Signing alone does not fully prevent replay or substitution attacks.

Additional controls should include:

- globally unique evidenceId
- server-side ingestedAt timestamp
- producer identity
- schema version
- event type
- subject identifier
- context-specific nonce or sequence number where appropriate
- digest registry or immutable metadata store
- S3 Object Lock for stored artifacts

## Key Rotation Considerations

KMS key rotation for asymmetric signing keys requires careful planning.

Recommended practices:

- record the exact kmsKeyId used for each signature
- keep old verification keys available for historical evidence
- define key retirement policy
- prevent deletion of keys needed to verify retained evidence
- document rotation procedures
- test verification of old evidence after key rotation
- monitor key deletion and disablement events

## Relationship to Current MVP

The current MVP already demonstrates:

- schema validation
- deterministic canonicalization
- SHA-256 digest generation
- digest verification
- negative test cases

A future implementation can extend this by adding:

- KMS Sign operation after digest generation
- KMS Verify operation during reviewer verification
- signed metadata files
- CloudTrail evidence of signing
- IAM least privilege policies
- S3 Object Lock storage
- DynamoDB evidence registry

## Relationship to Other Design Documents

This document complements:

- `docs/framework-selection.md`
- `docs/audit-procedures.md`
- `docs/control-mapping.md`
- `docs/evidence-lifecycle.md`
- `docs/threat-model.md`
- `docs/aws-reference-architecture.md`

## Well-Architected Framework Alignment

| Pillar | Alignment |
|---|---|
| Operational Excellence | Signing and verification workflows are observable and repeatable. |
| Security | KMS protects private keys, IAM restricts access, and CloudTrail records key usage. |
| Reliability | Verification can be repeated and historical evidence can remain verifiable. |
| Performance Efficiency | Signing compact digests reduces payload size and processing cost. |
| Cost Optimization | KMS calls are used only for signing and verification events that require trust. |
| Sustainability | Managed cryptographic services reduce custom infrastructure overhead. |

## Limitations

This document is a conceptual design.

It does not represent a deployed KMS implementation, formal cryptographic review, compliance certification, legal conclusion, or production security approval.

Before production use, the design should be reviewed by qualified AWS architects, security engineers, cryptography specialists, compliance professionals, legal professionals, and auditors.
