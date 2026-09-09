---
id: loop-009-agent-orchestrator-task-graph-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/agent-task-graph.js
  - tests/agent-task-graph.test.js
  - docs/agent-orchestrator-task-graph.md
  - AGENTS.md
  - docs/ai-development-os.md
supports:
  - loop-009-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 009 Learning: Agent Orchestrator / Task Graph

## What changed

Loop 008のrole separationに、deterministicなexecution ordering、retry routing、terminal stateを追加した。

`agent-task-graph.json` がworkflow stateの正本となり、roleが次工程へ進める条件をmachine-readableに管理する。

## Reusable lessons

1. Orchestrationはagent invocationよりstate semanticsを先に固める。
   - 誰を呼ぶかより、どの状態で何が許可されるかを先に固定するとprovider couplingを避けられる。

2. Failure routingは明示的なgraph edgeにする。
   - Reviewer/Security/Verification FAILをBuilder retryへ戻すことで、修正loopが監査可能になる。

3. retryには上限が必要。
   - infinite loopを防ぎ、上限超過時はHumanへ制御を返す。

4. terminal stateは自動で再開しない。
   - COMPLETE/FAILED後の暗黙再実行を防ぎ、workflow historyを保護する。

5. Task Graphはexecution engineと分離する。
   - 将来Kiro/Codex/Work/外部runnerを接続してもcontrol semanticsを再利用できる。

## Residual limitations

- agent providerを実際にはspawnしない。
- concurrency / queue / timeout / cancellationは未実装。
- task graph artifact自体の署名/attestationは未実装。
- human approval taskをgraph nodeとしてはまだ表現していない。

## Next candidate

Loop 010ではTask Graphを実際のexecution adapterへ接続し、provider-neutralなAgent Runtime Adapter、timeout、retry execution、run evidenceを標準化する価値が高い。
