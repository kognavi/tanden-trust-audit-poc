# AWS Architecture for Evidence Integrity Verification

## 1. Overview

This document describes a possible AWS-based architecture for extending the current local evidence integrity verification PoC.

The current PoC verifies the integrity of an evidence JSON file by generating a canonical SHA-256 hash and comparing it with an expected hash. The AWS-based architecture extends this concept into a serverless, auditable, and tamper-resistant verification workflow.

## 2. Goals

The goals of the AWS architecture are:

- Store evidence records securely
- Verify evidence integrity on demand
- Preserve expected hashes and metadata
- Provide audit logs for verification activities
- Improve tamper resistance using AWS managed services
- Provide a future path toward external timestamping or blockchain anchoring

## 3. High-Level Architecture

The proposed architecture uses the following AWS services:

- Amazon API Gateway
- AWS Lambda
- Amazon S3
- Amazon S3 Object Lock
- Amazon DynamoDB
- AWS Key Management Service
- AWS CloudTrail
- Amazon CloudWatch
- Optional external timestamping or blockchain anchoring service

## 4. Architecture Diagram

```text
Client / Auditor
      |
      v
Amazon API Gateway
      |
      v
AWS Lambda
      |
      +----------------------------+
      |                            |
      v                            v
Amazon S3                    Amazon DynamoDB
Evidence Storage             Metadata / Expected Hash
      |                            |
      v                            v
S3 Object Lock                Hash Lookup
      |
      v
KMS Encryption

Monitoring / Audit:
CloudTrail + CloudWatch Logs

Optional:
External Timestamping / Blockchain Anchoring
```

## 5. Verification Flow

A typical verification flow is as follows:

1. A client or auditor sends a verification request to Amazon API Gateway.
2. API Gateway invokes an AWS Lambda function.
3. The Lambda function retrieves the target evidence file from Amazon S3.
4. The Lambda function canonicalizes the evidence JSON.
5. The Lambda function calculates a SHA-256 hash.
6. The Lambda function retrieves the expected hash and metadata from DynamoDB.
7. The calculated hash is compared with the expected hash.
8. The verification result is returned to the client.
9. Verification activity is logged to CloudWatch Logs.
10. API activity is recorded by CloudTrail.

## 6. API Gateway and Lambda Verification Flow

Amazon API Gateway exposes an HTTPS endpoint for verification requests. AWS Lambda performs the verification logic.

Example request parameters:

```json
{
  "evidenceId": "evidence-consent-001"
}
```

Example response:

```json
{
  "evidenceId": "evidence-consent-001",
  "status": "VALID",
  "hashAlgorithm": "SHA-256",
  "calculatedHash": "example-calculated-hash",
  "expectedHash": "example-expected-hash"
}
```

Recommended design points:

- Use request validation in API Gateway
- Keep Lambda stateless
- Use IAM roles with least privilege
- Avoid returning sensitive evidence data in API responses
- Log verification results without exposing confidential content

## 7. Amazon S3 Evidence Storage

Amazon S3 is used to store evidence JSON files.

Recommended settings:

- Enable bucket versioning
- Block public access
- Use server-side encryption with AWS KMS
- Use least-privilege IAM policies
- Separate buckets by environment if needed

Example object path:

```text
s3://evidence-bucket/evidence/2026/06/evidence-consent-001.json
```

## 8. S3 Object Lock for Tamper Resistance

S3 Object Lock can be used to prevent evidence files from being deleted or overwritten during a defined retention period.

Possible modes:

- Governance mode for controlled retention
- Compliance mode for stronger immutability requirements

This helps make the evidence storage layer more tamper-resistant.

Important note:

S3 Object Lock must be enabled when the bucket is created. It cannot be enabled later on an existing bucket.

## 9. DynamoDB Metadata and Expected Hash Storage

Amazon DynamoDB can store metadata for each evidence record.

Example attributes:

```json
{
  "evidenceId": "evidence-consent-001",
  "schemaVersion": "1.0",
  "hashAlgorithm": "SHA-256",
  "expectedHash": "example-hash-value",
  "s3Bucket": "evidence-bucket",
  "s3Key": "evidence/2026/06/evidence-consent-001.json",
  "createdAt": "2026-06-06T00:00:00Z",
  "status": "ACTIVE"
}
```

DynamoDB is suitable for this use case because it provides:

- Low-latency lookup
- Serverless scaling
- Simple key-value access pattern
- Integration with IAM and CloudTrail

## 10. AWS KMS Encryption

AWS KMS should be used to protect sensitive evidence data and metadata.

Recommended usage:

- S3 server-side encryption with KMS
- DynamoDB encryption at rest
- Strict key policies
- Key rotation where appropriate
- Separation of duties for key administrators and key users

## 11. CloudTrail and CloudWatch Audit/Monitoring

CloudTrail and CloudWatch provide observability and auditability.

CloudTrail can record:

- API Gateway management events
- Lambda configuration changes
- S3 object-level access if enabled
- DynamoDB API activity
- KMS key usage events

CloudWatch can monitor:

- Lambda invocation count
- Lambda errors
- Lambda duration
- API Gateway latency
- Verification failure count
- Unexpected access patterns

Recommended alarms:

- High Lambda error rate
- Repeated verification failures
- Unauthorized S3 access attempts
- KMS access denied events

## 12. External Timestamping or Blockchain Anchoring

For stronger non-repudiation, the system can periodically anchor evidence hashes or Merkle roots to an external timestamping or blockchain network.

Possible approaches:

- Store individual evidence hashes externally
- Batch multiple hashes into a Merkle tree
- Anchor only the Merkle root to reduce cost
- Keep detailed evidence data off-chain
- Store only proof metadata on-chain

This approach can improve public verifiability while keeping sensitive evidence data private.

## 13. Security Considerations

Key security considerations include:

- Use least-privilege IAM roles
- Block public access to S3 buckets
- Enable encryption at rest and in transit
- Use KMS key policies carefully
- Enable CloudTrail logging
- Validate all API inputs
- Avoid storing sensitive personal data on-chain
- Use retention policies for evidence data
- Separate production and development environments

## 14. Cost Considerations

This architecture is designed to be cost-efficient for a PoC or early-stage product.

Main cost drivers:

- S3 storage and requests
- Lambda invocations and duration
- API Gateway requests
- DynamoDB read/write capacity
- KMS requests
- CloudWatch Logs ingestion and retention
- External blockchain anchoring fees, if used

Cost optimization ideas:

- Use serverless services to avoid idle compute cost
- Batch external anchoring operations
- Use appropriate CloudWatch Logs retention
- Store only hashes or Merkle roots externally
- Use DynamoDB on-demand capacity for unpredictable workloads

## 15. Limitations

This architecture is a conceptual design and does not yet include:

- Production-ready IAM policy definitions
- Infrastructure as Code templates
- Full threat modeling
- Multi-region disaster recovery design
- Detailed data classification
- Operational runbooks
- Formal compliance mapping

## 16. Future Work

Potential future enhancements:

- Add AWS CDK or Terraform implementation
- Add Merkle tree based batch anchoring
- Add multi-record hash chain verification
- Add signed verification reports
- Add API authentication with Amazon Cognito or IAM authorization
- Add dashboard for verification history
- Add automated security checks
- Add Well-Architected review notes
