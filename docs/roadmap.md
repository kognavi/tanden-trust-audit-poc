# Roadmap

## Phase 0: Repository Setup

Status: Completed

Goals:

- Create public GitHub repository
- Add README
- Add MIT License
- Add Node `.gitignore`
- Add initial documentation

Deliverables:

- README.md
- LICENSE
- .gitignore
- docs/architecture.md
- docs/audit-design.md
- docs/threat-model.md
- docs/roadmap.md

## Phase 1: Local Evidence Verification

Status: Completed

Goals:

- Create sample evidence JSON
- Validate evidence records against JSON Schema
- Canonicalize evidence using RFC 8785 (JCS)
- Implement SHA-256 digest generation
- Implement hash-based evidence verification
- Confirm that changes to evidence data are detectable

Deliverables:

- samples/evidence-consent.json
- lib/schema.js
- lib/canonicalize.js
- lib/hash.js
- scripts/verify-evidence.js
- Unit tests for hashing, canonicalization, and schema validation

## Phase 1.5: Signature & Sidecar Metadata Layer

Status: Completed

Goals:

- Sign canonical evidence digests using a local ECDSA P-256 key pair
- Define a versioned sidecar metadata schema
- Separate the signature provider from digest generation for future extensibility
- Implement a local JSON object store with safe key validation
- Detect tampering in both evidence and sidecar metadata

Deliverables:

- lib/signature.js
- lib/signature-digest.js
- Local ECDSA signing/verification provider
- Sidecar metadata schema v1 (validation, canonical signing payload)
- LocalJsonObjectStore (safe key handling, error mapping)
- Local sidecar E2E tests (tamper detection for evidence and metadata)
- docs/signature-provider-design.md

## Phase 2: AWS S3 Integration

Status: Completed

Goals:

- Implement an S3-backed JSON object store with the same interface as the local store
- Reuse sidecar metadata signing/verification against S3-stored objects
- Add tamper detection tests using a fake S3 client
- Verify the implementation against a real AWS S3 bucket in a gated, opt-in test

Deliverables:

- lib/s3-object-store.js
- S3 sidecar E2E tests (fake client): tamper detection, missing object handling
- Gated real AWS S3 integration test (`npm run test:aws:s3`)
- Manual real AWS S3 verification record (ap-northeast-1, temporary bucket, SSE-S3, public access blocked)
- docs/aws-s3-integration-test.md
- docs/local-verification-result.md

## Phase 3: Security Documentation Hardening

Status: In Progress

Goals:

- Document the threat model for the current MVP implementation (assets, trust boundaries, threat actors)
- Map STRIDE categories to current mitigations
- Record residual risks and explicit future mitigations
- Organize the growing docs/ directory with a navigable index
- Document explicit design decisions (ADRs) for deferred production controls

Deliverables:

- docs/threat-model.md (updated for current MVP scope)
- docs/README.md (documentation index) — planned
- docs/adr/0003-s3-object-lock-consideration.md — planned

## Phase 4: AWS KMS Signing & Key Management

Status: Planned

Goals:

- Replace the local ECDSA signing provider with an AWS KMS asymmetric signing provider
- Keep the existing signature provider interface unchanged for callers
- Define least-privilege IAM policies for signing operations
- Record KMS key usage via AWS CloudTrail

Reference Designs:

- docs/kms-signing-design.md
- docs/aws-kms-key-management-design.md

## Phase 5: Tamper-Resistance Enhancement

Status: Planned

Goals:

- Add SSE-KMS support to the S3 object store as an alternative to SSE-S3
- Evaluate S3 Object Lock (Governance vs. Compliance mode) for evidence buckets
- Enable S3 Versioning on production-oriented buckets
- Explore external timestamping options

Possible Technologies:

- S3 Object Lock
- SSE-KMS
- S3 Versioning
- OpenTimestamps

## Phase 6: AI-Assisted Audit Review

Status: Planned

Goals:

- Use AI to summarize audit evidence
- Detect inconsistencies in records
- Generate human-readable audit reports
- Keep AI output traceable to source evidence

Important Principles:

- AI should not replace source evidence
- AI analysis should be reviewable
- AI-generated output should be clearly separated from original records

## Phase 7: Web3-Compatible Verification

Status: Planned

Goals:

- Add blockchain-compatible evidence anchoring
- Explore Verifiable Credentials
- Explore selective disclosure
- Avoid storing personal data on-chain

Possible Technologies:

- Ethereum-compatible hash anchoring
- Polygon or other L2 networks
- Verifiable Credentials
- Decentralized Identifiers
- Zero-knowledge proofs

## Current Priority

The current priority is Phase 3:

1. Add a documentation index (`docs/README.md`) to organize the growing design document set
2. Add an ADR documenting the decision to defer S3 Object Lock for the current MVP
3. Prepare for Phase 4 (AWS KMS signing provider) as the next implementation milestone

---

## Technical Debt Backlog

The following items were identified during Phase 4 implementation and are tracked here for future resolution.

### TD-001: AwsKmsProvider — KeySpec validation on initialization

**Priority:** High

**Status:** ✅ Resolved

**Context:** `decodeDerSignatureToRaw` normalizes r and s values to exactly 32 bytes, which is correct for secp256k1 (P-256K1). If the KMS key is inadvertently configured with a different curve (e.g. P-384, P-521), this fixed-width decoding will silently produce incorrect signatures rather than failing loudly.

**Proposed fix:** In the constructor or a lazy `initialize()` method, call `GetPublicKeyCommand` and assert that `response.KeySpec` equals `ECC_SECG_P256K1`. Throw an error immediately if it does not match (Fail Fast principle).

**Affected file:** `lib/aws-kms-provider.js`

**Resolution:** Implemented as a lazy, cached guard `_ensureKeySpecVerified()`, invoked at the start of `signDigest`, `verifyDigestSignature`, and `getPublicKey`. Throws immediately if `response.KeySpec !== 'ECC_SECG_P256K1'`. Verified in `tests/aws-kms-provider.test.js` (`_ensureKeySpecVerified: throws on unsupported KeySpec (TD-001)`).

---



### TD-002: AwsKmsProvider — Add `cause` chain to error wrapping

**Priority:** Medium

**Context:** The current `catch` blocks in `signDigest`, `verifyDigestSignature`, and `getPublicKey` create a new `Error` with a descriptive message but discard the original AWS SDK error. This means callers cannot programmatically detect specific error types such as `AccessDeniedException` or `KMSInvalidStateException`.

**Proposed fix:** Replace:

```js
throw new Error(`KMS Sign operation failed: ${err.message}`);
```

with:

```js
throw new Error(`KMS Sign operation failed: ${err.message}`, { cause: err });
```

in all three KMS operation catch blocks. Requires Node.js ≥ 16.9.0 (already satisfied by the project's `engines` constraint of ≥ 20).

**Affected file:** `lib/aws-kms-provider.js`

---

### TD-003: AwsKmsProvider — Cache `getPublicKey()` result

**Priority:** Low

**Status:** ✅ Resolved

**Context:** The public key for an asymmetric KMS key is immutable for the lifetime of the key. Calling `GetPublicKeyCommand` on every verification incurs an unnecessary KMS API call and associated cost.

**Proposed fix:** Store the result of the first `GetPublicKeyCommand` call in an instance variable (`this._cachedPublicKey`). Return the cached value on subsequent calls without issuing a new API request.

**Affected file:** `lib/aws-kms-provider.js`

**Resolution:** Resolved as a side effect of the TD-001 fix — `_ensureKeySpecVerified()` caches the public key bytes returned alongside `KeySpec` from the same `GetPublicKeyCommand` call, eliminating redundant KMS API calls on repeated `getPublicKey()` invocations. Verified in `tests/aws-kms-provider.test.js` (`_ensureKeySpecVerified: caches result across multiple calls (TD-003)`).

