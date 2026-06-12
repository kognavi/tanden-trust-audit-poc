# Framework Selection

## Purpose

This PoC is not a certified compliance solution and does not claim formal J-SOX, SOC 2, ISO 27001, or regulatory compliance.

The purpose of this PoC is to explore how audit trail records for consent history, KYC status changes, and document acknowledgement can be structured and verified from an IT audit and internal control perspective.

In particular, this PoC distinguishes between:

- cryptographic integrity of evidence records
- audit validity of business processes

Hash values and digital signatures can help prove that an evidence record has not been tampered with after creation.

However, audit evidence also requires linkage to business workflow, approval records, segregation of duties, authorization, retention policy, exception handling, and later review by an auditor or internal control reviewer.

## Primary References

This PoC primarily refers to the following Japanese IT audit and internal control references:

- METI System Management Standards
- METI System Audit Standards
- METI System Management Standards Supplement: IT Control Guidance for Financial Reporting

These references are used to structure the PoC around IT governance, access control, change management, operational control, audit evidence, and internal control over IT-dependent business processes.

## Secondary References

This PoC also refers to SOC 2 Trust Services Criteria as a supplementary framework, especially for cloud and SaaS-oriented control perspectives.

Relevant SOC 2 categories include:

- Security
- Processing Integrity
- Confidentiality

## Additional References

The following frameworks are treated as additional references:

- J-SOX / Internal Control over Financial Reporting
- COSO Internal Control Framework
- ISO/IEC 27001 / 27002
- COBIT

## Scope

This PoC focuses on:

- evidence record structure
- linkage between business process and system event
- schema validation
- hash-based integrity verification
- representation of approval and authorization context
- segregation of duties checks
- retention policy representation
- exception event handling
- audit procedure simulation

## Out of Scope

The following are outside the scope of this PoC:

- formal compliance certification
- legal opinion
- production-grade audit assurance
- full J-SOX compliance
- full SOC 2 readiness
- complete ISO 27001 implementation
- production-level key management
- production-level privacy impact assessment

## Design Principle

This PoC treats cryptographic integrity as necessary but not sufficient for audit evidence.

A hash value can show that a record has not changed.

It does not, by itself, prove that the underlying business operation was properly requested, approved, authorized, executed, and retained.

Therefore, the PoC aims to connect individual evidence records into a process-level audit trail using shared identifiers, approval context, authorization context, timestamps, retention metadata, and validation results.

## Important Limitation

This document is intended for PoC design purposes only.

It does not provide legal advice, audit opinion, compliance certification, or assurance that the described design will satisfy any specific regulatory, audit, or contractual requirement.

Actual audit and compliance requirements should be confirmed with qualified auditors, legal counsel, compliance officers, and relevant stakeholders.
