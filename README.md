# Tanden Trust Audit PoC

[![Verify Evidence Integrity](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/verify.yml/badge.svg)](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/verify.yml)

A tamper-evident audit trail prototype for consent history, activity records, and trust events using JSON Schema validation and SHA-256 hash verification.

This project demonstrates how structured audit evidence can be validated, hashed, and verified in a reproducible way. It is designed as a technical proof of concept for audit trails, consent records, trust logs, AI-assisted governance, and Web3-compatible verification workflows.

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

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── verify.yml
├── docs/
│   └── framework-selection.md
├── lib/
│   └── schema-validation.js
├── samples/
│   └── evidence-consent.json
├── schemas/
│   └── evidence.schema.json
├── scripts/
│   ├── hash-evidence.js
│   ├── validate-evidence.js
│   └── verify-evidence.js
├── tests/
│   ├── audit.test.js
│   └── schema-validation.test.js
├── package.json
└── README.md
```

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

Expected result:

```text
Verification result: VALID
```

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

Potential future enhancements include:

- Add approval metadata
- Add role-based access control metadata
- Add retention policy metadata
- Add exception handling flags
- Add UUID-based evidence identifiers
- Add digital signatures
- Add AWS KMS integration
- Add Amazon S3 Object Lock support
- Add blockchain anchoring
- Add OpenAPI documentation
- Add architecture diagrams

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
