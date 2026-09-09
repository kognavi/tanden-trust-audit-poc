---
id: loop-005-implementation-handoff-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/create-implementation-handoff.js
  - tests/implementation-handoff.test.js
  - docs/implementation-handoff.md
  - .github/pull_request_template.md
  - AGENTS.md
  - .kiro/agents/developer.md
  - PR-168
supports:
  - loop-005-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 005 Learning: Implementation Handoff

## What changed

Spec Readiness PASS後のimplementation開始を、Implementation Handoff manifest経由に標準化した。

`npm run impl:handoff -- <feature-slug>` はReadinessを再検証し、Source Context Pack / Spec / branch/worktree suggestion / PR provenanceを1つのmanifestへまとめる。

## Reusable lessons

1. Readiness PASSと実装開始の間にもhandoff artifactが必要。
   - Specがreadyでも、branch/worktree/PRまでprovenanceが伝わらなければ文脈が再び切れる。

2. Git automationは初版で実行しない方が安全。
   - local dirty state、既存branch、worktree配置など環境依存が大きい。
   - generatorはplanを出し、Human/Developerが状態確認後に実行する。

3. ProvenanceはPRまで持ち運ぶ。
   - Context Pack → Spec → Readiness → Handoff → PRを繋ぐことで、PRから設計判断の出所まで遡れる。

4. Handoff fileも上書き保護する。
   - 既存manifestを黙って再生成しないことで、途中で条件が変わった場合にreview機会を残す。

5. Readinessはhandoff時にも再検証する。
   - Spec生成後に内容が変わっている可能性があるため、handoff generatorがgateを再利用する。

## Residual limitations

- branch/worktreeが実際に存在するかは検証しない。
- local git statusはmanifest生成時に取得しない。
- PR provenance欄への自動入力はまだ行わない。

## Next candidate

Loop 006では、Implementation Handoffと実際のPR差分を照合する「Implementation Conformance Gate」を追加し、Spec外変更・未記録のsecurity/cost影響・provenance欠落をPR前に検出する価値が高い。
