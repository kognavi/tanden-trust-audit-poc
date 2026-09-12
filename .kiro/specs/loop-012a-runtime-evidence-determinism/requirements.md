# loop-012a-runtime-evidence-determinism Requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-012a-runtime-evidence-determinism-context.md`
- Context ID: `context-pack-loop-012a-runtime-evidence-determinism`

## Purpose

Verification Evidence が Agent Runtime の最新 run を filename ordering ではなく、実際の実行時系列に基づいて決定できるようにする。

## Current Implementation Truth

- `scripts/run-verification-evidence-gate.js` の `readRuntimeEvidenceSummary()` が task ごとの run を集約する。
- 旧挙動は run filename の辞書順に依存していた。
- UUID や任意 run filename の辞書順は実行時刻を保証しない。
- `tests/verification-evidence-gate.test.js` が Verification Evidence Gate の回帰テストを保持する。

## Requirements

- [x] 同一 task の run は `finishedAt` を第一キーとして昇順比較する。
- [x] `finishedAt` が同一の場合は `startedAt` を第二キーとして比較する。
- [x] 両 timestamp が同一の場合は `runId` を deterministic tie-breaker とする。
- [x] latest run の選択は filename ordering に依存しない。
- [x] Verification Evidence の既存 summary shape と provider/session provenance を維持する。
- [x] filename ordering と timestamp ordering が逆転する回帰テストを追加する。
- [x] 新しい AWS resource や recurring cloud cost を追加しない。

## Invariants

- Preserve `Evidence → Schema → Sign → Store → Ledger`.
- Do not weaken verification, provenance, or fail-closed behavior.
- Do not add raw prompts, raw provider responses, secrets, credentials, or unnecessary PII to Evidence.
- Keep Local-first / AWS-on-demand.

## Acceptance Criteria

- [x] Existing relevant tests remain green.
- [x] New behavior has deterministic regression coverage.
- [x] `z-old.json` and `a-new.json` prove filename ordering cannot choose latest run.
- [x] Verification Evidence selects `a-new` as latest run based on timestamps.
- [x] `npm test` passes.
- [x] `npm run check:structure` passes with no errors.
- [x] No material architecture/security/cost expansion is introduced.

## Open Questions

None.

## Review Gate

This specification is ready for independent reviewer validation against the Context Pack, current code, tests, and module registry.
