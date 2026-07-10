# Tanden Trust Audit PoC

[![Verify Evidence Integrity](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/verify.yml/badge.svg)](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/verify.yml)

A tamper-evident audit trail prototype for consent history, activity records, and trust events using JSON Schema validation, SHA-256 hash verification, local signature verification, and sidecar metadata verification.

This project demonstrates how structured audit evidence can be validated, hashed, signed, stored, and verified in a reproducible way. It is designed as a technical proof of concept for audit trails, consent records, trust logs, AI-assisted governance, and Web3-compatible verification workflows.

---

## Current Status

**MVP status:** v0.1.0 candidate.

The local proof of concept currently supports schema validation, RFC 8785 JCS-compatible canonicalization, SHA-256 tamper detection, local ECDSA P-256 signature verification, automated tests, and GitHub Actions CI.

Phase 2 AWS-backed MVP work is now partially implemented. The project includes sidecar metadata schema validation, canonical metadata signing payloads, ECDSA P-256 sidecar metadata signing and verification, full evidence + sidecar metadata verification, local JSON object storage, and S3-compatible JSON object storage.

The default test suite verifies both local and S3 sidecar storage flows without requiring AWS credentials or real S3 buckets. S3 behavior is tested through an injected in-memory fake S3 client so that tests remain fast, deterministic, and suitable for CI.

The current Phase 2 metadata storage decisions are documented in ADR 0001 and ADR 0002. Expected digest metadata initially uses sidecar metadata objects, and S3 JSON object storage is implemented as a pluggable backend. DynamoDB, AWS KMS-backed signing, immutable storage, richer metadata indexing, and operational monitoring remain future production hardening options rather than deployed production features.

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
- **RFC 8785 JCS-compatible canonicalization** for stable cryptographic inputs
- **SHA-256 hashing** for tamper-evident verification
- **ECDSA P-256 signatures** for local authenticity demonstrations
- **Sidecar metadata verification** for separating evidence content from verification metadata
- **Local and S3-compatible JSON object storage** for storage abstraction
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
- Validate v1 sidecar metadata for stored evidence
- Generate canonical sidecar metadata signing payloads
- Sign and verify sidecar metadata with local ECDSA P-256 keys
- Verify evidence together with signed sidecar metadata
- Store and load JSON evidence metadata through `LocalJsonObjectStore`
- Store and load JSON evidence metadata through `S3JsonObjectStore`
- Test S3-compatible storage flows using an injected in-memory fake S3 client
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

## Sidecar Metadata Verification Flow

Phase 2 extends the basic evidence verification flow with signed sidecar metadata.

```text
Evidence JSON
  ↓
RFC 8785 JCS-compatible canonicalization
  ↓
SHA-256 evidence digest
  ↓
Sidecar metadata creation
  ↓
Canonical metadata signing payload
  ↓
ECDSA P-256 metadata signature
  ↓
Store evidence and sidecar metadata
  ↓
Load evidence and sidecar metadata
  ↓
Verify evidence digest and metadata signature
  ↓
VALID / INVALID result
```

This design separates:

| Layer | Purpose |
|---|---|
| Evidence object | Stores the original audit evidence |
| Sidecar metadata object | Stores digest, algorithm, timestamp, evidence reference, and signature |
| Signature verification | Confirms that metadata was signed by the expected key |
| Digest verification | Confirms that loaded evidence matches the signed metadata |

The storage layer is intentionally not treated as the cryptographic trust boundary.  
Even when evidence and metadata are loaded from local storage or S3-compatible storage, the verification layer must still validate the evidence digest and sidecar metadata signature.

---

## Security Model and Current Limitations

The current local MVP demonstrates tamper-evident evidence verification using:

- JSON Schema validation
- RFC 8785 JSON Canonicalization Scheme
- SHA-256 hashing
- deterministic verification scripts
- local ECDSA P-256 signature verification
- sidecar metadata signing and verification
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
| Local authenticity demo | Local ECDSA P-256 signatures | AWS KMS asymmetric signing |
| Sidecar metadata authenticity | Local ECDSA P-256 metadata signature | KMS-backed metadata signature |
| Non-repudiation support | Limited | KMS signing, IAM controls, and CloudTrail |
| Trusted expected hash | Signed sidecar metadata in current PoC | Signed digest and controlled metadata storage |
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
- sidecar metadata signature verification prototype
- local JSON object storage prototype
- S3-compatible JSON object storage prototype
- local and S3 sidecar storage E2E tests
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
│   ├── adr/
│   │   ├── 0001-digest-metadata-storage.md
│   │   └── 0002-s3-json-object-store.md
│   ├── phase-2-aws/
│   │   ├── acceptance-criteria.md
│   │   ├── design.md
│   │   ├── non-goals.md
│   │   ├── requirements.md
│   │   └── tasks.md
│   └── framework-selection.md
├── lib/
│   ├── audit.js
│   ├── json-object-store.js
│   ├── metadata-signing-payload.js
│   ├── s3-json-object-store.js
│   ├── schema-validation.js
│   ├── sidecar-metadata-schema.js
│   ├── sidecar-metadata-signature.js
│   ├── sidecar-verification.js
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
│   ├── json-object-store.test.js
│   ├── local-sidecar-e2e.test.js
│   ├── metadata-signing-payload.test.js
│   ├── s3-json-object-store.test.js
│   ├── s3-sidecar-e2e.test.js
│   ├── schema-validation.test.js
│   ├── sidecar-metadata-schema.test.js
│   ├── sidecar-metadata-signature.test.js
│   ├── sidecar-verification.test.js
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

Phase 2 AWS-backed MVP planning and design:

- [Phase 2 Requirements](docs/phase-2-aws/requirements.md)
- [Phase 2 Design](docs/phase-2-aws/design.md)
- [Phase 2 Tasks](docs/phase-2-aws/tasks.md)
- [Phase 2 Acceptance Criteria](docs/phase-2-aws/acceptance-criteria.md)
- [Phase 2 Non-Goals](docs/phase-2-aws/non-goals.md)

Architecture Decision Records:

- [ADR 0001: Digest Metadata Storage](docs/adr/0001-digest-metadata-storage.md)
- [ADR 0002: S3 JSON Object Store](docs/adr/0002-s3-json-object-store.md)

---

## Phase 2 Implementation Status

Current Phase 2 implementation includes:

- v1 sidecar metadata schema validation
- canonical sidecar metadata signing payload generation
- ECDSA P-256 sidecar metadata signing and verification
- full evidence + sidecar metadata verification
- local JSON object storage through `LocalJsonObjectStore`
- S3-compatible JSON object storage through `S3JsonObjectStore`
- local sidecar storage E2E tests
- S3 sidecar storage E2E tests using an in-memory fake S3 client

The default test suite does not require AWS credentials or real S3 buckets.

```bash
npm test
```

Current status:

```text
79 tests passing
```

Production hardening still pending:

- real AWS S3 integration tests
- S3 Versioning
- S3 Object Lock
- SSE-S3 or SSE-KMS
- AWS KMS-backed signing
- IAM least-privilege examples
- lifecycle and retention policy documentation

---

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
- RFC 8785 JCS-compatible canonicalization stability
- Local ECDSA P-256 signing and verification
- Sidecar metadata schema validation
- Canonical sidecar metadata signing payload generation
- Sidecar metadata signature generation and verification
- Full evidence + sidecar metadata verification
- Local JSON object storage
- S3-compatible JSON object storage
- Local sidecar storage E2E flows
- S3 sidecar storage E2E flows using an in-memory fake S3 client
- Tampered evidence detection
- Tampered metadata detection
- Missing object handling

Current expected result:

```text
79 tests passing
```

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

This PoC demonstrates a layered validation approach:

1. **Schema-level validation**
   - Ensures that required fields exist
   - Restricts unexpected properties
   - Validates date-time formats and enum values

2. **Cryptographic integrity verification**
   - Uses SHA-256 to detect changes to the evidence payload
   - Produces deterministic hashes from RFC 8785 JCS-compatible canonical JSON

3. **Signature verification**
   - Uses local ECDSA P-256 signatures for demonstration
   - Shows how authenticity checks can be added beyond raw hash comparison

4. **Sidecar metadata verification**
   - Stores digest and verification metadata separately from evidence content
   - Verifies metadata signatures and evidence digest consistency after loading

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
- Production-grade immutable storage by default
- Blockchain anchoring by default
- A deployed production AWS environment

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
- Sidecar metadata schema validation
- Canonical sidecar metadata signing payload generation
- Sidecar metadata signing and verification
- Evidence + sidecar metadata verification
- Local JSON object storage
- S3-compatible JSON object storage
- Local and S3 sidecar storage E2E tests
- Automated tests
- GitHub Actions CI
- Verification runbook
- Threat model and attack scenarios
- AWS-oriented production design documents

### Phase 2: AWS-backed authenticity and immutability

Phase 2 currently includes local and S3-compatible sidecar metadata storage and verification prototypes.

Implemented Phase 2 capabilities:

- Sidecar metadata validation
- Signed sidecar metadata verification
- Evidence + metadata verification
- Local JSON object storage
- S3-compatible JSON object storage
- In-memory fake S3 client testing
- Local and S3 sidecar E2E tests

Potential future production hardening includes:

- Real AWS S3 integration tests
- AWS KMS asymmetric signing implementation
- S3 Object Lock based immutable evidence storage
- S3 Versioning
- SSE-S3 or SSE-KMS encryption
- DynamoDB metadata persistence for digest, signature, sequence, and verification state
- CloudTrail and CloudWatch based operational auditability
- IAM least-privilege execution roles
- Key rotation and verification policy documentation
- Lifecycle and retention policy documentation

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

## Cost Guardrail (AWS Budget Alert)

This project uses AWS KMS and related services in later phases, which incur real AWS costs.
To prevent unexpected charges, an AWS Budgets alert is configured via Terraform in the `terraform/` directory.

### What it does

- Sets a monthly cost budget (default: $20 USD) on the AWS account
- Sends SNS email notifications at 50%, 80%, 100% actual spend, and 100% forecasted spend
- Uses an SNS topic with an email subscription as the alert delivery mechanism

### Files

```text
terraform/
├── provider.tf               # AWS provider (ap-northeast-1, ken-sso profile)
├── budget_alert.tf           # AWS Budgets + SNS topic + subscription
├── terraform.tfvars.example  # Template — copy to terraform.tfvars and fill in values
└── terraform.tfvars          # Actual values (gitignored, never committed)
```

### Setup

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform/terraform.tfvars and set your alert_email
cd terraform
terraform init
terraform apply
```

> `terraform.tfvars`, `*.tfstate`, and `.terraform/` are excluded from git via `.gitignore`.
> The `alert_email` variable is marked `sensitive = true` in Terraform to prevent accidental log exposure.

---

## License

MIT

---

## JSON Canonicalization

This PoC uses RFC 8785 JSON Canonicalization Scheme, JCS, compatible canonicalization via the `canonicalize` package before calculating SHA-256 hashes.

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

---

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
