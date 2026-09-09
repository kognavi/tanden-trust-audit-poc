# Multi-Agent Delegation Requirements

## Source Context Pack

- `knowledge/20-research/loop-008-context.md`
- Context ID: `loop-008-context`

## Purpose

Builder / Reviewer / Security Reviewerの役割分離をportableなrepository contractとして標準化し、Verification Evidenceへagent role provenanceを接続する。

## Current Implementation Truth

- `.kiro/agents/developer.md` がimplementation specialistとして存在する。
- `.kiro/agents/security-reviewer.md` がread-oriented independent reviewerとして存在する。
- generic independent Reviewer専用Agentはまだ存在しない。
- Verification & Evidence Gateはrole provenanceを検証していない。

## Requirements

- Node.js標準機能のみで実装する。
- `npm run agent:delegate -- <feature-slug> <builder-id> <reviewer-id> [security-reviewer-id]` を提供する。
- `.kiro/specs/<feature>/agent-delegation.json` を生成する。
- BuilderとReviewer identityが同一ならfailする。
- securityReviewerが指定された場合、Builderと同一identityならfailする。
- role artifactにはschemaVersion / feature / roles / generatedAtを含める。
- generic read-oriented Reviewer Agentを追加する。
- Verification & Evidence Gateはdelegation artifactを必須とする。
- Verification & Evidence Gateは `reviewer-review.md` の `Status: PASS` とnon-empty `Reviewed by:` を要求する。
- `reviewer-review.md` のReviewed byはdelegation reviewer identityと一致する必要がある。
- sensitive changeではsecurity reviewer identityがdelegationに必要である。
- sensitive changeでは `security-review.md` のReviewed byがdelegation securityReviewer identityと一致する必要がある。
- Evidence Packへroles / reviewer review / security reviewを含める。
- provider-specific API、agent spawn、merge、deployを実行しない。

## Invariants

- Builderは自己review結果をReviewerとして承認できない。
- ReviewerとSecurity Reviewerはsource modificationを原則行わない。
- Human Approval境界を維持する。
- product trust boundary Evidence → Schema → Sign → Store → Ledgerを変更しない。

## Acceptance Criteria

- distinct Builder/Reviewerでdelegation artifactを生成できる。
- same Builder/Reviewerは拒否される。
- Reviewer review欠落またはidentity mismatchでVerification Gateがfailする。
- sensitive changeでSecurity Reviewer欠落またはidentity mismatchならfailする。
- PASS時Evidence Packへrole provenanceが含まれる。
- governance docs / agents / testsへ反映される。

## Open Questions

None

## Review Gate

Reviewed for Loop 008 implementation.
