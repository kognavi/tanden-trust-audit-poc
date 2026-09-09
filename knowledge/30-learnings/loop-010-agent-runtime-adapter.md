---
id: loop-010-agent-runtime-adapter-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/agent-runtime-adapter.js
  - tests/agent-runtime-adapter.test.js
  - scripts/run-verification-evidence-gate.js
  - docs/agent-runtime-adapter.md
supports:
  - loop-010-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 010 Learning: Agent Runtime Adapter

## What changed

Task Graph control planeにprovider-neutralなexecution-plane contractを接続し、READY task validation、adapter result mapping、timeout-as-failure、run evidenceを標準化した。

## Reusable lessons

1. Control planeとexecution planeを分離する。
2. default adapterは安全なdry-runにする。
3. dry-runはPASSに昇格させない。
4. execution resultをTask Graph eventへdeterministicに変換する。
5. run evidenceにはprompt/responseではなくprovenanceと結果だけを残す。
6. provider adapterはstate semantics確立後に追加する。

## Residual limitations

- real Kiro/Codex/Work adapterは未実装。
- timeoutはscripted resultとして検証しており、実process cancellationは未実装。
- concurrency / queue / remote session identityは未実装。
- runtime evidenceは署名されていない。

## Next candidate

Loop 011ではprovider-specific adapterを最小1種類だけ追加し、実run ID / session provenance / timeout cancellationをRuntime contractへ接続する価値が高い。
