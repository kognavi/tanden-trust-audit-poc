# Tanden Trust Audit PoC

![Verify Evidence Integrity](https://github.com/kognavi/tanden-trust-audit-poc/actions/workflows/verify.yml/badge.svg)


Tanden Trust Audit PoC is a prototype system for recording consent history, activity records, and audit events in a tamper-evident way using AWS, AI, and Web3-compatible verification.

## Concept

This PoC explores how invisible trust events, such as consent, participation, contribution, and verification history, can be recorded as digital evidence.

Detailed evidence data is stored off-chain. Evidence data is hashed and verified. Future extensions may include AWS-based storage, external timestamping, blockchain anchoring, and verifiable credentials.

## Why This PoC

In many organizations, important trust-related events are recorded in fragmented tools such as spreadsheets, forms, chat logs, and internal systems.

This PoC focuses on how those events can be:

- Recorded as structured evidence
- Protected against tampering
- Verified later by hash comparison
- Extended toward Web3-compatible verification

- ## Portfolio Summary

See [docs/portfolio-summary.md](docs/portfolio-summary.md) for a concise overview of the project, implementation details, verification results, and interview talking points.


## Use Cases

- Consent history tracking
- KYC verification event logging
- Activity record proof
- Certificate issuance history
- Audit trail for Web3/RWA services
- Community and learning activity proof

## Architecture Overview

Planned initial architecture:

- Frontend: Next.js
- API: Amazon API Gateway + AWS Lambda
- Database: Amazon DynamoDB
- Evidence Storage: Amazon S3 with Object Lock
- Hashing: SHA-256
- AI: Amazon Bedrock, planned
- External Verification: OpenTimestamps or blockchain anchoring, planned
- Auth: Amazon Cognito, planned

## Phase 1 MVP

Implemented:

- Create a sample evidence JSON file
- Calculate a SHA-256 hash
- Verify evidence integrity by hash comparison
- Demonstrate tamper detection from the command line

Planned:

- Store evidence files in Amazon S3
- Store metadata in Amazon DynamoDB
- Display verification results in a web UI
- Add API-based registration and verification flow

## Repository Structure

Current structure:

```text
tanden-trust-audit-poc/
├── README.md
├── LICENSE
├── .gitignore
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── audit-design.md
│   ├── threat-model.md
│   └── roadmap.md
├── scripts/
│   ├── hash-evidence.js
│   └── verify-evidence.js
└── samples/
    └── evidence-consent.json
```

Planned future structure:

```text
frontend/
backend/
infra/
```

## Current Status

This repository is currently in the design and Phase 1 prototype stage.

The current implementation supports local SHA-256 hash generation and verification for structured JSON evidence.

## Disclaimer

This is a technical prototype and not a production-ready compliance system.

It does not provide legal, financial, regulatory, or compliance advice.

Do not store real personal information, KYC documents, secrets, private keys, or production credentials in this repository.

## Requirements

This project uses Node.js to generate and verify SHA-256 hashes for audit evidence files.

Recommended environment:

- Node.js 20 or later
- Git
- macOS, Linux, or Windows

Check your Node.js version:

```bash
node -v
```

Example:

```text
v20.20.2
```

## Usage

### 1. Clone the repository

```bash
git clone https://github.com/kognavi/tanden-trust-audit-poc.git
cd tanden-trust-audit-poc
```

### 2. Generate a SHA-256 hash from evidence

Run the following command:

```bash
node scripts/hash-evidence.js samples/evidence-consent.json
```

Example output:

```text
Evidence file: samples/evidence-consent.json
Canonical JSON: {"actorId":"actor-demo-001","consent":{"scope":["activity_recording","audit_verification"],"status":"granted","version":"v1.0"},"eventType":"CONSENT_GRANTED","evidenceId":"evd-2026-000001","hashAlgorithm":"SHA-256","metadata":{"containsPersonalData":false,"environment":"demo","notes":"This is synthetic sample data for demonstration only."},"occurredAt":"2026-06-02T03:00:00Z","purpose":"Demonstrate tamper-evident consent evidence for a prototype audit trail.","schemaVersion":"1.0.0","sourceSystem":"tanden-trust-audit-poc","subjectId":"subject-demo-001"}
SHA-256 hash: ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
```

### 3. Verify evidence integrity

Use the generated hash as the expected hash:

```bash
node scripts/verify-evidence.js samples/evidence-consent.json ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
```

Expected output:

```text
Evidence file: samples/evidence-consent.json
Expected hash: ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
Calculated hash: ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
Verification result: VALID
```

If the result is `VALID`, the evidence file matches the expected hash.

## Tamper Detection Demo

This project demonstrates tamper detection by changing one field in the evidence JSON.

### 1. Modify the evidence file

For example, change the consent status from:

```json
"status": "granted"
```

to:

```json
"status": "revoked"
```

On macOS or Linux, you can run:

```bash
perl -pi -e 's/"status": "granted"/"status": "revoked"/' samples/evidence-consent.json
```

### 2. Verify again with the original hash

```bash
node scripts/verify-evidence.js samples/evidence-consent.json ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
```

Expected output:

```text
Evidence file: samples/evidence-consent.json
Expected hash: ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
Calculated hash: 209f5c412879a5cdb1db9e9f939b39eb056afcd62f158c6305b6788429a47158
Verification result: INVALID
```

If the result is `INVALID`, the evidence file has been changed and no longer matches the original hash.

### 3. Restore the evidence file

```bash
perl -pi -e 's/"status": "revoked"/"status": "granted"/' samples/evidence-consent.json
```

Verify again:

```bash
node scripts/verify-evidence.js samples/evidence-consent.json ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
```

Expected output:

```text
Verification result: VALID
```

## How It Works

The core process is:

1. Read the evidence JSON file
2. Parse the JSON data
3. Canonicalize the JSON by sorting object keys
4. Convert the canonical JSON into a stable string
5. Generate a SHA-256 hash
6. Compare the calculated hash with the expected hash

This allows the system to detect even small changes in the evidence file.

## Current Verification Result

The following hash was generated from `samples/evidence-consent.json`:

```text
ea1e30d81b674069d1663be70397ed3884d038381b310748d9ff88661916ea6c
```

Verification result:

```text
VALID
```

After changing `"status": "granted"` to `"status": "revoked"`, the verification result became:

```text
INVALID
```

This confirms that the PoC can detect tampering in structured audit evidence.

## Future Enhancements

Planned future improvements include:

- Store evidence files in Amazon S3
- Store hashes and metadata in Amazon DynamoDB
- Use AWS Lambda for hash generation and verification
- Encrypt sensitive data with AWS KMS
- Enable S3 Versioning and Object Lock
- Record audit events with CloudTrail and CloudWatch
- Anchor hashes to a blockchain or timestamping service
- Add AI-assisted audit review while keeping original evidence verifiable
