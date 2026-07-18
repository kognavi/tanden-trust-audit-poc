# Portfolio Summary

## Project Name

Tanden Trust Audit PoC

## Overview

Tanden Trust Audit PoC is a prototype system for recording trust-related evidence, such as consent history, activity records, and audit events, in a tamper-evident way.

The project demonstrates how structured JSON evidence can be validated, canonicalized, hashed, verified, tested, and documented as part of an audit-oriented evidence management workflow.

The current implementation is a local MVP, while the design documents describe how the system could evolve into a production-grade AWS-based evidence platform.

## Problem Statement

In many organizations, important trust-related events are recorded across fragmented tools such as:

- spreadsheets
- application logs
- SaaS audit logs
- manual approval records
- exported CSV files
- screenshots
- internal workflow tools

These records are often difficult to verify later because reviewers may not know:

- whether the evidence was modified
- whether the evidence came from a trusted source
- whether the expected hash or metadata was replaced
- whether the event was replayed
- whether the storage layer is immutable
- whether privileged insiders could bypass controls
- whether audit procedures are reproducible

This PoC explores how to make evidence more verifiable, reproducible, and explainable.

## What This PoC Demonstrates

This project demonstrates a practical evidence verification workflow:

1. Define structured evidence as JSON.
2. Validate evidence with JSON Schema.
3. Canonicalize JSON deterministically.
4. Generate a SHA-256 digest.
5. Verify evidence against an expected digest.
6. Test valid and invalid evidence cases.
7. Document audit procedures.
8. Map controls to evidence and verification steps.
9. Model threats and attack scenarios.
10. Design a production-oriented AWS architecture.
11. Extend the trust model with AWS KMS asymmetric signing, implemented via `AwsKmsProvider` and verified against a fake KMS client.
12. Record signing events in a PostgreSQL-backed hash-chained ledger via `PgSigningLogger` for signer accountability.

## Implemented Features

The current MVP includes:

- sample evidence record
- JSON Schema for evidence validation
- validation script
- SHA-256 hash generation script
- verification script
- deterministic JSON canonicalization using RFC 8785 JCS
- automated tests using Node.js test runner
- positive tests for valid evidence
- negative tests for tampered evidence, wrong hashes, schema violations, and invalid fields
- reproducible command-line verification workflow

Phase 2 additions now implemented:

- sidecar metadata schema validation and canonical signing payload generation
- ECDSA P-256 sidecar metadata signing and verification
- AWS KMS-backed asymmetric signing (`AwsKmsProvider`), verified against a fake KMS client
- PostgreSQL-backed hash-chained signing event ledger (`PgSigningLogger`), verified against an in-memory fake `pg.Pool`
- local and S3-compatible JSON object storage for evidence and metadata
- Terraform-managed AWS Budgets cost guardrail alert
- 113 automated tests passing

## Core Technical Concepts

| Concept | Purpose |
|---|---|
| JSON Schema | Ensures evidence follows an expected structure. |
| RFC 8785 JCS | Produces deterministic canonical JSON for stable hashing. |
| SHA-256 | Creates a digest used for tamper-evident verification. |
| Hash verification | Detects whether evidence content changed. |
| Automated tests | Prove that normal and tampered cases behave as expected. |
| Audit procedures | Allow reviewers to reproduce verification steps. |
| Threat modeling | Identifies realistic risks and required controls. |
| AWS KMS signing design | Adds authenticity and stronger non-repudiation support. |

## Security and Audit Design

The project includes design documents covering:

- framework selection
- audit procedures
- control mapping
- evidence lifecycle
- threat model
- AWS reference architecture
- KMS signing design
- attack scenarios

Together, these documents show how a simple local verification workflow can be extended into a broader security and audit architecture.

## AWS Production Architecture Design

The AWS reference architecture describes a possible production design using:

- Amazon API Gateway for ingestion APIs
- AWS Lambda for validation, hashing, and orchestration
- Amazon S3 with Object Lock for immutable evidence storage
- Amazon DynamoDB for evidence metadata
- AWS KMS for asymmetric signing and key protection (asymmetric signing implemented via `AwsKmsProvider`; key rotation/protection policy remains a design item)
- AWS CloudTrail for audit logging
- Amazon CloudWatch for monitoring and alarms
- Amazon EventBridge for event-driven workflows
- IAM least privilege policies
- separation of duties for key administration and signing

The design is aligned with the AWS Well-Architected Framework pillars:

- Operational Excellence
- Security
- Reliability
- Performance Efficiency
- Cost Optimization
- Sustainability

## KMS Signing and Ledger Value

Hash verification can detect whether evidence content has changed.

However, a hash alone does not prove who generated or approved the digest.

The implemented KMS signing and signing event ledger design addresses this limitation.

The verified workflow (tested against a fake KMS client and an in-memory fake `pg.Pool`):

1. validate the evidence
2. canonicalize the evidence
3. calculate a SHA-256 digest
4. sign the digest using AWS KMS via `AwsKmsProvider`
5. record the signing event in a PostgreSQL-backed hash-chained ledger via `PgSigningLogger`
6. store evidence, metadata, digest, signature, key ID, and algorithm
7. verify the signature and ledger integrity during audit review

This adds stronger support for:

- evidence authenticity
- signer accountability
- hash-chained tamper-evident signing event history
- least privilege signing workflows
- CloudTrail-based auditability (design)
- separation of duties
- long-term verification

Remaining production hardening: real AWS KMS/PostgreSQL integration tests, KMS error classification helpers, and PostgreSQL `cause` parity (tracked in issue #71).

## Attack Scenario Coverage

The project documents practical attack scenarios such as:

- evidence tampering
- expected hash substitution
- replay attack
- unauthorized producer
- schema bypass
- timestamp manipulation
- S3 deletion or overwrite attempt
- KMS key misuse
- KMS key deletion or disablement
- insider admin risk
- CI/CD compromise
- dependency compromise

Each scenario is mapped to preventive, detective, and recovery controls.

## Skills Demonstrated

This project demonstrates skills in:

### Software Engineering

- Node.js scripting
- JSON Schema validation
- deterministic data processing
- automated testing
- command-line tooling
- Git and GitHub workflow
- pull request based development

### Security Engineering

- tamper-evident evidence design
- hashing and canonicalization
- digital signature design
- threat modeling
- attack scenario analysis
- least privilege design
- audit logging strategy
- insider risk consideration

### AWS Architecture

- serverless architecture design
- S3 immutability design
- DynamoDB metadata modeling
- KMS asymmetric signing design
- CloudTrail auditability
- IAM role separation
- Well-Architected Framework alignment

### Audit and Compliance Thinking

- reproducible verification procedures
- control mapping
- evidence lifecycle modeling
- reviewer-oriented documentation
- production limitations and assumptions
- separation between conceptual design and compliance certification

## Why This Matters

Many audit and compliance workflows still depend on fragile evidence handling.

This project shows how cloud-native architecture and cryptographic verification can make evidence more trustworthy.

The value is not only in generating a hash, but in designing the surrounding process:

- who can create evidence
- who can sign evidence
- where evidence is stored
- how reviewers verify it
- how tampering is detected
- how metadata is protected
- how actions are logged
- how privileged access is controlled

This reflects the mindset needed for real-world security, audit, and cloud architecture work.

## Interview Talking Points

A concise explanation of this project:

> I built a tamper-evident audit evidence PoC using JSON Schema validation, RFC 8785 JSON canonicalization, SHA-256 hashing, and automated verification tests.
>
> I also documented how the local MVP could evolve into a production AWS architecture using API Gateway, Lambda, S3 Object Lock, DynamoDB, KMS asymmetric signing, IAM least privilege, CloudTrail, CloudWatch, and EventBridge.
>
> The project includes audit procedures, control mapping, evidence lifecycle design, threat modeling, KMS signing design, and attack scenarios. The goal is to show not only implementation ability, but also security architecture, auditability, and production design thinking.

## Repository Structure Highlights

Important files and directories:

```text
samples/
  evidence-consent.json

schemas/
  evidence.schema.json

scripts/
  validate-evidence.js
  hash-evidence.js
  verify-evidence.js

tests/
  *.test.js

docs/
  framework-selection.md
  audit-procedures.md
  control-mapping.md
  evidence-lifecycle.md
  threat-model.md
  aws-reference-architecture.md
  kms-signing-design.md
  attack-scenarios.md
  portfolio-summary.md
```

## Verification Commands

Typical verification commands:

```bash
npm test
npm run validate:evidence
npm run hash
npm run verify
```

Expected results include:

- all automated tests pass
- evidence schema validation returns `VALID`
- generated hash is stable
- verification result returns `VALID`

## Current Status

The project currently includes:

- working local MVP
- automated tests
- reproducible verification workflow
- security and audit documentation
- AWS production reference design
- AWS KMS-backed signing implementation (`AwsKmsProvider`)
- PostgreSQL-backed signing event ledger implementation (`PgSigningLogger`)
- 113 automated tests passing
- attack scenario analysis
- portfolio-oriented summary

## Future Roadmap

Possible future improvements include:

1. Add a verification runbook.
2. Add architecture diagrams.
3. Extend AWS CDK or Terraform infrastructure design (Terraform-managed AWS Budgets guardrail already implemented).
4. Add DynamoDB metadata schema examples.
5. Add S3 Object Lock configuration examples.
6. Add real AWS KMS and PostgreSQL integration tests (current tests use fake/in-memory clients).
7. Add KMS error classification helpers and PostgreSQL `cause` parity (#71).
8. Add API Gateway and Lambda ingestion prototype.
9. Explore optional blockchain anchoring or timestamping.

## Limitations

This project is a prototype and portfolio artifact.

It does not represent:

- a production deployment
- a formal security certification
- a legal compliance opinion
- a completed audit system
- a cryptographic review
- a penetration test
- a managed service offering

Before production use, the design should be reviewed by qualified security engineers, AWS architects, compliance professionals, auditors, and legal professionals.
