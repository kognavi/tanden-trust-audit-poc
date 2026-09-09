---
id: loop-003-context-to-spec-handoff-learning
type: learning
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - scripts/scaffold-spec-from-context.js
  - tests/spec-handoff.test.js
  - docs/context-to-spec-handoff.md
  - AGENTS.md
  - .kiro/agents/architect.md
  - .kiro/agents/developer.md
  - PR-166
supports:
  - loop-003-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 003 Learning: Context Pack to Spec Handoff

## What changed

Context PackからSpecへ移る入口をRepository-wideで標準化した。

`npm run spec:scaffold -- <context-pack-path> <feature-slug>` を使い、requirements/design/tasksの3ファイルを同じhandoff contractで生成できる。

## Reusable lessons

1. Retrieval artifactとSpecificationを分離する。
   - Context Packは「何を読むべきか」を圧縮する。
   - Specは「何を作るか・どう検証するか」をreview後に確定する。

2. Spec scaffoldは自動生成しても、設計判断は自動承認しない。
   - placeholder/open questionを残すことで、人間またはAgent reviewを明示的な工程にできる。

3. provenanceをSpecへ持ち込む。
   - requirements/design/tasksすべてにSource Context Packを記録することで、仕様がどの文脈から生まれたか追跡できる。

4. overwrite protectionは重要。
   - 既存Spec directoryをdefaultで拒否し、AIが既存判断を黙って上書きする事故を防ぐ。

5. Developerにもhandoff gateが必要。
   - ArchitectだけでなくDeveloperにもSource Context Packとfinalized Specの確認を要求し、未確定scaffoldからの実装開始を防ぐ。

## Resulting standard flow

Human Inbox → Repository Inbox → Context Pack → Spec Scaffold → Architect Review → Finalized Spec → Implementation → Tests → Independent Review → Learning

## Next candidate

Loop 004では、Spec scaffold内のplaceholderや未解決review itemを機械検出し、未確定Specからimplementationへ進めないSpec Readiness Gateを追加する価値が高い。
