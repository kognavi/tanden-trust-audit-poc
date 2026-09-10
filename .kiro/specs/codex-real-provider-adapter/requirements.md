# Codex Real Provider Adapter Requirements

## Source Context Pack
- `knowledge/20-research/loop-011-context.md`
- Context ID: `loop-011-context`

## Requirements

- Loop 010 Runtime contractを拡張する
- real provider typeは `codex-exec-review`
- real providerはReviewer taskのみをサポートする
- Task Graph Reviewer taskがREADYでなければ実行拒否
- provider commandはshellを介さずargument arrayで起動する
- command defaultは `codex`
- invocationは `codex exec --json --sandbox read-only --output-schema <schema> --output-last-message <file> -`
- promptはstdinで渡す
- promptにはfeature/spec/baseRef/review requirementsを含める
- prompt/raw response/stdout/stderrはrun evidenceへ保存しない
- prompt/stdout/stderrはSHA-256 digestのみ保存可能
- output schemaはPASS/FAIL verdictを必須とする
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
- real provider実行はlocal opt-in configでのみ有効化する
- merge/deployはHuman Approvalのまま

## Acceptance Criteria

- Codex reviewer PASSがreviewer-passへmapされる
- Codex reviewer FAILがreviewer-failへmapされる
- timeoutがreviewer-failへmapされる
- provider errorはGraphを進めない
- session/thread IDが抽出される
- raw provider outputがrun evidenceに保存されない
- non-reviewer taskはreal provider adapterを拒否する
- existing dry-run/scripted behavior remains compatible

## Open Questions
None

## Review Gate
Reviewed for Loop 011 implementation.
