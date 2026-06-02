# Audit Design

## Purpose

This document describes the audit trail design for the Tanden Trust Audit PoC.

The goal is to make trust-related events easier to verify by recording structured evidence, calculating cryptographic hashes, and keeping metadata separate from detailed evidence data.

## Audit Event Types

This PoC may handle the following event types:

- consent granted
- consent revoked
- activity recorded
- contribution recorded
- verification performed
- evidence updated
- evidence archived

## Evidence Structure

Each audit event should be represented as a structured JSON document.

Example fields:

- evidenceId
- eventType
- subjectId
- actorId
- occurredAt
- sourceSystem
- purpose
- consentStatus
- metadata
- evidenceHash

## Hash-Based Verification

The evidence document is hashed using SHA-256.

Verification flow:

1. Load the evidence JSON.
2. Canonicalize the JSON representation.
3. Calculate the SHA-256 hash.
4. Compare the calculated hash with the stored hash.
5. If the hashes match, the evidence has not been modified.
6. If the hashes do not match, the evidence may have been changed.

## Off-Chain and On-Chain Boundary

Detailed evidence data should be stored off-chain.

Only minimal metadata or hash anchors should be considered for blockchain or external timestamping systems.

This design avoids exposing personal information or sensitive business data on public networks.

## Auditability Principles

- Events should be append-only where possible
- Evidence should be timestamped
- Original records should not be silently overwritten
- Hashes should be reproducible
- Access to evidence should be logged
- AI-generated analysis should be traceable to source evidence

## Future Extensions

Possible future improvements:

- AWS S3 Object Lock for write-once-read-many storage
- DynamoDB Streams for audit event processing
- CloudTrail integration
- OpenTimestamps integration
- Blockchain anchoring
- Verifiable Credentials support
- Zero-knowledge proof based selective disclosure
