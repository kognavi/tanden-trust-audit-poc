# Threat Model

This document describes the threat model for the Tanden Trust Audit PoC.

The goal of this PoC is to provide tamper-evident audit evidence by combining
JSON Schema validation, canonical JSON hashing, digital signatures, sidecar
metadata, and pluggable object storage.

## Scope

In scope:

- Evidence JSON validation
- Canonical JSON digest calculation
- Sidecar metadata generation and verification
- ECDSA P-256 signature verification
- Local object storage
- AWS S3 object storage
- Tamper detection for stored evidence and metadata
- Gated real AWS S3 integration testing

Out of scope for the current MVP:

- AWS KMS-backed signing
- S3 Object Lock enforcement
- Blockchain anchoring
- Multi-tenant authorization
- Production-grade key rotation
- SIEM integration
- Long-term retention policy enforcement

## Assets

| Asset | Description |
|---|---|
| Evidence JSON | The original audit evidence payload |
| Sidecar metadata | Metadata containing digest, signing information, timestamps, and signature |
| Signing private key | Private key used to sign sidecar metadata |
| Signing public key | Public key used to verify sidecar metadata |
| Object storage | Local filesystem or AWS S3 bucket used to store evidence and metadata |
| Verification logic | Code that validates evidence integrity and metadata signatures |
| Test records | Unit, E2E, and integration test results proving expected behavior |

## Trust Boundaries

| Boundary | Description |
|---|---|
| Caller to validation logic | External input enters the validation and verification process |
| Application to object store | Application code writes to and reads from local or S3 storage |
| Application to AWS S3 | Network and IAM boundary between application and AWS |
| Signing provider boundary | Signing implementation may be local today and AWS KMS in the future |
| CI/test boundary | Automated tests should not depend on real AWS unless explicitly enabled |

## Threat Actors

| Actor | Motivation |
|---|---|
| Accidental operator | Mistakenly modifies or deletes evidence or metadata |
| Malicious insider | Attempts to alter audit evidence after the fact |
| Compromised application | Writes invalid, incomplete, or misleading evidence |
| Storage attacker | Modifies objects directly in storage |
| Credential attacker | Uses leaked credentials to access S3 or signing material |
| Supply chain attacker | Attempts to alter dependencies or test behavior |

## Attack Scenarios

### 1. Evidence JSON is modified after storage

An attacker modifies the stored evidence JSON after it has been signed.

Mitigation:

- The evidence digest is calculated from canonical JSON.
- Verification recomputes the digest.
- If the stored evidence differs from the digest in sidecar metadata, verification fails.

Current coverage:

- Unit tests for tampered evidence
- Local sidecar E2E tamper detection
- S3 sidecar E2E tamper detection

### 2. Sidecar metadata is modified after storage

An attacker modifies sidecar metadata, for example by replacing the digest or timestamp.

Mitigation:

- Sidecar metadata is signed after omitting the signature field itself.
- Verification checks the ECDSA signature against the canonical metadata payload.
- Any metadata mutation invalidates the signature.

Current coverage:

- Metadata signature verification tests
- Local sidecar E2E tamper detection
- S3 sidecar E2E tamper detection

### 3. Evidence and metadata are both replaced

An attacker replaces both evidence and metadata with a new matching pair.

Mitigation in current MVP:

- Replacement is detectable if the attacker does not have the signing private key.
- Signature verification fails without a valid signature from the trusted key.

Residual risk:

- If the signing private key is compromised, the attacker can create a valid replacement pair.
- AWS KMS-backed signing and key access controls are planned future mitigations.

### 4. Object is missing from storage

Evidence or metadata is deleted or missing.

Mitigation:

- Missing objects are mapped to an explicit `OBJECT_NOT_FOUND` error.
- Verification fails closed when required objects are unavailable.

Current coverage:

- Local object store missing object tests
- S3 object store missing object tests
- S3 sidecar E2E missing metadata test

### 5. Invalid JSON is stored

A corrupted or non-object JSON payload is stored.

Mitigation:

- Object store implementations reject invalid JSON objects.
- Evidence schema validation rejects invalid evidence structure.

Current coverage:

- Local invalid JSON tests
- S3 invalid JSON tests
- JSON Schema validation tests

### 6. Unsafe object keys are used

A caller attempts path traversal or unsafe object keys.

Mitigation:

- Object keys are validated before read/write operations.
- Absolute paths, path traversal, and empty keys are rejected.

Current coverage:

- Safe key acceptance tests
- Unsafe key rejection tests for local and S3 object stores

### 7. Real AWS integration tests accidentally run in CI

A test suite unintentionally accesses real AWS resources.

Mitigation:

- Real AWS S3 integration tests are gated by environment variables.
- Default `npm test` does not access AWS.
- `npm run test:aws:s3` skips unless explicitly enabled.

Current coverage:

- Default test suite
- Gated integration test behavior
- Manual real AWS verification record

### 8. S3 bucket or IAM policy is misconfigured

A bucket could be public, unencrypted, or overly permissive.

Mitigation in current verification:

- Temporary test bucket used public access blocking.
- Temporary test bucket used SSE-S3 default encryption.
- Test resources were removed after verification.

Future mitigation:

- Document least-privilege IAM policy.
- Add SSE-KMS support.
- Consider S3 Object Lock for retention-sensitive environments.

## Security Properties

The current MVP provides:

- Tamper evidence for stored evidence JSON
- Tamper evidence for sidecar metadata
- Deterministic digest calculation using canonical JSON
- Signature-based metadata authenticity
- Storage abstraction between local and S3 backends
- Fail-closed behavior for missing or invalid objects
- Test separation between deterministic local tests and gated real AWS tests

The current MVP does not yet provide:

- Hardware-backed or managed key protection
- Immutable WORM storage
- Automated retention enforcement
- Blockchain timestamp anchoring
- Production identity and access management
- Formal compliance certification

## Residual Risks

| Risk | Current Status | Future Mitigation |
|---|---|---|
| Signing private key compromise | Not fully mitigated | AWS KMS signing provider |
| Object deletion | Detected as missing, not prevented | S3 Object Lock and versioning |
| S3 misconfiguration | Partially addressed in manual verification | Hardened IaC and IAM policies |
| Long-term retention | Not enforced | Retention policy and Object Lock |
| Key rotation | Not implemented | Key versioning and rotation design |
| Replay of old valid evidence | Not fully addressed | Sequence numbers, timestamps, and anchoring |
| Insider with broad AWS permissions | Not fully mitigated | Least privilege, CloudTrail, Object Lock |

## STRIDE Mapping

| STRIDE Category | Example Threats in This PoC | Current Mitigation |
|---|---|---|
| Spoofing | Forged evidence producer or unauthorized evidence creation | Not fully addressed in MVP; future producer identity and KMS-backed signing are planned |
| Tampering | Evidence JSON mutation, sidecar metadata mutation, unsafe object modification | Canonical digest verification, signed sidecar metadata, tamper detection tests |
| Repudiation | Actor denies that evidence was created or modified | Partially addressed by signed metadata; future audit logs and trusted timestamps are needed |
| Information Disclosure | Unauthorized access to evidence or metadata in S3 | Not fully addressed in MVP; future IAM hardening, encryption policy, and access logging are planned |
| Denial of Service | Evidence or metadata deletion, missing object, blocked verification | Missing objects fail closed; future Object Lock, versioning, and backups are planned |
| Elevation of Privilege | Overly broad AWS permissions or compromised credentials | Not fully addressed in MVP; future least-privilege IAM and CloudTrail monitoring are planned |

## Limitations

This threat model is intended for a portfolio-oriented PoC and does not represent
a formal security assessment, penetration test, compliance audit, legal opinion,
or production security certification.

The current MVP demonstrates tamper-evident evidence verification, but it does
not yet enforce production-grade identity, access control, immutable retention,
managed key protection, centralized audit logging, or regulatory compliance.

Before production use, the architecture should be reviewed by qualified security,
compliance, legal, and audit professionals.

## Future Work

Recommended next steps:

1. Add an ADR for S3 Object Lock consideration.
2. Add SSE-KMS options for S3 writes.
3. Design AWS KMS-backed signature provider.
4. Define least-privilege IAM policy for production usage.
5. Add an operational verification runbook.
6. Add release notes for the MVP release.
7. Consider blockchain anchoring for digest timestamping.

## Verification References

The following test categories support this threat model:

- Unit tests for hashing, canonicalization, schema validation, and signatures
- Local sidecar E2E tests
- S3 sidecar E2E tests using fake S3 client
- Gated real AWS S3 integration test
- Manual real AWS S3 verification record

The real AWS S3 integration test was manually verified using a temporary bucket
in `ap-northeast-1`. The temporary bucket was removed after verification.
