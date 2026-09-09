---
id: loop-008-multi-agent-delegation
type: idea
status: inbox
created: 2026-09-09
updated: 2026-09-09
source: []
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 008 - Multi-Agent Delegation

## Goal

Builder / Reviewer / Security Reviewerの責務を明示的に分離し、同一Agentによる自己実装・自己承認を防ぎ、Loop 007 Evidence Packへrole provenanceを接続する。

## Delegation Contract

- Builder: implementationとtestsを担当
- Reviewer: implementationを変更せず、独立diff reviewを担当
- Security Reviewer: sensitive path変更時のみ必須
- BuilderとReviewerは同一identity不可
- sensitive changeではBuilderとSecurity Reviewerも同一identity不可
- review resultはrepository artifactとして残す
- merge / deployはHuman Approvalに残す

## Constraints

- AI provider固有APIに依存しない
- Agentを自動spawnしない
- production操作を行わない
- role nameだけでidentity真正性を暗号学的に保証したとは扱わない
