# AWS KMS Signing Design

## Overview

This document describes a future design for adding AWS KMS-based digital signatures to the tamper-evident audit trail PoC.

The current PoC focuses on deterministic hashing and integrity verification. A production-grade audit trail also needs authenticity: the ability to prove which trusted system or key signed a given evidence digest.

## Current PoC

The current implementation performs the following steps:

1. Validate the evidence JSON with JSON Schema.
2. Canonicalize the evidence JSON using RFC 8785 JSON Canonicalization Scheme (JCS).
3. Generate a SHA-256 hash from the canonical JSON.
4. Compare the calculated hash with an expected hash.

This provides deterministic integrity verification, but it does not yet prove who authorized or signed the evidence.

## Target Architecture

The target design adds an AWS KMS asymmetric signing key to sign the evidence digest.

```text
Evidence JSON
  |
  v
JSON Schema Validation
  |
  v
RFC 8785 JCS Canonicalization
  |
  v
SHA-256 Digest
  |
  v
AWS KMS Sign
  |
  v
Evidence Hash + Signature + KMS Key ID
```

The signature can later be verified using AWS KMS Verify or the public key associated with the asymmetric KMS key.

## Signing Flow

1. Receive or generate an evidence JSON document.
2. Validate the evidence against the JSON Schema.
3. Canonicalize the evidence using RFC 8785 JCS.
4. Generate a SHA-256 digest from the canonical JSON.
5. Sign the digest using an AWS KMS asymmetric key.
6. Store the following values:
   - evidence ID
   - schema version
   - hash algorithm
   - canonicalization method
   - SHA-256 digest
   - KMS key ID or key ARN
   - signature
   - signing timestamp

## Verification Flow

1. Load the evidence JSON.
2. Validate the evidence against the expected JSON Schema.
3. Canonicalize the evidence using RFC 8785 JCS.
4. Recalculate the SHA-256 digest.
5. Verify the signature using AWS KMS Verify or the public key.
6. Return `VALID` only if both the digest and signature verification succeed.

```text
Evidence JSON
  |
  v
JSON Schema Validation
  |
  v
RFC 8785 JCS Canonicalization
  |
  v
SHA-256 Digest
  |
  v
AWS KMS Verify
  |
  v
VALID / INVALID
```

## AWS Components

Potential AWS components include:

- AWS KMS asymmetric key for signing and verification
- IAM policies for least-privilege signing access
- CloudTrail for auditing KMS Sign and Verify API calls
- Amazon S3 with Object Lock for immutable evidence storage
- DynamoDB for evidence metadata and lookup indexes
- AWS Lambda for serverless signing and verification workflows
- Amazon EventBridge for event-driven evidence processing

## Security Considerations

- Use an asymmetric KMS key so verification can be performed without granting signing permission.
- Restrict `kms:Sign` to trusted workloads only.
- Separate signing permissions from verification permissions.
- Enable CloudTrail logging for KMS API activity.
- Store signatures separately from mutable application data when possible.
- Include schema version and canonicalization method in signed metadata.
- Rotate keys according to compliance and operational requirements.
- Consider key deletion protection and recovery windows for audit-critical keys.

## Operational Considerations

- KMS API latency and request quotas should be considered for high-volume workloads.
- Signing should be idempotent for the same canonical evidence payload.
- Evidence verification should fail closed when the key, signature, or schema version is unknown.
- Monitoring should be added for signing failures, verification failures, and unexpected KMS access.
- Disaster recovery plans should define how evidence remains verifiable across regions and accounts.

## Future Enhancements

- Implement `scripts/sign-evidence-kms.js` using AWS SDK for JavaScript v3.
- Implement `scripts/verify-evidence-kms.js`.
- Add sample signed evidence metadata.
- Add GitHub Actions checks using mocked KMS responses.
- Add architecture diagrams for AWS deployment.
- Evaluate S3 Object Lock and DynamoDB Streams for production audit trails.
