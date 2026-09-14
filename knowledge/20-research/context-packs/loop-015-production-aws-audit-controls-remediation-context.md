---
id: context-pack-loop-015-production-aws-audit-controls-remediation
type: context-pack
status: draft
created: 2026-09-14
updated: 2026-09-14
source:
  - AGENTS.md
  - infra/AGENTS.md
  - knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-context.md
  - .kiro/specs/loop-015-production-aws-audit-controls/requirements.md
  - .kiro/specs/loop-015-production-aws-audit-controls/design.md
  - .kiro/specs/loop-015-production-aws-audit-controls/reviewer-review.md
  - .kiro/specs/loop-015-production-aws-audit-controls/agent-task-graph.json
  - infra/modules/production-aws-audit-controls/main.tf
  - tests/production-aws-audit-controls.test.js
  - docs/production-aws-audit-controls.md
supports:
  - context-pack-loop-015-production-aws-audit-controls
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: Loop 015 Production AWS Audit Controls Remediation

## Intent

Terminal `FAILED`となったLoop 015を変更・resetせず、Human-approved remediation continuationとして新しいWork-first orchestrationを開始する。変更対象は最終independent Reviewerが残した2件だけとし、修正後にBuilder → Reviewer → Security Reviewer → Verificationを新しいTask Graphで実行する。

## Continuation Provenance

- Prior feature: `loop-015-production-aws-audit-controls`
- Prior terminal HEAD: `c0fcc677bc21cd613c91794c0de9da9fc3a76b45`
- Prior graph: `.kiro/specs/loop-015-production-aws-audit-controls/agent-task-graph.json`
- Prior graph SHA-256: `d8e1b6e34b5280f23de5cbe7dbb13e7bccc530377e7bd315f96e7f5444c69ebb`
- Prior graph status: `FAILED`
- Prior retry state: `2 / 2`
- Prior review evidence: `.kiro/specs/loop-015-production-aws-audit-controls/reviewer-review.md`, Review Attempt 3
- Prior review evidence SHA-256: `30acae6ad81e6a85636115f33a80bbd61dac465502607b1c7e6315d1d9593202`
- Recovery authority: explicit Human recovery decision approving a new continuation graph while prohibiting changes to the prior graph or history

The prior Task Graph, retry count, review artifacts, and commits are immutable audit inputs to this continuation. This continuation must not edit, reset, regenerate, or relax them.

## Current Implementation Truth

- The branch HEAD at continuation authorization is `c0fcc677bc21cd613c91794c0de9da9fc3a76b45`.
- `infra/modules/production-aws-audit-controls/main.tf` maps alert `eventId` from `$.id`, which is the EventBridge envelope ID rather than CloudTrail `$.detail.eventID`.
- `docs/production-aws-audit-controls.md` correctly explains the `home_region` detection boundary in prose, but its IAM control-map row still says `account-wide policy/role change events`.
- The original Loop 015 implementation, tests, Context Pack, Spec, Handoff, three review attempts, and terminal graph remain part of Git history and are not reopened by editing their graph.
- The control-plane module remains unbound to an environment. No AWS resource has been applied or verified by this work.
- The application trust boundary remains `Evidence → Schema → Sign → Store → Ledger`.

## Required Remediation

1. Replace the remaining runbook `account-wide` IAM detection claim with wording that explicitly limits active detection to events delivered in `home_region`.
2. Map alert correlation `eventId` from CloudTrail `$.detail.eventID`, never from EventBridge envelope `$.id`.
3. Add a regression test that requires `$.detail.eventID` and rejects `event_id = "$.id"`.

## Non-goals

- No other refactor, feature, event coverage, regional topology, Terraform resource, IAM/KMS policy, subscription, retention, or architecture change.
- No edit to `.kiro/specs/loop-015-production-aws-audit-controls/agent-task-graph.json` or its failed review evidence.
- No AWS API call, `terraform plan`, `terraform apply`, deploy, import, destroy, state mutation, IAM/KMS change, or destructive operation.
- No push, PR creation, merge, or production verification.

## Security and Trust Constraints

- Security Reviewer is mandatory and distinct from Builder and Reviewer.
- Alert payload stays allowlisted and must not add request/response data, user identity, source IP, Evidence content, credentials, secrets, or unnecessary PII.
- The remediation must not touch application Evidence processing or bypass `Evidence → Schema → Sign → Store → Ledger`.
- Existing protection controls and tests must not be weakened to obtain PASS.

## Affected Components

- `infra/modules/production-aws-audit-controls/main.tf`
- `tests/production-aws-audit-controls.test.js`
- `docs/production-aws-audit-controls.md`
- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-remediation-context.md`
- `.kiro/specs/loop-015-production-aws-audit-controls-remediation/`

## Validation Targets

- Focused audit-control tests PASS and explicitly distinguish CloudTrail event ID from EventBridge envelope ID.
- `npm run check:structure` PASS.
- `npm run spec:ready -- loop-015-production-aws-audit-controls-remediation` PASS.
- `npm run impl:conform -- loop-015-production-aws-audit-controls-remediation c0fcc677bc21cd613c91794c0de9da9fc3a76b45` PASS.
- `git diff --check` PASS.
- Independent Reviewer PASS, then independent Security Reviewer PASS.
- Verification Evidence is generated only after both reviews PASS and uses the fixed continuation base SHA.
- Prior Loop 015 Task Graph remains byte-for-byte unchanged from the continuation starting point.

## Review Checklist

- [x] The prior terminal graph and retry history are preserved rather than restarted.
- [x] Continuation provenance contains the exact prior HEAD and artifact paths.
- [x] Scope contains only the two Human-approved corrections and their regression test/governance artifacts.
- [x] Security Reviewer and Human Approval boundaries remain mandatory.
- [x] No live AWS mutation or trust-boundary change is authorized.
