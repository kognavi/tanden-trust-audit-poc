# Audit Procedures

## Purpose

This document defines the assumed audit procedures that the Tanden Trust Audit PoC is designed to support.

This PoC is not a certified audit system. It is a design and implementation exercise to demonstrate how structured evidence records can support internal control review, audit inspection, and reproducible verification.

## Scope

The PoC focuses on evidence records for business events such as consent, activity records, approval, document acknowledgement, and related trust events.

The main objective is to show how a structured JSON evidence record can be validated, canonicalized, hashed, and re-verified in a repeatable way.

## Assumed Audit Procedures

| Procedure | Description | PoC Support |
|---|---|---|
| Walkthrough | Trace one business event from occurrence to evidence generation and verification. | Use evidence identifiers and future lifecycle identifiers such as `case_id` to connect related records. |
| Inspection | Review evidence data, metadata, configuration, and validation outputs. | Inspect JSON evidence, schema definitions, hash values, verification outputs, and CI results. |
| Reperformance | Independently re-run validation and hash verification. | Run validation, hashing, verification, and automated tests against sample evidence. |
| Reconciliation | Compare business-level records with system-level evidence. | Use event type, actor fields, timestamps, outcomes, and digest values to compare records. |
| Exception Review | Review rejected, failed, revoked, rollback, or tampered events. | Use negative test cases and future exception samples to confirm expected invalid or warning outcomes. |

## Walkthrough

A walkthrough should demonstrate that a business event can be followed across its lifecycle.

Example lifecycle:

1. A business event occurs.
2. An evidence JSON record is generated.
3. The evidence record is validated against JSON Schema.
4. The evidence record is canonicalized using RFC 8785 JCS-compatible canonicalization.
5. A SHA-256 digest is calculated.
6. The digest is verified later to detect tampering.
7. The validation and verification results are reviewed.

## Inspection

Inspection focuses on reviewing evidence and supporting artifacts.

Examples include:

- sample evidence JSON files
- JSON Schema files
- hash output
- verification output
- test results
- GitHub Actions workflow results
- design documents
- retention and security design notes

## Reperformance

Reperformance allows a reviewer to independently execute the same validation and verification process.

A reviewer should be able to run the following commands:

    npm test
    npm run validate:evidence
    npm run hash
    npm run verify

The expected result is that valid evidence passes schema validation and hash verification, while modified evidence fails verification.

## Reconciliation

Reconciliation compares business-level records with system-level evidence.

The PoC should support comparison using fields such as:

- evidence ID
- event type
- actor identifiers
- timestamps
- outcome status
- digest algorithm
- payload digest

Future schema versions may add lifecycle identifiers such as `case_id` to improve end-to-end reconciliation.

## Exception Review

Exception review focuses on abnormal or negative cases.

Examples include:

- modified evidence payload
- missing required fields
- invalid actor or role metadata
- rejected or revoked events
- rollback events
- invalid timestamp ordering
- missing retention metadata
- hash mismatch

## Current MVP Support

The current MVP supports:

- JSON Schema validation
- deterministic canonicalization
- SHA-256 hash calculation
- hash verification
- automated unit tests
- GitHub Actions-based validation

## Limitations

This PoC does not provide formal audit assurance.

The following areas are out of scope for the MVP:

- production-grade audit certification
- full J-SOX or SOC 2 compliance
- external trusted timestamping
- production AWS KMS signing implementation
- immutable storage deployment
- complete access log review workflow
- legal or regulatory opinion

## Future Enhancements

Future versions may add:

- control mapping
- lifecycle identifiers such as `case_id`
- exception event samples
- attack scenario tests
- timestamp model
- privacy and retention design
- AWS KMS signature metadata schema
- AWS KMS signature verification
- S3 Object Lock design
- CloudTrail-based operational audit trail
