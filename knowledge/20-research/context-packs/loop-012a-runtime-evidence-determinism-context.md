---
id: context-pack-loop-012a-runtime-evidence-determinism
type: context-pack
status: draft
created: 2026-09-12
updated: 2026-09-12
source:
  - AGENTS.md
  - docs/loop-engineering.md
  - docs/ai-development-os.md
  - docs/module-registry.md
  - scripts/run-verification-evidence-gate.js
  - tests/verification-evidence-gate.test.js
  - .kiro/specs/verification-evidence-gate/requirements.md
  - .kiro/specs/verification-evidence-gate/design.md
supports:
  - loop-012a-runtime-evidence-determinism
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: loop-012a-runtime-evidence-determinism

## Intent

Verification EvidenceがAgent Runtimeの最新runをファイル名の辞書順で選択している状態を修正し、実行時系列に基づく決定的なlatest-run選択にする。

## Current Implementation Truth

- `scripts/run-verification-evidence-gate.js` の `readRuntimeEvidenceSummary()` が `agent-runs/*.json` を読み込み、taskごとの最新runをVerification Evidenceへ要約する。
- 旧実装はrunファイル名を `.sort()` し、taskごとの配列末尾をlatest runとして扱っていた。
- UUIDや任意run filenameの辞書順は実行時刻を保証しないため、古いrunが最新runとしてEvidenceへ記録される可能性がある。
- `tests/verification-evidence-gate.test.js` がVerification Evidence Gateの回帰テストを保持する。

## Problem

Verification Evidenceのlatest run判定がfilename orderingに依存しているため、run IDやUUIDの命名順と実際の実行時系列が異なる場合に、誤ったruntime provenanceをEvidenceへ記録できてしまう。

## Decision

同一task内のrunは次の順序で決定的に比較する。

1. `finishedAt`
2. `startedAt`
3. `runId`

最後の要素をlatest runとして扱う。

`runId` はtimestampが同一の場合のdeterministic tie-breakerとしてのみ使用し、実行時刻の代替にはしない。

## Validation

- filenameの辞書順とtimestamp順を意図的に逆転させたfixtureを追加する。
- 古いrunを `z-old.json`、新しいrunを `a-new.json` として、filename順では誤判定するケースを固定する。
- Verification Evidenceが `a-new` の `latestRunId`、`PASS` result、最新provider sessionを選択することを確認する。
- `npm test` と `npm run check:structure` が既存挙動を壊さず通過することを確認する。

## Repository Rules

- `AGENTS.md` must be read before implementation or review.
- code / tests / module registry remain current implementation truth.
- Context Pack is supporting context and does not override current code or tests.
- Preserve `Evidence → Schema → Sign → Store → Ledger`.
- Do not weaken verification, provenance, or fail-closed behavior to simplify implementation.
- Keep the change local-first with no new AWS resources or recurring cloud cost.

## Security and Auditability

- This change affects evidence provenance selection, so deterministic ordering is part of the trust boundary.
- No raw prompts, raw provider responses, secrets, credentials, or unnecessary PII should be added to Evidence.
- Timestamp-based ordering must remain deterministic and testable.
- Any future handling for missing or malformed timestamps should fail closed rather than silently trusting filename order.

## Scope

In scope:

- latest runtime run ordering in `readRuntimeEvidenceSummary()`
- deterministic regression coverage in `tests/verification-evidence-gate.test.js`

Out of scope:

- broad Agent Runtime refactors
- provider execution changes
- AWS infrastructure changes
- Evidence schema redesign
- unrelated dependency-cruiser warnings

## Review Checklist

- [ ] Current behavior is verified against code and tests.
- [ ] Latest-run selection no longer depends on filename ordering.
- [ ] Ordering is deterministic for equal timestamps.
- [ ] Regression test fails under the old filename-order behavior and passes under the new behavior.
- [ ] Existing Verification Evidence behavior remains compatible.
- [ ] Trust boundary and auditability are not weakened.
- [ ] No new AWS resource or recurring cost is introduced.
