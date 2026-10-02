# Loop 017B — Lambda + Nova 2 Lite fallback tasks

## Source Context Pack

- `knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md`
- Context ID: `context-pack-loop-017-live-ai-agent-collector-completion`

## Current final state and authorization

Loop 017B is **COMPLETE** for the approved one-shot Lambda/Nova PoC and local/test Evidence path. AgentCore Runtime remains **BLOCKED**. **AWS cleanup is PENDING**. Store is the existing **memory implementation** and Ledger the existing **test double**; no production durable ledger is claimed.

This list records completed implementation and separately approved operations. It is not authorization to repeat deployment, state repair, or inference. Current work is limited to pre-commit documentation, sanitized portable evidence, Git hygiene, and AWS-free validation. No AWS call, runtime/IAM change, Terraform state modification, commit, or push is authorized by this update.

Portable evidence: `evidence/loop017b/ecece0b3-4981-4d6e-859d-cb471941f243/`. The G4 summary transcribes previously verified observations; it does not claim a fresh AWS check or an AWS-native signed export.

## G0 — source and history

- [x] Confirm approved source `9148c8451d7b092397ecdf5b3fb1d37c64233546` on the Loop 017 branch and preserve existing working-tree implementation.
- [x] Keep existing Loop 017 AgentCore implementation/evidence/history unchanged and AgentCore Runtime **BLOCKED**. Diagnostic policy restored with normalized SHA-256 `f0071104a1c316eddbf40d87bf50a817fa62149f88dbfcb775cfb4294e1f8bca`.

## G1 — local specification and implementation

- [x] Review the requirements/design/tasks, synthetic no-op semantics, producer trust boundary, IAM, and one-attempt approval limit in the prior Reviewer/Security Reviewer passes.
- [x] Implement the fixed-input wrapper: one non-streaming Converse maximum, no follow-up inference/retry, exact tool validation, sanitized response/logs.
- [x] Implement collector and local demo using the existing normalized schema, mapper, Evidence schema, and EvidenceProcessingService.
- [x] Add AWS-free fixed-input, tool/correlation/leakage, INDETERMINATE, processing-order, signature, and tamper tests.
- [x] Add isolated Terraform for **4 Terraform managed resources** across **3 major resource types: IAM, CloudWatch Logs, Lambda**: IAM role, IAM inline role policy, log group, Lambda function.
- [x] Register new modules/package wiring; preserve AgentCore files/history.

Prior session approvals and review results authorize the implemented PoC. This record does not manufacture missing Spec Readiness, implementation-handoff, delegation, conformance, or verification-evidence artifacts; those generated governance artifacts are not included or claimed PASS here. This pre-commit update does not execute artifact-writing governance commands.

## G2 — prior read-only AWS preflight

- [x] Verify the active Japan Nova 2 Lite profile and Tokyo/Osaka destinations; review account/principal, access, cost, code/input digest, logging, and cleanup gates before the separately approved live run.
- [x] Review the human SSO Administrator principal as a one-off PoC exception; never delegate AdministratorAccess to Lambda. Future reusable/production deployments require a dedicated least-privilege deploy role.

## G3 — completed deployment and state reconciliation

- [x] Deploy the reviewed 4 Terraform managed resources under separate approval without model inference.
- [x] Omit reserved concurrency after the account-quota failure, preserving execution-role IAM. The failed concurrency attempt and Lambda taint are historical.
- [x] Under separate state-repair approval, back up state and untaint only `aws_lambda_function.nova_demo`; refreshed plan: 0 add / 0 change / 0 destroy, output addition only.
- [x] Apply only the reviewed output-state plan for `lambda_function_arn`, with no AWS resource mutation; final verified plan: **No changes**.

## G4 — completed one-shot live inference

- [x] Verify deployed code/configuration/IAM and absence of automatic triggers; run prior approved Tokyo/Osaka model-invocation-logging gates.
- [x] Record the fixed synthetic run ID and intent before the approved synchronous RequestResponse invoke; caller and SDK retries disabled.
- [x] Verify one Lambda execution and one successful Nova 2 Lite Converse in the recorded observation window. Run `ecece0b3-4981-4d6e-859d-cb471941f243`; no second inference.

The no-trigger/manual approval boundary is operational. No durable duplicate-run lock or global exactly-once guarantee is claimed. Ambiguous future results are INDETERMINATE; stop without retrying under the same GO.

## G5 — completed local acceptance; cleanup pending

- [x] Preserve sanitized G4 request/event IDs, observation window, counts, executing role name, profile, usage, digests, and provenance in `g4-reconciliation.json`.
- [x] Process the saved sanitized Lambda response through collector, normalized schema, mapper, Evidence schema, LocalEcdsaProvider, memory Store, and Ledger test double.
- [x] Verify reloaded signature **PASS** and tampered clone **FAIL** as expected; retain signed record, public key, test Ledger receipt, summary, portable verification report, and manifest.
- [x] Archive original local evidence unchanged outside Git; ignore `loop017b-live/` and publish only selected portable evidence without personal paths or human SSO session identity.
- [ ] Obtain separate cleanup approval, remove only Loop 017B AWS resources, and verify deletion. **Not executed**; do not delete CloudTrail history or AgentCore evidence.

## Pre-commit validation

Run focused Loop 017B/logging-gate tests, `npm run check:structure`, ESLint without fixes/cache, `bash -n`, Terraform formatting/validation, and `git diff --check`. Validate portable normalized/Evidence schemas, signature PASS, tamper FAIL, correlation, manifest hashes, original archive equality, and no sensitive payloads. Preview proposed Git scope without staging. No Terraform init/plan/apply or AWS check is part of this step.

## Stop conditions

Any source/artifact mismatch, failed validation, unexpected privilege/runtime/state change, or sensitive payload blocks commit readiness. PoC COMPLETE does not imply cleanup complete, production durability, AgentCore remediation, or permission for another inference. Future AWS mutations, cleanup, commit, and push require separate authorization.
