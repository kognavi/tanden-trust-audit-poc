---
id: loop-008-context
type: research
status: reviewed
created: 2026-09-09
updated: 2026-09-09
source:
  - knowledge/30-learnings/loop-007-verification-evidence-gate.md
  - .kiro/agents/developer.md
  - .kiro/agents/security-reviewer.md
  - scripts/run-verification-evidence-gate.js
supports:
  - loop-008-multi-agent-delegation
contradicts: []
supersedes: []
reviewed_by:
  - codex
---

# Loop 008 Context

## Current gap

Loop 007はverification evidenceを標準化したが、誰が実装し、誰が独立reviewしたかのrole provenanceをmachine-readableに固定していない。

既存のDeveloperとSecurity Reviewerは役割分離の意図を持つが、BuilderとReviewerのidentity separationをGateが機械検証していない。

## Decision

初版Multi-Agent Delegationはprovider-specific orchestrationではなく、portableなdelegation contractから始める。

feature Spec directoryに以下を置く。

- `agent-delegation.json`
- `reviewer-review.md`
- sensitive change時のみ `security-review.md`

Verification & Evidence Gateはこれらを読み、role separationとPASS review evidenceを検証する。

## Rationale

Agent自動spawnや複雑なgraph orchestrationを先に導入すると、provider coupling、debug complexity、cost、failure modeが増える。

まずrole contractとevidenceを固定し、その後のLoopで実行orchestratorへ拡張する方が安全で説明可能。
