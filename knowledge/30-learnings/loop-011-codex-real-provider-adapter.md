---
id: loop-011-codex-real-provider-adapter-learning
type: learning
status: reviewed
created: 2026-09-10
updated: 2026-09-10
source:
  - scripts/agent-runtime-adapter.js
  - schemas/codex-review-result.schema.json
  - tests/agent-runtime-adapter.test.js
  - docs/codex-real-provider-adapter.md
supports:
  - loop-011-context
contradicts: []
supersedes: []
reviewed_by:
  - chatgpt
---

# Loop 011 Learning: Codex Real Provider Adapter

## What changed

Loop 010のprovider-neutral Runtimeに、最初の実providerとしてReviewer専用Codex CLI adapterを追加した。

## Reusable lessons

1. Provider process successとsemantic verdictを分離する。
2. Real Providerは最小権限roleから接続する。
3. shellを介さずargument arrayでprovider processを起動する。
4. provider outputはschemaで制約し、Runtime側でも再検証する。
5. raw prompt/responseではなくdigestとsession provenanceをEvidenceへ残す。
6. provider errorはsemantic FAILと混同せず、workflowを勝手に進めない。
7. timeoutだけは明示的failure edgeとしてretry routingへ接続する。

## Residual limitations

- real providerはReviewerのみ。
- Codex CLIがローカル環境にinstall/authenticatedである必要がある。
- provider session identityはCLI-reported provenanceでありcryptographic attestationではない。
- long-lived session/resume/app-server orchestrationは未実装。
- Builder write-capable providerは未実装。

## Next candidate

Loop 012ではCodex Reviewer Adapterの実運用を踏まえ、Provider Session Lifecycleまたは最小権限Codex Builder Adapterのどちらを先に導入するか評価する。
