---
id: loop-011-codex-real-provider-adapter
type: idea
status: inbox
created: 2026-09-10
updated: 2026-09-10
source: []
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 011 - Codex Real Provider Adapter

## Goal

Loop 010のprovider-neutral Runtime Adapterに、最初の実providerとしてCodex CLI Reviewer Adapterを接続する。

## Boundary

- 対象taskはReviewerのみ
- `codex exec` を非対話subprocessとして使用
- sandboxはread-only
- final verdictはJSON SchemaでPASS / FAILを強制
- provider process failureとreview FAILを区別
- stdout/stderr/raw responseはEvidenceへ保存しない
- provider session/thread IDとdigestのみ保存
- timeout時はTask Graph failure routingへ接続
- merge/deployはHuman Approval
