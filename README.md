# Tanden Trust Audit PoC

Tanden Trust Audit PoC is a prototype system for recording consent history, activity records, and audit events in a tamper-evident way using AWS, AI, and Web3-compatible verification.

## Concept

This PoC explores how invisible trust events, such as consent, participation, contribution, and verification history, can be recorded as digital evidence.

Detailed data is stored off-chain on AWS. Evidence metadata is hashed and verified. Future extensions may include external timestamping, blockchain anchoring, and verifiable credentials.

## Why This PoC

In many organizations, important trust-related events are recorded in fragmented tools such as spreadsheets, forms, chat logs, and internal systems.

This PoC focuses on how those events can be:

- recorded as structured evidence
- protected against tampering
- verified later by hash comparison
- extended toward Web3-compatible verification

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

The first version focuses on the smallest useful audit trail flow:

- Create a consent or audit event
- Generate an evidence JSON file
- Calculate a SHA-256 hash
- Store the evidence file
- Store metadata
- Recalculate the hash for verification
- Display whether the evidence has been tampered with

## Repository Structure

```text
tanden-trust-audit-poc/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── audit-design.md
│   ├── threat-model.md
│   └── roadmap.md
├── frontend/
├── backend/
├── infra/
├── scripts/
└── samples/
```

## Current Status

This repository is currently in the design and Phase 1 prototype stage.

## Disclaimer

This is a technical prototype and not a production-ready compliance system.

It does not provide legal, financial, regulatory, or compliance advice.

Do not store real personal information, KYC documents, secrets, private keys, or production credentials in this repository.
