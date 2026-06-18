# Control Mapping

## Purpose

This document maps assumed control objectives to evidence fields, verification activities, and future implementation considerations for the Tanden Trust Audit PoC.

The purpose is to make the relationship between business controls and technical evidence explicit.

This PoC does not provide formal audit assurance. The mappings below are intended for design, demonstration, and portfolio purposes.

## Scope

The control mapping focuses on tamper-evident evidence records used for consent, activity recording, approval, document acknowledgement, and related trust events.

The current MVP supports JSON Schema validation, deterministic canonicalization, SHA-256 hash generation, hash verification, and automated tests.

## Control Mapping Table

| Control Area | Control Objective | Evidence Fields | Current Verification | Future Enhancement |
|---|---|---|---|---|
| Consent Management | Confirm that consent was granted before processing or recording relevant activity. | `eventType`, `subjectId`, `actorId`, `consent.status`, `consent.scope`, `occurredAt` | Validate evidence schema and inspect sample consent evidence. | Add lifecycle identifiers such as `case_id` and consent revocation samples. |
| Evidence Integrity | Detect unauthorized modification of evidence records. | Full canonicalized JSON payload, `hashAlgorithm`, calculated digest | Recalculate SHA-256 hash and compare it with the expected digest. | Add AWS KMS signing and signature verification metadata. |
| Schema Compliance | Ensure evidence records follow the expected structure and required fields. | `schemaVersion`, required top-level fields, nested consent fields | Run JSON Schema validation against sample evidence. | Add schema version migration policy and compatibility tests. |
| Audit Reperformance | Enable a reviewer to independently reproduce validation and verification. | Sample evidence files, schema files, scripts, package scripts | Run `npm test`, `npm run validate:evidence`, `npm run hash`, and `npm run verify`. | Add reproducible verification reports and signed verification results. |
| Event Traceability | Support tracing a business event from occurrence to evidence verification. | `evidenceId`, `eventType`, `subjectId`, `actorId`, `occurredAt`, `sourceSystem` | Inspect evidence identifiers and event metadata. | Add `case_id`, correlation IDs, and event lifecycle state transitions. |
| Exception Review | Identify invalid, rejected, revoked, rollback, or tampered evidence scenarios. | Invalid fields, modified payloads, failed validation output, hash mismatch | Use negative tests for schema violations and tampered evidence. | Add dedicated exception evidence samples and attack scenario tests. |
| Access Accountability | Show who or what generated or acted on the evidence. | `actorId`, `sourceSystem`, future role or service identity metadata | Inspect actor and source system fields. | Add IAM principal metadata, CloudTrail references, and service role identifiers. |
| Data Minimization | Limit sensitive or personal data contained in evidence records. | `metadata.containsPersonalData`, subject identifiers, purpose field | Inspect sample evidence and metadata flags. | Add privacy classification, retention metadata, and redaction policy. |
| Retention and Immutability | Preserve evidence records for the required period and protect them from deletion or overwrite. | Future retention metadata, evidence timestamp, digest value | Documented as a current limitation. | Add S3 Object Lock, retention policy, legal hold design, and lifecycle rules. |
| Operational Monitoring | Detect abnormal verification failures or operational issues. | Verification result, validation output, CI results | Use automated tests and GitHub Actions checks. | Add CloudWatch metrics, alarms, dashboards, and incident response workflow. |

## Verification Activities

The following activities currently support the control mapping:

- JSON Schema validation
- deterministic RFC 8785 JCS-compatible canonicalization
- SHA-256 digest calculation
- hash verification
- automated unit tests
- GitHub Actions-based verification

## Example Review Flow

A reviewer can perform the following flow:

1. Select a sample evidence record.
2. Validate the evidence record against the JSON Schema.
3. Canonicalize the evidence record.
4. Calculate the SHA-256 digest.
5. Compare the calculated digest with the expected digest.
6. Inspect event metadata such as evidence ID, actor ID, subject ID, event type, and timestamp.
7. Review whether the evidence supports the relevant control objective.

## Current MVP Coverage

The current MVP provides strong coverage for:

- schema compliance
- deterministic hashing
- tamper detection
- basic audit reperformance
- simple event traceability

The current MVP provides partial or future coverage for:

- external trusted timestamping
- AWS KMS signing
- immutable storage
- retention enforcement
- detailed access accountability
- privacy classification
- full exception lifecycle handling
- production-grade operational monitoring

## Limitations

This mapping is conceptual and implementation-oriented.

It does not represent a formal audit opinion, certification, compliance attestation, or legal conclusion.

The mappings should be validated by qualified audit, compliance, security, and legal professionals before production use.

## Future Enhancements

Future versions may add:

- detailed J-SOX or SOC 2 style control references
- evidence lifecycle model
- `case_id` and correlation ID fields
- exception event samples
- attack scenario tests
- AWS KMS signature verification
- S3 Object Lock retention model
- CloudTrail-based access accountability
- privacy and retention classification
- automated control coverage report
