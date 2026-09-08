---
id: loop-002-context-pack-learning
type: learning
status: reviewed
created: 2026-09-08
updated: 2026-09-08
source:
  - scripts/generate-context-pack.js
  - tests/context-pack.test.js
  - knowledge/20-research/context-packs/loop-002-context-pack-context.md
  - PR-165
supports:
  - loop-002-context
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 002 Learning: Context Pack Generation

## What worked

Human InboxのアイデアをRepository Inboxへ移し、Context、Spec、deterministic retrieval、test、Context Pack出力まで一つのLoopとして残せた。

## Reusable lessons

1. Context retrievalとreasoningを分離する。
   - 初段はdeterministic retrievalで関連fileを集める。
   - Kiro / CodexはそのContext Packを読んで後段のreasoningを行う。

2. AGENTS.mdはranking対象ではなくmandatory contextとして扱う。
   - Repository-wide ruleがkeyword scoreで落ちることを防ぐ。

3. Context Packはimplementation truthではない。
   - code / tests / module registryが優先。
   - Packは「読むべき候補」を圧縮した作業用brief。

4. 初版ではfile本文をContext Packへ大量転載しない。
   - path、score、固定constraintを中心にし、secretや不要情報の再保存リスクを下げる。

5. semantic searchはまだ不要。
   - keyword/path scoringで有用性を検証してから、必要ならembeddingやLLM rerankを別Loopで評価する。

## Residual limitations

- 日本語本文のsemantic relevanceは英数字technical token中心の初版では弱い。
- 同義語やconcept-level relationは拾えない。
- Context Packの関連性はHuman / Agent reviewが必要。
- repository規模が大きくなれば全file scanの性能改善が必要。

## Next candidate

Loop 003では、生成されたContext PackをKiro/Codexのspec作成前入力として自動接続し、「Inbox → Context Pack → Spec」のhandoffを標準化する。
