# Portfolio Summary

## Project Name

Tanden Trust Audit PoC

## Overview

Tanden Trust Audit PoC is a prototype system for recording consent history, activity records, and audit-related trust events in a tamper-evident way.

The project demonstrates how structured JSON evidence can be hashed, verified, and checked for tampering using SHA-256.

Future extensions include AWS-based evidence storage, AI-assisted audit review, and Web3-compatible verification through timestamping or blockchain anchoring.

## Problem

In many organizations, important trust-related events are recorded across fragmented tools such as:

- Spreadsheets
- Forms
- Chat logs
- Internal systems
- Manual approval records

This fragmentation makes it difficult to prove:

- Who gave consent
- When an event occurred
- Whether evidence was changed later
- Whether audit records are trustworthy

## Solution

This PoC records trust-related events as structured JSON evidence and generates a SHA-256 hash from canonicalized JSON data.

The generated hash acts as a digital fingerprint of the evidence.

If any field in the evidence file changes, the recalculated hash changes as well, allowing the system to detect tampering.

## Implemented Features

The current implementation includes:

- Sample consent evidence JSON
- Canonical JSON generation
- SHA-256 hash generation
- Evidence integrity verification
- Tamper detection demo
- npm scripts for repeatable execution
- Local verification result documentation
- GitHub Actions workflow for automated verification
- README status badge showing CI result

## Technical Stack

Current implementation:

- Node.js
- JavaScript
- SHA-256
- JSON
- npm scripts
- GitHub Actions

Planned AWS/Web3 architecture:

- Amazon S3 for evidence storage
- Amazon S3 Object Lock for immutability
- Amazon DynamoDB for evidence metadata
- AWS Lambda for hash generation and verification
- Amazon API Gateway for API access
- AWS KMS for encryption
- Amazon CloudTrail and CloudWatch for audit logging
- Amazon Bedrock for AI-assisted audit review
- OpenTimestamps or blockchain anchoring for external verification

## Verification Result

The following hash was generated from `samples/evidence-consent.json`:

```text
98b0a0065072fb968a2f414acea48833d640c42522a767aa7dd55c8282b52d10
```

Original evidence verification:

```text
Verification result: VALID
```

After changing:

```json
"status": "granted"
```

to:

```json
"status": "revoked"
```

The verification result became:

```text
Verification result: INVALID
```

After restoring the original value, the result returned to:

```text
Verification result: VALID
```

## Security Considerations

This PoC focuses on integrity verification.

Current security considerations include:

- Do not store real personal data in the repository
- Do not store secrets, credentials, private keys, or KYC documents
- Use synthetic sample data only
- Use hash comparison to detect evidence modification
- Keep evidence data and verification metadata separated in future architecture

Planned security improvements include:

- Server-side encryption with AWS KMS
- S3 Versioning
- S3 Object Lock
- IAM least privilege design
- CloudTrail logging
- Evidence metadata signing
- External timestamping
- Blockchain anchoring

## GitHub Actions CI

This repository includes a GitHub Actions workflow that automatically runs evidence verification on push and pull request events.

The workflow executes:

```bash
npm run hash
npm run verify
```

The README displays the current CI status using a GitHub Actions badge.

## What I Learned

Through this project, I practiced:

- Designing a tamper-evident audit trail
- Creating structured JSON evidence
- Implementing hash-based integrity verification
- Writing reusable Node.js scripts
- Documenting verification results
- Creating npm scripts for repeatable operations
- Setting up GitHub Actions for automated checks
- Connecting AWS, AI, and Web3 concepts into a practical PoC roadmap

## Interview Talking Points

I can explain:

- Why audit evidence should be structured
- How SHA-256 detects tampering
- Why canonical JSON is important for stable hashing
- How evidence can be stored off-chain while hashes can be anchored externally
- How AWS services such as S3, DynamoDB, Lambda, KMS, and CloudTrail can support an audit trail system
- How AI can assist audit review without replacing original verifiable evidence
- How GitHub Actions improves repeatability and reliability

## Future Enhancements

Next planned improvements:

- Add evidence generation script
- Add multiple evidence samples
- Add automated tamper detection test
- Implement API-based hash verification
- Design AWS infrastructure with IaC
- Add S3 and DynamoDB integration
- Add external timestamping or blockchain anchoring
- Add AI-assisted audit summarization
