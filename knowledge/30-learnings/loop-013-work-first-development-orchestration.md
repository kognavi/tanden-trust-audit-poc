---
id: loop-013-work-first-development-orchestration-learning
type: learning
status: draft
created: 2026-09-13
updated: 2026-09-13
source:
  - scripts/work-development-orchestrator.js
  - tests/work-development-orchestrator.test.js
  - docs/work-first-development-orchestration.md
supports:
  - context-pack-loop-013-work-first-development-orchestration
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 013 Learning: Work-first Development Orchestration

## What changed

ChatGPT Workをdevelopment control planeとして使うため、review済みHandoffから既存Delegation / Task Graph / committed dry-run Runtimeをfail-closedにbootstrapし、現在phaseとRuntime run summaryをdurable artifactsから表示するcomposition layerを追加した。

## Reusable lessons

1. Orchestrationは既存controlの置換ではなくcompositionとして追加すると、canonical state machineとreview boundaryを維持できる。
2. 複数artifactの初期化は、全preconditionと全documentを先に検証してからexclusive createする。
3. 再実行を便利にするためのsilent overwriteは、review/verification provenanceを破壊するため拒否する。
4. status commandはREADY taskだけでなく、role drift、partial state、Verification Evidence digest、latest Runtime resultもfail-closedに扱う。
5. Workがcontrol planeでも、real provider opt-in、Task Graph event、verification、merge、deployは明示的boundaryとして残す。

## Residual limitations

- file write rollbackはprocess-level exceptionに対するbest effortであり、OS crashを含むtransactional filesystem guaranteeではない。
- Work role identityとprovider/session provenanceはcryptographic identity proofではない。
- この実行環境にはCodex CLIがなく、最初のreal Reviewer attemptは `PROVIDER_ERROR / ENOENT` として記録され、Task GraphはReviewer READYのままである。
- independent Reviewer PASSとVerification Evidenceは未完了である。

## Next action

Codex CLIを利用できる開発環境で同一branchを取得し、`work:status`を確認してからreal Reviewerを再実行する。PASS後のみVerification Gateへ進む。
