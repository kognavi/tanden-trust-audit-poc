# Tanden Trust Audit PoC

[![Verify Evidence Integrity](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/verify.yml/badge.svg)](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/verify.yml)

A tamper-evident audit trail prototype for consent history, activity records, and trust events using JSON Schema validation and SHA-256 hash verification.

This project demonstrates how structured audit evidence can be validated, hashed, and verified in a reproducible way. It is designed as a technical proof of concept for audit trails, consent records, trust logs, AI-assisted governance, and Web3-compatible verification workflows.

---

## Current Status

**MVP status:** v0.1.0 candidate.

The local proof of concept currently supports schema validation, RFC 8785 JCS-compatible canonicalization, SHA-256 tamper detection, local ECDSA P-256 signature verification, automated tests, and GitHub Actions CI.

Production-oriented AWS hardening, including AWS KMS-backed signing and immutable storage, is documented as a future extension rather than included as a deployed production system.

---

## Overview

Modern digital trust systems require more than simply storing records.

For audit evidence to be useful, it should satisfy at least two technical requirements:

1. **Structural validity**  
   The evidence record should follow an expected schema.

2. **Integrity verification**  
   The evidence record should be detectable if modified after creation.

This PoC combines:

- **JSON Schema validation** for structural correctness
- **SHA-256 hashing** for tamper-evident verification
- **Automated tests** for regression prevention
- **GitHub Actions CI** for reproducible validation

---

## Key Features

- Validate audit evidence records against a JSON Schema
- Detect malformed or unexpected evidence structures
- Generate RFC 8785 JCS-compatible canonical JSON from evidence data
- Calculate SHA-256 hash values
- Verify whether evidence has been modified
- Sign and verify evidence using local ECDSA P-256 keys for demonstration
- Detect tampering with public-key signature verification
- Run automated tests using Node.js built-in test runner
- Run validation and verification automatically in GitHub Actions

---

## Validation Flow

The basic verification flow is:

```text
Evidence JSON
  ↓
JSON Schema validation
  ↓
RFC 8785 JCS-compatible canonical JSON generation
  ↓
SHA-256 hash calculation
  ↓
Hash verification
  ↓
VALID / INVALID result
```

This separates two important concerns:

| Layer | Purpose |
|---|---|
| JSON Schema validation | Confirms that the evidence has the expected structure |
| SHA-256 hash verification | Confirms that the evidence has not been modified |

---

## Security Model and Current Limitations

The current local MVP demonstrates tamper-evident evidence verification using:

- JSON Schema validation
- RFC 8785 JSON Canonicalization Scheme
- SHA-256 hashing
- deterministic verification scripts
- automated tests
- GitHub Actions CI

This local workflow can detect whether the evidence content has changed.

However, hash verification alone does not prove:

- who produced the evidence
- who approved the expected hash
- whether the expected hash was stored in a trusted location
- whether an attacker replaced both the evidence and the expected hash
- whether evidence records were deleted, reordered, or omitted
- whether the event timestamp came from a trusted time source
- whether the evidence was stored immutably

For this reason, the project separates the current local MVP from the production-oriented security design.

In the production-oriented design, the local hash-based workflow is extended with:

- AWS KMS asymmetric signing for authenticity and stronger non-repudiation
- S3 Object Lock for immutable evidence storage
- DynamoDB for evidence metadata, digest, signature, sequence, and verification state
- CloudTrail for signing, storage, and administrative audit logs
- IAM least privilege and separation of duties
- optional hash chaining or Merkle tree anchoring for sequence and completeness checks
- EventBridge and CloudWatch for monitoring and operational visibility

In short:

| Security property | Local MVP | Production-oriented design |
|---|---|---|
| Schema correctness | JSON Schema | JSON Schema |
| Deterministic canonicalization | RFC 8785 JCS | RFC 8785 JCS |
| Content tamper detection | SHA-256 hash verification | SHA-256 hash verification |
| Authenticity | Not fully proven locally | AWS KMS asymmetric signing |
| Non-repudiation support | Limited | KMS signing, IAM controls, and CloudTrail |
| Trusted expected hash | Manual/local assumption | Signed digest and controlled metadata storage |
| Immutable storage | Not included locally | S3 Object Lock |
| Sequence/completeness checks | Not included locally | Hash chain or Merkle tree roadmap |
| Trusted timestamping | Not included locally | Ingestion time, CloudTrail, and optional external timestamping |
| Operational auditability | Local logs and tests | CloudTrail, CloudWatch, EventBridge, and runbooks |

This distinction is intentional.

The local MVP is designed to be reproducible and easy to review.  
The AWS production-oriented design describes how the same evidence workflow can be hardened for stronger authenticity, immutability, auditability, and operational control.

---

## Project Completion Target

This portfolio project is considered complete when it demonstrates:

- local evidence validation
- deterministic canonicalization
- SHA-256 tamper detection
- automated tests
- GitHub Actions CI
- verification runbook
- threat model and attack scenarios
- AWS KMS signing design
- AWS production reference architecture
- documented hash-only limitations
- architecture diagrams
- local signature verification prototype
- hash chain verification prototype

The project does not aim to provide a production SaaS, legal compliance certification, or complete AWS deployment in its current phase.

---

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── verify.yml
├── docs/
│   └── framework-selection.md
├── lib/
│   ├── audit.js
│   ├── schema-validation.js
│   └── signature.js
├── samples/
│   └── evidence-consent.json
├── schemas/
│   └── evidence.schema.json
├── scripts/
│   ├── generate-local-keys.js
│   ├── hash-evidence.js
│   ├── sign-evidence.js
│   ├── validate-evidence.js
│   ├── verify-evidence.js
│   └── verify-signature.js
├── tests/
│   ├── audit.test.js
│   ├── schema-validation.test.js
│   └── signature.test.js
├── package.json
└── README.md
```

---

## Design Documents

Additional design documents are available in the `docs` directory:

- [Framework Selection](docs/framework-selection.md)
- [Architecture Diagram](docs/architecture-diagram.md)
- [Audit Procedures](docs/audit-procedures.md)
- [Control Mapping](docs/control-mapping.md)
- [Evidence Lifecycle](docs/evidence-lifecycle.md)
- [Threat Model](docs/threat-model.md)
- [Attack Scenarios](docs/attack-scenarios.md)
- [Signature Provider Design](docs/signature-provider-design.md)
- [KMS Signing Design](docs/kms-signing-design.md)
- [AWS KMS Key Management Design](docs/aws-kms-key-management-design.md)
- [AWS Reference Architecture](docs/aws-reference-architecture.md)
- [Portfolio Summary](docs/portfolio-summary.md)
- [Verification Runbook](docs/verification-runbook.md)

## Requirements

- Node.js 20 or later
- npm

Install dependencies:

```bash
npm ci
```

---

## Usage

### Run schema validation

```bash
npm run validate:evidence
```

Expected result:

```text
Schema validation result: VALID
```

---

### Generate evidence hash

```bash
npm run hash
```

This command generates an RFC 8785 JCS-compatible canonical JSON representation and calculates a SHA-256 hash.

---

### Verify evidence integrity

```bash
npm run verify
```

The sample verification command reads the trusted expected digest from `samples/evidence-consent.expected.sha256`.

In this local MVP, the sidecar expected digest file is a local trust assumption. In production, expected digests should be protected by signed metadata, immutable storage, or a trusted registry.

Expected result:

```text
Verification result: VALID
```

---

### Run local signature verification demo

This project also includes a local ECDSA P-256 signature verification demo.

The signature workflow demonstrates authenticity and tamper detection beyond simple hash comparison:

```text
Evidence JSON
  ↓
RFC 8785 JCS-compatible canonical JSON generation
  ↓
SHA-256 digest calculation
  ↓
ECDSA P-256 signing with local private key
  ↓
ECDSA P-256 verification with local public key
  ↓
VALID / INVALID result
```

Run the local signature demo:

```bash
rm -rf .local-keys signatures
npm run generate:keys
npm run sign
npm run verify:signature
npm run demo:tamper
npm run verify:signature || true
npm run demo:restore
npm run verify:signature
```

Expected result:

```text
Verification result: VALID
Verification result: INVALID
Verification result: VALID
```

The second verification result becomes `INVALID` because the evidence content is modified after signing.  
After restoring the evidence content, the same signature verifies as `VALID` again.

Local private keys and generated signatures are intentionally ignored by Git:

```text
.local-keys/
signatures/
*.sig
```

> Note: This local signing workflow is for demonstration only.  
> In production, private keys should be managed by AWS KMS or CloudHSM, evidence should be stored with immutability controls such as S3 Object Lock, and verification metadata should be persisted in an auditable store.

---

### Run full demo

```bash
npm run demo
```

The demo runs:

1. JSON Schema validation
2. SHA-256 hash generation
3. SHA-256 hash verification

---

## Testing

Run all tests:

```bash
npm test
```

The test suite covers:

- Valid evidence data
- Missing required fields
- Invalid date-time format
- Unexpected additional properties
- Invalid enum values
- Hash verification success and failure cases

---

## CI/CD

This repository uses GitHub Actions to automatically run validation and tests on pull requests and pushes to `main`.

The workflow performs:

1. Checkout repository
2. Setup Node.js
3. Install dependencies with `npm ci`
4. Run automated tests
5. Generate evidence hash
6. Verify evidence integrity

Workflow file:

```text
.github/workflows/verify.yml
```

---

## Evidence Schema

The sample evidence record is defined by:

```text
schemas/evidence.schema.json
```

The schema currently uses JSON Schema Draft-07 for compatibility with the standard AJV package used in the CI environment.

Example evidence file:

```text
samples/evidence-consent.json
```

---

## Security and Audit Design Notes

This PoC demonstrates a two-layer validation approach:

1. **Schema-level validation**
   - Ensures that required fields exist
   - Restricts unexpected properties
   - Validates date-time formats and enum values

2. **Cryptographic integrity verification**
   - Uses SHA-256 to detect changes to the evidence payload
   - Produces deterministic hashes from RFC 8785 JCS-compatible canonical JSON

This design is useful as a foundation for:

- Consent history tracking
- Activity record verification
- AI governance logs
- Audit trail prototypes
- Web3-compatible evidence anchoring
- Compliance-oriented trust systems

---

## Limitations

This project is a technical proof of concept only.

It does not provide:

- Legal advice
- Audit opinion
- Regulatory compliance certification
- Production-grade identity management
- Production-grade key management
- Non-repudiation guarantees
- Blockchain anchoring by default

Actual audit, compliance, legal, and security requirements should be reviewed with qualified professionals.

---

## Future Roadmap

### v0.1.0 MVP Scope

The v0.1.0 MVP focuses on a reproducible local proof of concept for tamper-evident audit evidence.

Included in v0.1.0:

- JSON Schema validation
- RFC 8785 JCS-compatible canonicalization
- SHA-256 evidence hashing
- Hash-based tamper detection
- Local ECDSA P-256 signature generation and verification
- Local tamper detection demo
- Automated tests
- GitHub Actions CI
- Verification runbook
- Threat model and attack scenarios
- AWS-oriented production design documents

### Phase 2: AWS-backed authenticity and immutability

Potential future enhancements include:

- AWS KMS asymmetric signing implementation
- S3 Object Lock based immutable evidence storage
- DynamoDB metadata persistence for digest, signature, sequence, and verification state
- CloudTrail and CloudWatch based operational auditability
- IAM least-privilege execution roles
- Key rotation and verification policy documentation

### Phase 3: Productization and external verification

Potential future enhancements include:

- API layer with OpenAPI documentation
- Approval metadata
- Role-based access control metadata
- Retention policy metadata
- Exception handling flags
- UUID-based evidence identifiers
- Hash chain or Merkle tree based completeness verification
- Blockchain anchoring
- Multi-tenant SaaS architecture

### Out of Scope for v0.1.0

The v0.1.0 MVP does not aim to provide:

- A deployed production AWS environment
- Legal advice
- Audit opinion
- Regulatory compliance certification
- Production SaaS functionality
- Default blockchain anchoring

---

## License

MIT

## JSON Canonicalization

This PoC uses RFC 8785 JSON Canonicalization Scheme (JCS) compatible canonicalization via the `canonicalize` package before calculating SHA-256 hashes.

Using JCS-compatible canonicalization avoids relying on ad-hoc key sorting and helps produce stable, interoperable hash inputs across implementations.

The verification flow is:

```text
Evidence JSON
  ↓
JSON Schema validation
  ↓
RFC 8785 JCS-compatible canonicalization
  ↓
SHA-256 hash calculation
  ↓
Hash comparison
  ↓
VALID / INVALID
```

This PoC focuses on structural validation and tamper detection. It does not prove that the original event content is true, nor does it provide legal audit certification by itself.

## Articles

This project is part of an ongoing exploration of AI × Web3 digital proof, audit evidence, and verifiable trust.

- AI×Web3で「見えない信頼」を証明する  
  https://note.com/fair_beetle339/n/nbc14f4e803b7

- 「見えない信頼」をどう作るか：AI×Web3デジタル証明の実装編  
  https://note.com/fair_beetle339/n/n22ef0c27423a

- 「見えない信頼」は誰が買うのか：AI×Web3デジタル証明の事業編  
  https://note.com/fair_beetle339/n/nffa803738f55

- Tanden Trust Audit PoC：AI×Web3デジタル証明の土台をGitHubで実装する  
  https://note.com/fair_beetle339/n/n432d57838031

- Tanden Trust Audit PoC：ハッシュ検証から電子署名による真正性確認へ  
  https://note.com/fair_beetle339/n/ne53bc5b3d170
