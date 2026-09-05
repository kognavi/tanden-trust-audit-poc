# Requirements: Local-First Live Agent Collector

## Goal

Demonstrate one real AI Agent tool-call event flowing into the existing Evidence pipeline while keeping normal development and CI free of real AWS usage.

## Functional Requirements

1. The collector shall accept one normalized security-relevant Agent tool-call event.
2. The event shall be mapped to `schemas/ai-agent-evidence.schema.json`.
3. The generated Evidence shall pass schema validation before signing.
4. The default demo shall use local/fake dependencies.
5. The same normalized Evidence shall be compatible with the existing `EvidenceProcessingService`.
6. A manual AWS demo path may later source one live event from an AWS-oriented Agent runtime.
7. Tampering with generated Evidence shall cause verification failure.

## Cost Requirements

1. Default CI shall not request AWS credentials.
2. Default CI shall not make billable AWS API calls.
3. No always-on AWS resource is required for development or review.
4. Real AWS integration shall be manually triggered only.
5. Persistent RDS/Aurora, NAT Gateway, OpenSearch, always-on ECS/EC2, and provisioned model throughput are out of scope.
6. AWS resources created for demonstration shall be short-lived or reused only when their idle cost is negligible and explicitly accepted.

## Security Requirements

1. Raw credentials, secrets, and unnecessary PII shall not be stored in Evidence.
2. The collector shall prefer references, versions, digests, and correlation IDs.
3. The collector shall not bypass the repository trust boundary:
   `Evidence → Schema → Sign → Store → Ledger`.
4. Live-runtime source data shall not be treated as truthful merely because it is signed later.
