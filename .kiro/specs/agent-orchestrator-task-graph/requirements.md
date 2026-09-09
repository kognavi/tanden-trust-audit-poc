# Agent Orchestrator / Task Graph Requirements

## Source Context Pack

- `knowledge/20-research/loop-009-context.md`
- Context ID: `loop-009-context`

## Purpose

Multi-Agent Delegationを実行順序・retry・failure routingまで拡張し、agent workflowをdeterministicなTask Graphとして管理する。

## Current Implementation Truth

- `agent-delegation.json` がBuilder / Reviewer / Security Reviewer role provenanceを保持する。
- Verification Gateがreview artifactとdelegation identityを検証する。
- 実行順序、retry、terminal stateを管理するorchestratorはまだない。

## Requirements

- Node.js標準機能のみで実装する。
- `npm run agent:graph:init -- <feature-slug> [max-retries]` を提供する。
- `npm run agent:graph:event -- <feature-slug> <event>` を提供する。
- `.kiro/specs/<feature>/agent-task-graph.json` を生成・更新する。
- delegation artifactが存在しなければinitをfailする。
- graphにfeature / roles / maxRetries / retryCount / status / tasks / historyを含める。
- Builder PASS前にReviewer PASS/FAIL eventを拒否する。
- Reviewer FAILでBuilderをREADYに戻しretryCountを増やす。
- delegated Security Reviewerがある場合、Reviewer PASS後にSecurity ReviewerをREADYにする。
- Security Reviewerがない場合、Reviewer PASS後にVerificationをREADYにする。
- Security Reviewer FAILでBuilder retryへ戻す。
- Verification FAILでBuilder retryへ戻す。
- retryCountがmaxRetriesを超える場合graphをFAILED terminal stateにする。
- Verification Gateはagent-task-graph.jsonを読み、Verification taskがREADYでない場合failする。
- Verification Evidenceへorchestrator status / retryCount / task statesを含める。
- Verification PASSでgraphをCOMPLETE terminal stateにする。
- COMPLETE/FAILED後のstate-changing eventを拒否する。
- external AI API、agent spawning、merge、deployを実行しない。

## Invariants

- task orderを飛び越えない。
- role provenanceはdelegation artifactから継承する。
- Human Approval境界を維持する。
- product trust boundaryを変更しない。

## Acceptance Criteria

- initでBuilder READY、後続task BLOCKEDが生成される。
- valid eventで期待どおりstate transitionする。
- out-of-order eventは拒否される。
- reviewer/security/verification FAILでretry routingする。
- retry上限超過でFAILEDになる。
- Verification PASSでCOMPLETEになる。
- governance docs / tests / package scriptsへ反映される。

## Open Questions

None

## Review Gate

Reviewed for Loop 009 implementation.
