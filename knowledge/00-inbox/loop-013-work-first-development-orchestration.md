---
id: loop-013-work-first-development-orchestration
type: idea
status: inbox
created: 2026-09-13
updated: 2026-09-13
source: []
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 013 - Work-first Development Orchestration

## Goal

ChatGPT Workをdevelopment control planeとして、既存のSpec Readiness、Implementation Handoff、Multi-Agent Delegation、Task Graph、Runtime Adapterを再利用し、implementation開始前のworkflow bootstrapと現在状態の把握を1つのrepository-local interfaceへ統合する。

## Boundary

- WorkはHuman intentとrepository governanceを接続するorchestratorであり、Human Approvalを代替しない。
- Builderは `chatgpt-builder`、independent Reviewerは `codex-reviewer` を既定roleとする。
- Codex real providerはReviewer-only、local opt-in、read-only sandboxを維持する。
- bootstrapはSpec Readiness PASSとImplementation Handoffの存在を必須とする。
- bootstrapは既存のdelegation、Task Graph、committed dry-run Runtimeを順番に初期化する。
- partially initialized stateや既存artifactを黙って上書きしない。
- statusはdurable artifactから現在状態と次に許可されたactionを決定的に導出する。
- git branch/worktree/push、provider execution、Task Graph event、verification、merge、deployを自動実行しない。
- raw prompt、raw response、secret、credential、不要なPIIをartifactへ保存しない。
- `Evidence → Schema → Sign → Store → Ledger` とLocal-first / AWS-on-demandを維持する。
