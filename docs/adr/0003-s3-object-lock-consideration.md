# ADR 0003: S3 Object Lock Consideration for Audit Evidence

## Status
Proposed

## Context
The Tanden Trust Audit PoC aims to provide tamper-evident audit evidence. The current MVP (Phase 1–2) achieves this through JSON Schema validation, canonical JSON hashing (RFC 8785 JCS + SHA-256), local ECDSA P-256 signatures, and sidecar metadata verification across both a local object store and Amazon S3.

These controls detect tampering after the fact — if evidence or its sidecar metadata is modified, verification fails. However, they do not prevent deletion or modification of the underlying S3 objects by a principal with `s3:DeleteObject` or `s3:PutObject` permissions.

AWS S3 Object Lock provides WORM (Write Once, Read Many) semantics: once an object is locked, it cannot be deleted or overwritten until a retention period expires (Governance mode) or ever (Compliance mode, even by the root account).

## Decision
We have decided **not to implement S3 Object Lock in the current MVP (Phase 1–3)**.

## Rationale

1. **Testing Complexity**
   Object Lock requires S3 Versioning to be enabled and Object Lock to be enabled at bucket *creation* time (it cannot be enabled retroactively on an existing bucket). This adds setup constraints to the gated real-AWS integration test (`npm run test:aws:s3`), which currently creates and tears down a temporary bucket per run.

2. **Lifecycle Management Conflict**
   The PoC's real AWS S3 integration test creates a temporary bucket and deletes it after verification (see `docs/aws-s3-integration-test.md`). Object Lock in Compliance mode would make objects (and therefore the bucket) undeletable within the retention window, breaking automated teardown and leaking AWS resources during repeated test runs.

3. **Scope Focus**
   The MVP's primary goal is to demonstrate cryptographic integrity (hash + signature + sidecar metadata) as the core trust mechanism. Object Lock is a storage-layer *prevention* control, which is a distinct and separable concern from the *detection* controls already implemented. It is more appropriately introduced alongside production-grade infrastructure (IaC-managed buckets, defined retention policy, legal hold procedures).

## Consequences

**Pros of deferring:**
- Keeps the CI/CD pipeline and gated integration test simple and repeatable
- Avoids AWS resource leakage / manual cleanup during PoC iteration
- Keeps the MVP scope focused on cryptographic integrity, matching `docs/threat-model.md` (S3 Object Lock is explicitly listed as out of scope)

**Cons of deferring:**
- Evidence remains vulnerable to deletion or overwrite by any principal holding `s3:DeleteObject` / `s3:PutObject` on the evidence bucket
- Tampering is *detected* upon verification, but not *prevented* at the storage layer
- This is a known residual risk, already recorded in `docs/threat-model.md`

## Future Recommendations

- **Governance mode**: Recommended as the default for production. Allows privileged principals (e.g., a break-glass IAM role) to bypass retention with `s3:BypassGovernanceRetention`, balancing tamper-resistance with operational flexibility.
- **Compliance mode**: Recommended only for regulated environments where even root-account deletion must be impossible for the retention period. Requires careful retention-period planning, since it cannot be shortened or removed once applied.
- **Implementation approach**: When moving beyond PoC, provision the evidence bucket via IaC (Terraform or AWS CDK) with:
  - Versioning enabled at creation
  - Object Lock enabled at creation, in Governance mode initially
  - A defined default retention period (e.g., 1–7 years depending on audit requirements)
  - Separate, dedicated buckets for production vs. test/integration workloads, so test teardown never touches locked buckets

## Related Documents
- `docs/threat-model.md` — lists S3 Object Lock enforcement as explicitly out of scope for the current MVP
- `docs/aws-s3-integration-test.md` — describes the gated real S3 test whose teardown logic motivated this decision
- `docs/security.md` — earlier draft that first raised S3 Object Lock as a future consideration (superseded by `threat-model.md`)
