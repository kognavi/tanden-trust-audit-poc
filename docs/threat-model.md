# Threat Model

## Scope

This document describes potential threats for the Tanden Trust Audit PoC.

The current scope is a prototype for tamper-evident audit trails using structured evidence files, cryptographic hashes, and future AWS-based storage.

## Assets

Important assets include:

- Evidence JSON documents
- Evidence hashes
- Audit metadata
- Timestamp records
- Access logs
- Future API endpoints
- Future AWS resources such as S3, DynamoDB, Lambda, and KMS keys

## Threat Actors

Potential threat actors include:

- External attackers
- Malicious insiders
- Compromised user accounts
- Misconfigured automation
- Accidental operators
- Future compromised API clients

## Key Threats

### 1. Evidence Tampering

An attacker may modify an evidence JSON document after it has been recorded.

Mitigations:

- Calculate SHA-256 hashes
- Store hashes separately from evidence data
- Use S3 Versioning
- Consider S3 Object Lock
- Record verification results

### 2. Metadata Manipulation

An attacker may modify audit metadata, such as timestamps, subject IDs, or event types.

Mitigations:

- Store immutable event records where possible
- Use append-only design
- Log metadata changes
- Use DynamoDB conditional writes in future implementation

### 3. Credential Leakage

Secrets, API keys, or private keys may be accidentally committed to the repository.

Mitigations:

- Use `.gitignore`
- Never commit `.env` files
- Use GitHub secret scanning
- Use AWS IAM roles instead of long-lived access keys
- Rotate credentials if exposure is suspected

### 4. Unauthorized Access

Users or systems may access evidence data without proper authorization.

Mitigations:

- Apply least privilege access
- Use IAM policies with narrow permissions
- Enable S3 Block Public Access
- Log access using CloudTrail
- Consider encryption with KMS

### 5. Privacy Leakage

Personal or sensitive data may be exposed through evidence documents, metadata, logs, or future blockchain anchoring.

Mitigations:

- Do not store personal data on-chain
- Use pseudonymous identifiers
- Minimize stored data
- Separate personal data from verification metadata
- Apply retention policies

### 6. AI Misinterpretation

AI-generated analysis may misinterpret evidence or produce unreliable conclusions.

Mitigations:

- Keep AI output separate from source evidence
- Store references to original evidence
- Require human review for important decisions
- Log AI prompts, model versions, and outputs where appropriate

## Future Security Enhancements

- S3 Object Lock
- AWS KMS encryption
- IAM Access Analyzer
- CloudTrail and CloudWatch monitoring
- DynamoDB Streams for audit event tracking
- External timestamping
- Blockchain hash anchoring
- Verifiable Credentials
- Zero-knowledge proof based selective disclosure

## Non-Goals

This PoC does not aim to:

- Store real personal information
- Provide production-grade identity verification
- Store sensitive data on a public blockchain
- Replace legal contracts or regulatory audits
- Make fully automated decisions using AI
