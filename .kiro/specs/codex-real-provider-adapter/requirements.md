# Codex Real Provider Adapter Requirements

## Source Context Pack
- `knowledge/20-research/loop-011-context.md`
- Context ID: `loop-011-context`

## Purpose

Loop 010のprovider-neutral Runtime Adapterに、最初のreal providerとしてReviewer専用Codex CLI Adapterを接続する。実Providerの副作用と設定ドリフトを抑えながら、provider executionとsemantic review verdictを監査可能に分離する。

## Current Implementation Truth

- Loop 010のcommitted `agent-runtime.json` はdry-run/scripted中心のprovider-neutral contractを持つ。
- Task GraphはREADY task以外の実行を拒否する。
- Verification Evidenceはruntime run summaryを取り込む。
- Real Codex providerはまだcommitted defaultとして有効化しない。

## Requirements

- Loop 010 Runtime contractを拡張する
- real provider typeは `codex-exec-review`
- real providerはReviewer taskのみをサポートする
- Task Graph Reviewer taskがREADYでなければ実行拒否
- provider commandはshellを介さずargument arrayで起動する
- provider commandはRuntime側で `codex` に固定し、local overrideから変更できない
- invocationは `codex exec --json --ephemeral --ignore-user-config --sandbox read-only --output-schema schemas/codex-review-result.schema.json --output-last-message .kiro/specs/codex-real-provider-adapter/agent-runs/.codex-last-UUID.json -`
- promptはstdinで渡す
- promptにはfeature/spec/baseRef/review requirementsを含める
- Reviewerのdefault baseRefは `origin/main` とし、stale local `main` を代用しない
- Verification Evidence GateはReviewer PASS後のdownstream gateであり、未生成であること単独ではReviewer FAIL理由にしない
- prompt/raw response/stdout/stderrはrun evidenceへ保存しない
- prompt/stdout/stderrはSHA-256 digestのみ保存可能
- output schemaはPASS/FAIL verdictを必須とし、Runtime側でもSchemaのadditionalProperties・summary最大2000文字・finding title最大300文字・severityを再検証する
- PASS verdictにHIGHまたはCRITICAL findingが含まれる矛盾outputはinvalid outputとして拒否する
- Codex JSONLからprovider session/thread IDを抽出する
- process timeoutは `TIMEOUT` とし `reviewer-fail` へmapする
- valid PASS/FAIL verdictはTask Graph eventへmapする
- valid PASS/FAIL verdictから `reviewer-review.md` を生成し、Reviewed byをdelegated Reviewer identityと一致させる
- CLI不在/non-zero exit/invalid structured outputは `PROVIDER_ERROR`
- PROVIDER_ERRORではTask Graphを進めない
- run evidenceにprovider/name/sessionId/exitCode/result/verdict/digestsを含める
- Verification Evidenceのruntime summaryにprovider名/session ID/execution statusを含める
- credentials/API key/tokenをEvidenceへ保存しない
- GitHub CIでは実Codexを呼ばずmock runnerでtestする
- committed `agent-runtime.json` はdry-run baselineを維持する
- real provider opt-inはgitignore対象の `agent-runtime.local.json` にのみ保存する
- `agent-runtime.local.json` はReviewerの `codex-exec-review` opt-in専用とし、Builder/Security/Verification adapter overrideを拒否する
- Codex実行時のsandboxは設定値を信用せずコード側でread-onlyを強制する
- merge/deployはHuman Approvalのまま

## Invariants

- committed runtime configだけではreal providerを起動できない
- local runtime overrideはReviewerのCodex opt-in以外のadapter権限を変更できない
- local runtime overrideはCodex実行commandを変更できない
- `codex-exec-review` はReviewer以外に使用できない
- Codex process exit successをsemantic PASSとして扱わない
- Provider errorはTask Graph stateを進めない
- Codex sandboxは常にread-only
- raw provider contentや認証情報をpersistent run evidenceへ保存しない

## Acceptance Criteria

- Codex reviewer PASSがreviewer-passへmapされる
- Codex reviewer FAILがreviewer-failへmapされる
- timeoutがreviewer-failへmapされる
- provider errorはGraphを進めない
- session/thread IDが抽出される
- raw provider outputがrun evidenceに保存されない
- non-reviewer taskはreal provider adapterを拒否する
- committed baselineはdry-runのまま
- local overrideがない状態でCodex providerは起動しない
- local overrideにsandbox改変があってもread-only以外では起動しない
- existing dry-run/scripted behavior remains compatible

## Open Questions
None

## Review Gate
Reviewed for Loop 011 implementation.
