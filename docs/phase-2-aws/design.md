# Phase 2 AWS-Backed MVP Design

## Overview

Phase 2 introduces a minimal AWS-backed architecture for tamper-evident evidence storage and verification.

The design extends the local MVP without replacing its core mechanics:

- JSON Schema validation
- RFC 8785 JCS-compatible canonicalization
- SHA-256 digest verification
- Signature-oriented authenticity checks
- Tamper detection through digest or signature mismatch

## Design Goals

- Preserve local MVP verification semantics
- Add AWS-managed storage and auditability
- Introduce a clear path to AWS KMS-backed signing
- Keep the architecture small enough for a prototype
- Avoid premature production complexity

## Candidate AWS Architecture

Client / CLI / Developer
  -> Verification Workflow
    -> S3 Evidence Bucket
    -> Digest Metadata Store
      -> DynamoDB or S3 sidecar metadata
    -> AWS KMS
    -> CloudTrail / CloudWatch Logs

## Candidate Services

| Concern | Candidate Service | Reason |
|---|---|---|
| Evidence object storage | Amazon S3 | Durable object storage, future Object Lock support |
| Expected digest metadata | DynamoDB or S3 sidecar | Separate trust boundary from evidence content |
| Signing key management | AWS KMS | Managed key protection and audit logs |
| Verification compute | Local CLI first, Lambda later | Incremental migration path |
| Operational audit logs | CloudTrail | AWS API activity traceability |
| Application logs | CloudWatch Logs | Verification and operational logs |
| Infrastructure definition | AWS CDK or Terraform | Reproducible deployment |

## Core Data Flow

### 1. Evidence Registration

1. Evidence JSON is validated against the schema.
2. The evidence JSON is canonicalized using JCS-compatible canonicalization.
3. A SHA-256 digest is calculated.
4. The evidence object is stored in S3.
5. Expected digest metadata is stored separately.

### 2. Evidence Verification

1. The verifier receives an evidence ID.
2. The evidence object is loaded from S3.
3. Expected digest metadata is loaded from the metadata store.
4. The evidence object is canonicalized.
5. A SHA-256 digest is calculated.
6. The calculated digest is compared with the expected digest.
7. The verifier returns VALID or INVALID.

### 3. Signature-Oriented Flow

1. Evidence JSON is canonicalized.
2. A SHA-256 digest is calculated.
3. The digest or canonical payload is signed by a signing provider.
4. The signature metadata is stored.
5. The signature is verified during audit or review.

## Trust Boundaries

### Evidence Content Boundary

Evidence content stored in S3 is not trusted by itself.

It must be verified against trusted digest or signature metadata.

### Expected Digest Boundary

Expected digest metadata is a trust anchor for hash-based verification.

Phase 2 must define how expected digest metadata is protected from unauthorized modification.

Candidate protections:

- IAM least privilege
- DynamoDB conditional writes
- CloudTrail logging
- Future signed metadata
- Future S3 Object Lock or immutable registry

### Signature Boundary

Signature verification adds authenticity and integrity protection.

AWS KMS can improve key protection by avoiding local private key handling.

## Digest Metadata Options

### Option A: DynamoDB

Pros:

- Structured lookup by evidence ID
- Conditional writes
- Fine-grained IAM
- Easy metadata extension

Cons:

- Adds another service
- Requires table design

### Option B: S3 Sidecar Object

Pros:

- Simple and close to local MVP sidecar model
- Easy to inspect
- Minimal architecture

Cons:

- Requires careful IAM and object versioning
- Trust boundary may be weaker without signing or immutability

### Option C: Signed Metadata

Pros:

- Stronger trust property
- Can protect digest metadata from silent modification

Cons:

- More complex
- Requires signing policy and key management

## Recommended Phase 2 Approach

Use S3 for evidence content and start with S3 sidecar or DynamoDB metadata as a documented prototype choice.

Prefer DynamoDB if the goal is to demonstrate audit workflow and metadata evolution.

Prefer S3 sidecar if the goal is to remain close to the local MVP and minimize services.

## AWS Well-Architected Considerations

### Operational Excellence

- Provide documented demo workflows
- Use repeatable deployment steps
- Log verification operations

### Security

- Apply least privilege IAM
- Keep private key material out of source control
- Use KMS for managed signing keys
- Avoid storing sensitive data in logs

### Reliability

- Use durable AWS managed services
- Consider S3 versioning
- Define failure behavior for missing evidence or missing metadata

### Performance Efficiency

- Keep verification lightweight
- Use direct object and metadata lookups
- Avoid unnecessary distributed complexity in Phase 2

### Cost Optimization

- Prefer serverless and pay-per-use services
- Avoid always-on infrastructure
- Keep prototype data volume small

### Sustainability

- Use managed services efficiently
- Avoid over-provisioned resources
- Keep compute execution minimal

## Open Design Decisions

- DynamoDB vs S3 sidecar for expected digest metadata
- KMS signing target: canonical JSON bytes vs SHA-256 digest
- Local CLI vs Lambda verification in Phase 2
- Whether to include S3 Object Lock immediately
- Whether to introduce CDK or Terraform first
