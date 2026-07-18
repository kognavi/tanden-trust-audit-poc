# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses [Semantic Versioning](https://semver.org/) for its
own milestone tags (note: pre-1.0, so minor versions may include breaking
changes to internal interfaces).

## [0.2.0] - 2026-07-18

### Added

**Phase 4 — AWS KMS-Backed Signing**
- `AwsKmsProvider` implementing the signature provider interface against AWS KMS asymmetric keys (`sign`, `verify`, `getPublicKey`) (#65)
- `signDigest` / `verifyDigestSignature` using KMS `SignCommand` / `VerifyCommand`, with local DER-to-raw signature decoding for interoperability with the existing ECDSA verification path (#65)
- Lazy, cached `_ensureKeySpecVerified()` guard: verifies the KMS key's `KeySpec` on first use and fails fast if it does not match the expected `ECC_SECG_P256K1` (TD-001, #65)
- Public key caching as a side effect of the KeySpec check, eliminating redundant `GetPublicKeyCommand` calls on repeated invocations (TD-003, #65)
- Unit tests using a fake KMS client (`FakeKmsClient`), covering key spec validation, caching behavior, and error propagation

**Phase 5 — Signing Event Ledger**
- `PgSigningLogger` implementing an append-only, hash-chained signing event ledger (`appendEvent`, `verifyChainIntegrity`) modeled after blockchain-style tamper evidence (#65)
- Genesis hash anchoring (`GENESIS_HASH`) and per-event hash linkage for chain integrity verification
- `AuditManager` integration layer with fail-fast error propagation (#65)
- ADR 0004: signing event ledger design rationale
- Unit tests using an in-memory fake `pg.Pool` client, validating real SQL statement shape without requiring a live PostgreSQL instance

**Cost Guardrail**
- Terraform-managed AWS Budgets alert: monthly budget threshold with SNS email notifications at 50/80/100% actual and 100% forecasted spend

### Fixed

- **TD-002 (partial)**: `AwsKmsProvider` now preserves the original AWS SDK error as `error.cause` when re-throwing from `GetPublicKey`, `Sign`, and `Verify` operations (#69, PR #70). This allows callers to inspect `error.cause.name` and `error.cause.$metadata` for root-cause diagnosis.
  - **Not yet done**: error-type classification helpers (`isThrottlingError`, `isAccessDeniedError`) and the equivalent `cause`-preservation fix on the PostgreSQL ledger write path remain open — tracked separately (see Known Limitations).

### Known Limitations (by design, for this MVP)

- **TD-002 remaining scope**: KMS-side error classification helpers (`isThrottlingError`, `isAccessDeniedError`) and PostgreSQL-side `cause` preservation on ledger writes are not yet implemented, despite Issue #69 being closed by PR #70. Root KMS `cause` chaining is fixed; classification and PG parity remain future work.
- No live AWS KMS or PostgreSQL integration test — KMS and PG providers are currently verified against fake/in-memory clients only; live integration testing remains a future stretch goal
- No S3 Object Lock enforcement — see ADR 0003
- No blockchain anchoring — planned for future phase
- No multi-tenant authorization
- No production-grade key rotation

### Verification

- 113/113 automated tests passing (`npm test`)
- Real AWS S3 integration remains manually verified per v0.1.0 (see `docs/aws-s3-integration-test.md`)

## [0.1.0] - 2026-07-03

### Added

**Phase 1 — Local Evidence Verification**
- JSON Schema validation for evidence records
- RFC 8785 (JCS) canonical JSON serialization
- SHA-256 digest generation and hash-based verification
- CLI verification script (`scripts/verify-evidence.js`)

**Phase 1.5 — Signature & Sidecar Metadata Layer**
- Local ECDSA P-256 signing/verification provider (`lib/signature.js`)
- Signature provider abstraction, decoupled from digest generation
- Versioned sidecar metadata schema (v1) with canonical signing payload
- `LocalJsonObjectStore` with safe key validation and error mapping
- Local sidecar end-to-end tamper detection tests

**Phase 2 — AWS S3 Integration**
- `S3JsonObjectStore` implementing the same interface as the local store
- Sidecar metadata signing/verification reused against S3-stored objects
- Fake-client E2E tests for tamper detection and missing-object handling
- Gated, opt-in real AWS S3 integration test (`npm run test:aws:s3`)
- Manually verified against a real AWS S3 bucket (ap-northeast-1, SSE-S3, public access blocked)

**Phase 3 — Security Documentation Hardening**
- Comprehensive threat model (`docs/threat-model.md`): assets, trust boundaries, threat actors, STRIDE mapping, residual risks
- Documentation index (`docs/README.md`) for navigating the full docs set
- ADR 0001: digest and metadata storage approach
- ADR 0002: S3 JSON object store design
- ADR 0003: decision to defer S3 Object Lock enforcement for the current MVP, with a documented future implementation path

### Changed
- Consolidated legacy security notes: `docs/security.md` marked as superseded by `docs/threat-model.md`
- Consolidated early KMS signing draft: `docs/aws-kms-signing-design.md` marked as superseded by `docs/kms-signing-design.md`
- Corrected `docs/roadmap.md` to reflect actual completed phases (previously understated progress)

### Known Limitations (by design, for this MVP)
- No AWS KMS-backed signing (local key pair only) — planned for Phase 4
- No S3 Object Lock enforcement — see ADR 0003
- No blockchain anchoring — planned for Phase 7
- No multi-tenant authorization
- No production-grade key rotation

### Verification
- 79/79 automated tests passing (`npm test`)
- Real AWS S3 integration manually verified (see `docs/aws-s3-integration-test.md`, `docs/local-verification-result.md`)
