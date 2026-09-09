---
id: loop-007-verification-evidence-gate-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/run-verification-evidence-gate.js
  - tests/verification-evidence-gate.test.js
  - docs/verification-evidence-gate.md
  - .github/pull_request_template.md
  - AGENTS.md
  - .kiro/agents/developer.md
supports:
  - loop-007-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 007 Learning: Verification & Evidence Gate

## What changed

Implementation Conformance、repository structure validation、sensitive-path security review signalを一つのdeterministic Gateへ束ね、PASS結果をJSON Evidence Packとして残す仕組みを追加した。

`npm run verify:gate -- <feature-slug> [base-ref]` は、`verification-evidence.json` を生成し、payloadのSHA-256 digestを記録する。

## Reusable lessons

1. Verificationは「結果」だけでなく「証拠の形」を標準化する。
   - PASS/FAILだけでは後から何を確認したか追えない。
   - provenance、changed files、commands、security signalを同じartifactへ固定する。

2. 既存Gateを再利用し、重複ロジックを増やさない。
   - Loop 007はLoop 006のImplementation Conformanceを呼び出す。

3. Security reviewはrisk-basedに要求する。
   - 全変更で独立security reviewを必須にせず、sensitive pathのときだけartifactを要求する。

4. Hashは署名ではない。
   - SHA-256 digestはintegrityには使えるが、authenticityやreviewer identityを暗号学的に証明しない。

5. Merge automationはまだ行わない。
   - Evidence GateはHuman merge decisionの入力を改善するもので、Human Approvalを置き換えない。

## Residual limitations

- CI providerのcheck statusやPR bodyをGitHub APIから直接検証していない。
- Evidence Pack自体の署名/attestationは未実装。
- semantic requirement coverageは独立reviewに残る。
- production environmentのruntime verificationは対象外。

## Next candidate

Loop 008ではBuilder / Reviewer / Security Reviewerを分離したMulti-Agent Delegationへ進み、同じEvidence Packにagent role provenanceを接続する価値が高い。
