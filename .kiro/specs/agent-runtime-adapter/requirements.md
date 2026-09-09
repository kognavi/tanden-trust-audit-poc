# Agent Runtime Adapter Requirements

## Source Context Pack
- `knowledge/20-research/loop-010-context.md`
- Context ID: `loop-010-context`

## Requirements
- Node.js標準機能のみ
- `npm run agent:runtime:init -- <feature-slug>`
- `npm run agent:runtime:run -- <feature-slug> <task-name> [scripted-result]`
- `.kiro/specs/<feature>/agent-runtime.json` を生成
- runtime configはtaskごとのadapterを持つ
- default adapterは `dry-run`
- dry-runはevidenceを生成するがTask Graphを進めない
- scripted adapterはPASS/FAIL/TIMEOUTを返せるtest用adapter
- READYでないtaskは実行拒否
- task actorとTask Graph actorのprovenanceを維持
- run evidenceは `.kiro/specs/<feature>/agent-runs/<run-id>.json`
- PASS/FAIL/TIMEOUTをTask Graph eventへ変換
- TIMEOUTはFAIL routingとして扱う
- external provider API / merge / deployは行わない
- Verification Evidenceへruntime run summaryを含める

## Open Questions
None

## Review Gate
Reviewed for Loop 010 implementation.
