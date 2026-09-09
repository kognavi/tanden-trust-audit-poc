---
id: loop-008-multi-agent-delegation-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/create-agent-delegation.js
  - scripts/run-verification-evidence-gate.js
  - .kiro/agents/reviewer.md
  - docs/multi-agent-delegation.md
  - tests/multi-agent-delegation.test.js
  - tests/verification-evidence-gate.test.js
supports:
  - loop-008-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 008 Learning: Multi-Agent Delegation

## What changed

Builder / Reviewer / Security Reviewerをmachine-readableなdelegation contractとして定義し、Verification Evidence Gateへrole provenanceを接続した。

`agent-delegation.json` はBuilderとReviewerのidentity separationを必須化し、sensitive changeではSecurity Reviewerも分離する。

## Reusable lessons

1. Multi-Agentの第一歩はagent数ではなくseparation of duties。
   - 自動spawnより先に「誰が作り、誰が検証したか」を固定する方が監査可能。

2. ReviewerはBuilderとは別のrole contractにする。
   - self-reviewは補助として有用でも、最終独立reviewの代替にしない。

3. Security Reviewerはrisk-basedにする。
   - sensitive pathだけで必須化し、通常変更のcoordination costを抑える。

4. Role provenanceをVerification Evidenceに含める。
   - changed filesとchecksだけでなく、responsibility chainも後から追える。

5. Role IDはstrong identityではない。
   - 将来のattestation/signingを検討する余地を残す。

## Residual limitations

- Agentの自動起動・並列実行は未実装。
- role IDと実際のprovider session identityを暗号学的に結びつけていない。
- Reviewer artifactはMarkdown declarationであり署名されていない。
- orchestration retry / timeout / task graph / concurrency controlは未実装。

## Next candidate

Loop 009ではAgent Orchestrator / Task Graphを導入し、delegation contractに基づいてBuilder → Reviewer → Security Reviewerの実行順序、retry、failure routingを標準化する価値が高い。
