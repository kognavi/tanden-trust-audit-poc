---
id: loop-009-agent-orchestrator-task-graph
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

# Loop 009 - Agent Orchestrator / Task Graph

## Goal

Loop 008で分離したBuilder / Reviewer / Security Reviewerを、deterministicなTask Graphとstate transitionで順序制御する。

## Orchestration Contract

- BuilderがPASSするまでReviewerへ進めない
- ReviewerがFAILしたらBuilderへ戻す
- retry回数には上限を設ける
- Security Reviewerはdelegationで割り当てられている場合のみ実行する
- Verificationは必要なreviewがPASSするまで開始できない
- invalid transitionはfailする
- external AI provider APIやagent spawnは行わない
- merge / deployはHuman Approvalに残す
