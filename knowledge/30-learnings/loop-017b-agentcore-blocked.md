---
id: learning-loop-017b-agentcore-blocked
type: learning
status: draft
created: 2026-09-29
updated: 2026-10-01
source:
  - .kiro/specs/loop-017b-lambda-nova-fallback/requirements.md
  - .kiro/specs/loop-017b-lambda-nova-fallback/design.md
  - evidence/loop017b/ecece0b3-4981-4d6e-859d-cb471941f243/g4-reconciliation.json
  - evidence/loop017b/ecece0b3-4981-4d6e-859d-cb471941f243/g5/verification-report.json
supports:
  - context-pack-loop-017-live-ai-agent-collector-completion
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 017B fallback and AgentCore status

AgentCore Runtime is **BLOCKED**, not resolved. In `ap-northeast-1`, repeated `CreateAgentRuntime` attempts returned `AccessDenied`; the diagnostic retry with create/endpoint/tag resources temporarily broadened to `*` and no conditions failed identically. IAM simulation allowed `CreateAgentRuntime`, `CreateAgentRuntimeEndpoint`, `TagResource`, `iam:PassRole`, `s3:GetObject`, and `iam:CreateServiceLinkedRole`; this does not identify the service-side denied action. The diagnostic policy was restored from backup; normalized live/backup SHA-256 was `f0071104a1c316eddbf40d87bf50a817fa62149f88dbfcb775cfb4294e1f8bca`. The last diagnostic CloudFormation stack ID ends in `3b731a60-bb46-11f1-bd02-0a904b569985`, OperationId `3b7898a0-bb46-11f1-bd02-0a904b569985`, and reported RequestToken is `712e7cf5-24c4-62ab-b1d3-f5a34ee75473`. The stack remained `ROLLBACK_COMPLETE`; no AgentCore Runtime existed and Nova had not been invoked. Existing Loop 017 evidence and history remain the source record.

## Current Loop 017B final state

Loop 017B uses an isolated Lambda plus Nova 2 Lite fallback to produce new evidence through the existing schema/sign/store/ledger trust path. Local code and tests alone do not prove live AWS execution. In the separately approved G4 run, read-only reconciliation verified one Lambda execution and one successful Nova 2 Lite Converse in the recorded observation window. Loop 017B is **COMPLETE** for this PoC fallback: G5 schema validation, LocalEcdsaProvider signing, Store/Ledger processing, and reread signature verification were **PASS**; tamper verification was **FAIL** as expected. No second inference was performed for G5 or publication.

The reserved-concurrency failure/taint is historical. Lambda-only untaint and output-only Terraform state reconciliation completed, ending with a verified **No changes** plan. This note updates recorded results and performs no new AWS verification. The deployment consists of **4 Terraform managed resources** across **3 major resource types: IAM, CloudWatch Logs, Lambda**.

Store remains the existing **memory implementation** and Ledger the existing **test double**. No PostgreSQL durability, production durable ledger, or global exactly-once guarantee is claimed. The signed wrapper observation establishes integrity, not the truth of arbitrary model prose or authenticity of CloudTrail. The sanitized G4 summary transcribes previously verified observations; it is not a signed AWS-native export.

**AWS cleanup is PENDING** and requires separate approval plus deletion verification. AgentCore Runtime remains **BLOCKED**, and the existing Loop 017 AgentCore evidence/history remains unchanged. Original local evidence is retained unchanged outside Git; portable summaries are linked in this note's sources. Any live result belongs to Loop 017B and must not be presented as an AgentCore Runtime resolution.
