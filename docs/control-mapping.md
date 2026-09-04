# Control Mapping

## Purpose

This document maps candidate control objectives to the **AI Agent Evidence Profile** and the current evidence-verification implementation.

It is intended for design, practitioner interviews, and portfolio review.

It is **not** a formal SOC 2, J-SOX, ISO 27001, regulatory, or audit attestation.

## Scope

Primary profile:

- `schemas/ai-agent-evidence.schema.json`
- `samples/ai-agent-tool-call.json`

Legacy/general-purpose evidence samples remain in the repository for regression coverage.

## Candidate Control Mapping

| Control Area | Control Objective | AI Agent Evidence Fields | Current Verification | Remaining Gap |
|---|---|---|---|---|
| Actor Accountability | Identify the human/service/agent that initiated an action. | `actor.type`, `actor.id`, `actor.principalRef` | Schema validation and evidence inspection | Bind to production identity/IAM/CloudTrail |
| Agent Configuration Traceability | Identify which agent configuration executed the action. | `agent.agentId`, `agent.agentVersion`, `agent.promptConfigDigestSha256` | Structured evidence + digest protection | Runtime collector and config registry |
| Model Traceability | Identify model provider and model identity. | `model.provider`, `model.modelId`, `model.modelVersion` | Structured evidence + integrity checks | Runtime-sourced model metadata |
| Execution Correlation | Link evidence to an agent execution/session/task. | `execution.traceId`, `sessionId`, `taskId` | Schema validation | Cross-system trace correlation |
| Policy Decision Traceability | Record what policy decision governed the action. | `policy.policyId`, `policy.policyVersion`, `policy.decision`, `reasonCode` | Structured evidence | Bind to policy engine decision artifacts |
| Tool / Action Accountability | Record what operation was attempted and where. | `action.toolName`, `operation`, `target` | Structured evidence | Runtime collector and target-system correlation |
| Human Oversight | Record whether approval was required and who approved it. | `approval.required`, `status`, `approverId`, `decidedAt` | Conditional schema requirements for approved/rejected states | Strong approver identity and approval-system evidence |
| Side-Effect Traceability | Record what external effect actually occurred. | `sideEffect.category`, `resource`, `outcome` | Structured evidence | Independent target-system telemetry |
| Evidence Lineage | Preserve references to source context without copying sensitive payloads. | `contextReferences[]` | Reference/digest schema constraints | Resolver and availability guarantees |
| Artifact Traceability | Link evidence to resulting reports/messages/changesets. | `artifacts[]` | Reference/digest schema constraints | Artifact registry and retention |
| Evidence Integrity | Detect unauthorized changes to evidence. | Entire canonicalized evidence object | RFC 8785 JCS + SHA-256 + signatures | Production key/identity hardening |
| Evidence Authenticity | Associate evidence with a signing key. | Signed evidence metadata | Local provider / AwsKmsProvider | Production KMS key policy and signer authorization |
| Audit Reperformance | Allow a reviewer to repeat verification. | Evidence + signature/store/ledger references | Tests, scripts, verification runbook | Auditor-facing evidence bundle |
| Retention / Immutability | Preserve evidence for required duration. | `metadata.retentionClass` | S3 Object Lock module exists | Deployed retention policy and legal hold operations |
| Data Minimization | Avoid unnecessary sensitive content in evidence. | `metadata.containsPersonalData`, `containsSecrets` plus reference/digest design | Profile excludes raw prompt fields by default | Runtime redaction/classification |
| Completeness | Detect missing or reordered expected evidence. | execution/correlation fields | Limited | sequence/gap proofs, checkpoints, reconciliation |
| Operational Monitoring | Detect failed verification or evidence-processing errors. | processing/ledger outcomes | automated tests and partial-failure semantics | CloudWatch alarms, SLOs, IR workflow |

## Example Review Flow

For one security-relevant agent action:

1. identify the evidence record
2. validate it against the AI Agent Evidence schema
3. inspect actor / agent / model / policy / tool / approval / side-effect context
4. canonicalize and recalculate the digest
5. verify the signature
6. inspect the versioned store reference
7. inspect the signing-ledger event
8. resolve referenced source/policy/artifact objects where authorized
9. determine whether the record supports the relevant control objective
10. document gaps or exceptions

## Important Boundary

Cryptographic integrity does not prove that the original observation was true.

Examples:

- a compromised collector can sign incorrect data
- a policy engine can emit the wrong decision
- an approver identity can be compromised
- a target system can report an incorrect result

Evidence integrity must therefore be combined with trusted producer identity, independent telemetry, least privilege, monitoring, and review.

## Current Validation Priorities

Before adding formal framework references, validate the control model with practitioners in:

- AI Agent / SaaS
- internal audit
- compliance
- security engineering
- cloud governance
- regulated SaaS / FinTech

Key question:

> Which evidence fields are actually required to approve, investigate, or audit a real agent action?

## Limitations

This mapping is conceptual and implementation-oriented.

It does not represent a formal audit opinion, certification, compliance attestation, or legal conclusion.
