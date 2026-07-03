# Security Design

> **Note:** This document has been superseded by [`docs/threat-model.md`](./threat-model.md),
> which provides the current, detailed threat model including assets, trust
> boundaries, threat actors, STRIDE mapping, and residual risks. This file is
> kept for historical reference only.

---

## Key Security Principles

- Do not store real personal information in this prototype
- Do not commit secrets, API keys, private keys, or credentials
- Store detailed evidence data off-chain
- Use hashes for tamper detection
- Avoid putting personal data or sensitive data on-chain
- Use least privilege access control in future AWS deployment

## Data Protection

In a production design:

- Evidence files should be encrypted at rest
- S3 buckets should block public access
- S3 Versioning should be enabled
- S3 Object Lock should be considered for tamper-resistant storage
- DynamoDB should store metadata and evidence hashes
- CloudTrail should be enabled for API activity logging
- KMS should be considered for encryption key management

## Hashing

This PoC uses SHA-256 to generate evidence hashes.

The hash is used to detect changes in the evidence document. If the evidence JSON changes, the recalculated hash will not match the stored hash.

## Privacy Considerations

This PoC must not store real KYC data or personal information.

In future production designs:

- Use pseudonymous subject identifiers
- Mask or hash IP addresses and user agents
- Separate personal data from evidence metadata
- Apply data retention policies
- Consider legal requirements such as Japan's APPI and GDPR when applicable
