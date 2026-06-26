# Phase 2 AWS-Backed MVP Requirements

## Purpose

Phase 2 extends the local Tanden Trust Audit PoC into a minimal AWS-backed architecture.

The goal is to demonstrate how tamper-evident evidence records can be stored, verified, signed, and audited using AWS managed services while preserving the trust assumptions proven in the local MVP.

## Background

The current local MVP demonstrates:

- JSON Schema validation
- RFC 8785 JCS-compatible canonicalization
- SHA-256 digest generation
- Expected digest sidecar verification
- Local ECDSA P-256 signature generation and verification
- Tamper detection for modified evidence records
- Automated tests and CI checks

Phase 2 should preserve these mechanics while introducing AWS-managed storage, signing, access control, and audit logging patterns.

## Scope

Phase 2 focuses on a minimal AWS-backed MVP for evidence integrity and verification.

In scope:

- Store evidence JSON records in AWS-managed storage
- Store expected digest metadata separately from evidence content
- Use AWS KMS for signing or signing-oriented design
- Use IAM least privilege principles
- Use CloudTrail or equivalent AWS audit logging for operational traceability
- Define tamper detection workflow using stored evidence and trusted digest metadata
- Define a minimal deployment path suitable for a prototype environment

Out of scope items are defined in `non-goals.md`.

## Functional Requirements

### FR-1 Evidence Storage

The system shall store evidence JSON records in AWS-managed storage.

Candidate service:

- Amazon S3

The storage design should support future immutability controls such as S3 Object Lock.

### FR-2 Digest Metadata Storage

The system shall store expected digest metadata separately from the evidence JSON content.

Candidate services:

- Amazon DynamoDB
- S3 sidecar object
- Signed metadata file

The selected approach must clearly define the trust boundary for expected digest values.

### FR-3 Evidence Verification

The system shall verify evidence integrity by:

1. Loading the evidence JSON
2. Canonicalizing it using RFC 8785 JCS-compatible canonicalization
3. Calculating a SHA-256 digest
4. Comparing the calculated digest with a trusted expected digest
5. Returning `VALID` or `INVALID`

### FR-4 Signature Verification

The system shall support a design path for AWS KMS-backed signing and verification.

The implementation may start with an interface or adapter boundary before adding live AWS KMS integration.

### FR-5 Tamper Detection

The system shall detect tampering when stored evidence content differs from the trusted expected digest or signature.

### FR-6 Audit Logging

The system shall define how operational actions are logged, including:

- Evidence write
- Evidence read
- Digest metadata write
- Verification request
- Signing request
- Verification failure

Candidate service:

- AWS CloudTrail

### FR-7 Minimal Demo Workflow

The system shall define a reproducible demo workflow for:

1. Uploading or registering an evidence record
2. Registering or storing its expected digest
3. Verifying the original evidence
4. Verifying a tampered copy or modified content
5. Demonstrating `VALID` and `INVALID` outcomes

## Non-Functional Requirements

### NFR-1 Security

The design shall apply least privilege access control.

### NFR-2 Auditability

The design shall provide sufficient traceability for key operations.

### NFR-3 Reproducibility

The Phase 2 workflow shall be reproducible by a reviewer using documented commands.

### NFR-4 Portability

Local development and CI should avoid unnecessary platform-specific dependencies.

### NFR-5 Cost Awareness

The architecture shall prefer low-cost serverless or managed services suitable for a prototype.

### NFR-6 Maintainability

The implementation should preserve the existing modular structure and testability.

## Security Requirements

- Evidence objects and digest metadata must have clearly defined trust boundaries.
- Private signing material must not be stored in the repository.
- IAM permissions should be scoped to the minimum required actions.
- Logs should not expose secrets or sensitive private key material.
- Any production path must consider encryption at rest and in transit.

## Audit Requirements

The design should explain how to answer the following questions:

- Who wrote the evidence?
- Who wrote or updated the expected digest metadata?
- Who requested verification?
- When did verification occur?
- What was the verification result?
- Was the evidence modified after registration?

## Assumptions

- Phase 2 remains a prototype, not a production-certified audit platform.
- Sample evidence data remains synthetic.
- The local MVP remains the source of truth for core canonicalization and digest mechanics.
- AWS integration should be introduced incrementally.

## Open Questions

- Should expected digests be stored in DynamoDB, S3 sidecar objects, or signed metadata?
- Should AWS KMS sign the canonical digest or the canonical JSON bytes?
- Should verification be performed by Lambda, CLI, or both?
- Should S3 Object Lock be part of Phase 2 or deferred to Phase 3?
- How should evidence IDs map to storage keys and metadata records?
