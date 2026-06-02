# Architecture

## Overview

This PoC records trust-related events as structured evidence and verifies them using cryptographic hashing.

The initial implementation focuses on local evidence generation and hash verification. Later phases will add AWS storage, DynamoDB metadata, S3 Object Lock, and external timestamping.

## Data Flow

1. A trust-related event occurs.
2. The event is represented as an evidence JSON document.
3. The evidence JSON is canonicalized.
4. A SHA-256 hash is calculated.
5. The evidence document is stored.
6. Metadata and hash are stored separately.
7. Verification recalculates the hash and compares it with the stored hash.

## Planned AWS Architecture

```text
User
  |
  v
Next.js Frontend
  |
  v
API Gateway
  |
  v
Lambda
  |
  +--> DynamoDB: metadata and evidence hash
  |
  +--> S3: evidence JSON with versioning and Object Lock
  |
  +--> Future: OpenTimestamps or blockchain anchoring
```

## Design Principles

- Store detailed data off-chain
- Hash evidence data for tamper detection
- Avoid storing personal data on-chain
- Keep AI as an assistant, not a final decision-maker
- Design for auditability and future interoperability

