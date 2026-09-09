---
id: loop-006-implementation-conformance-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/check-implementation-conformance.js
  - tests/implementation-conformance.test.js
  - docs/implementation-conformance-gate.md
  - .github/pull_request_template.md
  - AGENTS.md
  - .kiro/agents/developer.md
  - PR-169
supports:
  - loop-006-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 006 Learning: Implementation Conformance Gate

## What changed

Implementation後、PR前にchanged filesをreview済みSpecのAffected Componentsと照合するdeterministic gateを追加した。

`npm run impl:conform -- <feature-slug> [base-ref]` はSpec Readiness、Implementation Handoff provenance、changed-file scope、sensitive-path impact declarationを確認する。

## Reusable lessons

1. Spec conformanceはsemantic judgeから始めない。
   - 初版ではscope driftとprovenance driftを機械検出する方が再現性と説明可能性が高い。

2. Affected Componentsをmachine-readable contractとして再利用できる。
   - exact fileとdirectory prefixを明示することで、予定外変更をPR前に検出できる。

3. Governance artifactはfeature codeとは別扱いが必要。
   - feature自身のSpec更新とknowledge/30-learningsは許可例外にする。

4. Sensitive pathは自動拒否ではなくimpact declaration gateにする。
   - infra/workflow/IAM/KMS/Terraform/policy変更時にTrust Boundary / Security / Cost記載を要求する。
   - 記載内容の正しさはHuman/independent reviewに残す。

5. Conformance PASSはsemantic correctnessではない。
   - tests、security checks、independent diff reviewは引き続き必要。

## Residual limitations

- rename/deleteは初版のdefault diff-filter対象外または限定的。
- Affected Componentsが広すぎるdirectory prefixだとgate精度が落ちる。
- コードが要件を意味的に満たすかは判定しない。
- PR bodyのprovenance値そのものをGitHub APIで自動照合するところまでは未実装。

## Next candidate

Loop 007では、PR作成後のchanged files / PR body / CI resultsをImplementation Handoffと照合する「PR Release Gate」を追加し、merge直前の最終provenanceとquality gateを標準化する価値が高い。
