# loop-015-production-aws-audit-controls-remediation Requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-015-production-aws-audit-controls-remediation-context.md`
- Context ID: `context-pack-loop-015-production-aws-audit-controls-remediation`

## Purpose

Loop 015のterminal `FAILED` stateとretry 2/2を不変の監査証跡として保持しながら、Human-approved continuationで最終Reviewerが残したrunbook scope表現とCloudTrail event correlation IDの2件だけを修正する。

## Current Implementation Truth

- Prior graph `.kiro/specs/loop-015-production-aws-audit-controls/agent-task-graph.json` is terminal `FAILED` at prior HEAD `c0fcc677bc21cd613c91794c0de9da9fc3a76b45` with retry count `2 / 2`.
- `docs/production-aws-audit-controls.md`のIAM control-map rowだけが`account-wide policy/role change events`と記述し、同runbookの`home_region`限定説明と矛盾している。
- `infra/modules/production-aws-audit-controls/main.tf`のalert transformerは`event_id = "$.id"`を使用し、CloudTrail `eventID`ではなくEventBridge envelope IDを`eventId`として出力する。
- Alert payloadはallowlist済みで、full CloudTrail envelope、request/response、identity、source IPをSNSへ転送しない。
- Moduleはenvironmentへ未接続であり、このcontinuationはAWS resource mutationを伴わない。

## Requirements

- [x] 旧Loop 015のTask Graph、retry count、review artifact、runtime artifactを編集・reset・再生成・上限緩和しない。
- [x] 新しいContext Pack、Spec、Handoff、Delegation、Task Graph、Runtimeでcontinuation provenanceを記録し、prior feature、terminal HEAD、graph path、review evidence pathを追跡可能にする。
- [x] RunbookのIAM detective controlを、`home_region`へ配信されたpolicy/role change eventsだけをactive detectionする表現へ修正する。
- [x] Alert transformerの`eventId`をCloudTrail `$.detail.eventID`から取得し、EventBridge envelope `$.id`を使用しない。
- [x] Regression testは`event_id = "$.detail.eventID"`を必須とし、`event_id = "$.id"`を拒否する。
- [x] Alert payloadの既存allowlistを維持し、新しいPII、secret、Evidence content、request/response、identity、source IPを追加しない。
- [x] 変更対象を上記2件、regression test、continuation governance artifactsに限定し、refactorやfeature追加を行わない。
- [x] Security Reviewerを必須とし、Builder → Reviewer → Security Reviewer → Verificationの順序を新Task Graphで維持する。

## Invariants

- Preserve `Evidence → Schema → Sign → Store → Ledger` unchanged.
- Prior terminal Task Graph is immutable evidence and is not a transition target for this continuation.
- Do not weaken security controls or tests to obtain PASS.
- Do not call AWS, run Terraform plan/apply, deploy, import, destroy, mutate state/resources, or change IAM/KMS.
- Do not push, create a PR, or merge without later explicit Human Approval.

## Acceptance Criteria

- [x] Runbook contains no active-detection claim of `account-wide policy/role change events` and states the `home_region` boundary accurately.
- [x] Terraform alert transformer maps `event_id` only from `$.detail.eventID`.
- [x] Focused regression tests prove the CloudTrail ID mapping and reject the former EventBridge ID mapping.
- [x] Existing relevant tests and `npm run check:structure` PASS.
- [x] Spec Readiness, Implementation Conformance, `git diff --check`, independent Reviewer, independent Security Reviewer, and Verification Evidence Gate PASS in order.
- [x] Verification uses continuation base `c0fcc677bc21cd613c91794c0de9da9fc3a76b45` and preserves traceability to the old terminal graph.
- [x] No AWS/live mutation, push, PR, or merge occurs.

## Open Questions

None.

## Review Gate

This Spec authorizes only the two Human-approved remediation edits, their deterministic regression assertion, and the governance/evidence artifacts required to run a new continuation Task Graph. It does not reopen or alter the prior terminal graph and does not authorize any external mutation.
