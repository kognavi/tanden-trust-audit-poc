---
id: loop-010-agent-runtime-adapter
type: idea
status: inbox
created: 2026-09-09
updated: 2026-09-09
source: []
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 010 - Agent Runtime Adapter

## Goal

Loop 009 Task GraphのREADY taskをprovider-neutralなRuntime Adapterへ接続し、run evidenceと結果→Task Graph event mappingを標準化する。

## Constraints

- defaultはexternal AI providerを呼ばない
- dry-runはTask Graphを進めない
- scripted adapterはtest専用
- runtime resultはPASS / FAIL / TIMEOUT
- run evidenceをrepository artifactとして残す
- merge / deployはHuman Approvalに残す
