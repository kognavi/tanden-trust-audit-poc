# ADR 0001: Digest Metadata Storage

## Status

Accepted for Phase 2 prototype.

## Context

The local Tanden Trust Audit PoC verifies evidence by computing a canonical digest from evidence JSON and comparing it with trusted expected digest metadata.

Phase 2 extends this model into a minimal AWS-backed architecture. Evidence may be stored in Amazon S3, but the trust semantics must remain the same:

- evidence content is untrusted until verified
- canonicalization remains deterministic
- SHA-256 digest comparison remains the core integrity check
- expected digest metadata must be protected more strongly than evidence content
- the implementation should remain simple enough to review and test

The main design question is where expected digest metadata should be stored during Phase 2.

Options considered:

1. Amazon S3 sidecar metadata object
2. Amazon DynamoDB metadata table
3. Signed metadata document
4. Hybrid model

## Decision

For Phase 2, expected digest metadata will be represented as an Amazon S3 sidecar metadata object.

Each evidence object may have a corresponding metadata object that stores the expected digest and verification-related metadata.

Example conceptual mapping:

```text
evidence/
  sample-001.json

metadata/
  sample-001.digest.json
```

Example conceptual metadata shape:

```json
{
  "evidenceId": "sample-001",
  "canonicalization": "JCS",
  "digestAlgorithm": "SHA-256",
  "expectedDigest": "hex-encoded-sha256-digest",
  "evidenceObjectKey": "evidence/sample-001.json",
  "createdAt": "2026-06-26T00:00:00Z"
}
```

This ADR does not finalize the production metadata schema. It only establishes the initial Phase 2 storage direction.

## Rationale

### Simplicity

S3 sidecar metadata keeps Phase 2 small. The project can introduce AWS-backed storage without immediately adding DynamoDB table design, indexing decisions, or additional operational complexity.

### Continuity with the local MVP

The local MVP already separates evidence content from expected digest data. S3 sidecar metadata mirrors this model closely.

The verification flow remains easy to understand:

```text
load evidence
load expected digest metadata
canonicalize evidence
compute SHA-256 digest
compare computed digest with expected digest
return verification result
```

### Reviewability

A JSON sidecar object is easy to inspect in code review and during manual testing. Reviewers can reason about the trust boundary without needing to inspect DynamoDB table design or query patterns.

### Cost control

For Phase 2, expected verification volume is low. S3 object storage is sufficient and avoids unnecessary always-on infrastructure.

### Reversibility

This decision does not prevent later migration to DynamoDB or signed metadata. Verification logic should depend on a metadata provider abstraction rather than direct S3 calls.

## Alternatives Considered

### DynamoDB metadata table

DynamoDB would store one metadata item per evidence record.

Advantages:

- efficient key-value lookup
- structured metadata model
- future support for indexing and query patterns
- good fit for higher-volume application workflows

Disadvantages:

- adds another AWS service to Phase 2
- requires table design decisions earlier
- introduces additional IAM and operational considerations
- may distract from the core trust model

Reason not selected for Phase 2:

DynamoDB is a strong candidate for a later production-oriented phase, but it is not necessary for the first AWS-backed MVP.

### Signed metadata document

Expected digest metadata could be signed using AWS KMS or another signing mechanism.

Advantages:

- stronger tamper-evidence for metadata
- reduced reliance on storage-layer trust alone
- better alignment with long-term auditability goals

Disadvantages:

- depends on unresolved KMS signing boundary decisions
- requires signature envelope design
- requires canonicalization rules for metadata itself
- increases Phase 2 complexity

Reason not selected for Phase 2:

Signed metadata is valuable, but it should be addressed after the project finalizes whether KMS signs canonical JSON bytes, digests, or metadata envelopes.

### Hybrid S3 and DynamoDB model

A hybrid model could store durable metadata in S3 and lookup/index data in DynamoDB.

Advantages:

- combines simple object storage with fast lookup
- supports future dashboards and search
- allows S3 to remain an audit-friendly record layer

Disadvantages:

- requires consistency management between S3 and DynamoDB
- increases failure modes
- requires reconciliation logic
- expands Phase 2 scope

Reason not selected for Phase 2:

The hybrid model may be useful later, but Phase 2 should avoid maintaining two metadata sources.

## Consequences

Positive consequences:

- Phase 2 remains simple and implementable
- trust semantics stay close to the local MVP
- AWS cost remains minimal
- metadata can be inspected with standard S3 tools
- future DynamoDB migration remains possible

Negative consequences:

- S3 sidecar metadata is less query-friendly than DynamoDB
- metadata schema validation must be handled by application code
- atomicity between evidence object and metadata object is not guaranteed by default
- metadata write permissions must be tightly controlled

## Security Considerations

The metadata object is more security-sensitive than the evidence object.

The evidence object is treated as untrusted input until verification succeeds. The metadata object contains the expected digest and therefore participates in the trust root for verification.

Recommended Phase 2 controls:

- use separate S3 prefixes for evidence and metadata
- restrict write access to metadata objects more tightly than evidence objects
- enable S3 versioning
- log object access and mutation events where practical
- avoid storing real customer data
- avoid storing secrets in metadata
- validate metadata schema before using it
- fail closed if metadata is missing, malformed, or inconsistent

## AWS Well-Architected Considerations

### Operational Excellence

The S3 sidecar model is easy to inspect, document, and test.

### Security

Metadata write permissions must be tightly controlled. S3 versioning and audit logs should be used to detect unexpected changes.

### Reliability

S3 provides durable object storage. Verification should fail closed when metadata is unavailable or invalid.

### Performance Efficiency

For Phase 2 low-volume verification, S3 object reads are sufficient. DynamoDB can be introduced later if lookup performance becomes a requirement.

### Cost Optimization

The design avoids unnecessary always-on infrastructure.

### Sustainability

The design uses minimal managed infrastructure and avoids over-provisioned resources.

## Implementation Guidance

Verification logic should depend on a metadata provider abstraction.

Conceptual providers:

```text
LocalFileDigestMetadataProvider
S3SidecarDigestMetadataProvider
DynamoDbDigestMetadataProvider
SignedDigestMetadataProvider
```

This keeps the Phase 2 decision reversible.

## Migration Path

If Phase 3 requires richer lookup, the project can migrate to DynamoDB by:

1. introducing a DynamoDB-backed metadata provider
2. backfilling DynamoDB items from S3 sidecar metadata
3. updating verification configuration to use DynamoDB
4. preserving S3 sidecar metadata as an audit artifact if useful

If stronger metadata integrity is required, signed metadata can be introduced by:

1. defining a canonical metadata envelope
2. signing the metadata envelope or digest using AWS KMS
3. verifying the metadata signature before using expected digest values
4. logging signing and verification events

## Non-Goals

This ADR does not decide:

- final production metadata schema
- KMS signing target
- S3 Object Lock adoption
- DynamoDB table design
- multi-tenant metadata partitioning
- SaaS access control model
- public blockchain anchoring
- compliance certification claims

## Decision Summary

For Phase 2, use S3 sidecar metadata objects for expected digest metadata.

This is the simplest design that preserves the local MVP trust semantics while allowing future migration to DynamoDB or signed metadata.
