# Roadmap

## Phase 0: Repository Setup

Status: Completed

Goals:

- Create public GitHub repository
- Add README
- Add MIT License
- Add Node `.gitignore`
- Add initial documentation

Deliverables:

- README.md
- LICENSE
- .gitignore
- docs/architecture.md
- docs/security.md
- docs/audit-design.md
- docs/threat-model.md
- docs/roadmap.md

## Phase 1: Local Hash Verification

Status: In Progress

Goals:

- Create sample evidence JSON
- Implement SHA-256 hash generation
- Implement hash verification script
- Confirm that changes to evidence data are detectable

Deliverables:

- samples/evidence-consent.json
- scripts/hash-evidence.js
- scripts/verify-evidence.js

## Phase 2: AWS-Based Evidence Storage

Status: Planned

Goals:

- Store evidence files in Amazon S3
- Store evidence metadata and hashes in Amazon DynamoDB
- Use AWS Lambda for evidence registration and verification
- Apply least privilege IAM policies

Possible AWS Services:

- Amazon S3
- Amazon DynamoDB
- AWS Lambda
- Amazon API Gateway
- AWS KMS
- AWS CloudTrail
- Amazon CloudWatch

## Phase 3: Tamper-Resistance Enhancement

Status: Planned

Goals:

- Enable S3 Versioning
- Evaluate S3 Object Lock
- Record immutable-style audit events
- Add external timestamping

Possible Technologies:

- S3 Object Lock
- DynamoDB Streams
- OpenTimestamps
- Blockchain hash anchoring

## Phase 4: AI-Assisted Audit Review

Status: Planned

Goals:

- Use AI to summarize audit evidence
- Detect inconsistencies in records
- Generate human-readable audit reports
- Keep AI output traceable to source evidence

Important Principles:

- AI should not replace source evidence
- AI analysis should be reviewable
- AI-generated output should be clearly separated from original records

## Phase 5: Web3-Compatible Verification

Status: Planned

Goals:

- Add blockchain-compatible evidence anchoring
- Explore Verifiable Credentials
- Explore selective disclosure
- Avoid storing personal data on-chain

Possible Technologies:

- Ethereum-compatible hash anchoring
- Polygon or other L2 networks
- Verifiable Credentials
- Decentralized Identifiers
- Zero-knowledge proofs

## Current Priority

The current priority is Phase 1:

1. Create a sample evidence JSON file
2. Generate a SHA-256 hash
3. Verify that the evidence has not been modified
4. Document the verification process
