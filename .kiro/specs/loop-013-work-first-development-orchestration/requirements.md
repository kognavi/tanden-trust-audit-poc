# loop-013-work-first-development-orchestration Requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-013-work-first-development-orchestration-context.md`
- Context ID: `context-pack-loop-013-work-first-development-orchestration`

## Purpose

ChatGPT Workをdevelopment control planeとして、review済みImplementation Handoffから既存のDelegation、Task Graph、Runtimeを安全にbootstrapし、durable repository artifactsだけから現在phaseと次に許可されたactionを確認できるようにする。

## Current Implementation Truth

- Spec Readiness、Implementation Handoff、Multi-Agent Delegation、Task Graph、Runtime Adapter、Codex Reviewer、Verification Evidenceは独立したrepository-local controlsとして実装済みである。
- delegation、graph、runtimeの各init commandは個別に実行され、全体のprerequisite、partial state、cross-artifact consistencyを一括検証するentry pointはない。
- committed Runtimeは全task `dry-run` であり、Codex real providerはReviewer-onlyのignored local opt-inである。
- Loop 012Aでは `chatgpt-builder` と `codex-reviewer` の分離、およびTask GraphとVerification Evidenceが実運用された。
- code、tests、`docs/module-registry.md` がcurrent implementation truthであり、Context Packは補助情報である。

## Requirements

- [x] `work:bootstrap` はSpec Readiness PASSとImplementation Handoffの存在・provenance一致を必須とする。
- [x] `work:bootstrap` はdefault roleをBuilder `chatgpt-builder`、Reviewer `codex-reviewer` とし、両者のseparation of dutiesを既存validatorで維持する。
- [x] `work:bootstrap` はDelegation → Task Graph → committed dry-run Runtimeを同一の検証済みrole setから生成する。
- [x] Affected Componentsにsensitive pathが含まれる場合、Security Reviewer identityなしのbootstrapを拒否する。
- [x] delegation、graph、runtime、review、run、verificationの既存またはpartial stateを検出した場合、artifactを上書きせずfail closedとする。
- [x] bootstrapの書き込み失敗時は、このinvocationが新規作成したartifactだけをrollbackし、既存artifactを削除しない。
- [x] `work:status` はpre-bootstrap、active task、COMPLETE、FAILEDをdurable artifactsから決定的に導出する。
- [x] `work:status` はdelegation / graph / runtimeのfeatureとrole provenance drift、partial state、不正なREADY task数を`INCONSISTENT`として報告し、安全な次actionを提示しない。
- [x] Work-first layerはgit操作、provider execution、Task Graph event、tests、verification、merge、deployを自動実行しない。
- [x] Codex ReviewerのReviewer-only、local opt-in、read-only sandbox、structured verdict、provider-error fail-closed semanticsを変更しない。
- [x] 新しいAWS resource、external AI service、dependency、recurring costを追加しない。

## Invariants

- Preserve `Evidence → Schema → Sign → Store → Ledger`.
- WorkはHuman intentとrepository controlsを接続するが、Human Approvalを代替しない。
- Builder → Reviewer → Security Reviewer(optional) → VerificationのTask Graph順序を迂回しない。
- raw prompt、raw response、secret、credential、不要なPIIをorchestration artifactへ保存しない。
- committed Runtimeはdry-run baselineを維持する。
- Local-first / AWS-on-demandを維持する。

## Acceptance Criteria

- [x] reviewed Handoffからbootstrapすると、同一feature/rolesを持つ3つのartifactが生成され、BuilderだけがREADYになる。
- [x] missing/not-ready Spec、missing/mismatched Handoff、既存/partial orchestration stateでは書き込み前に失敗する。
- [x] sensitive scopeはSecurity Reviewerを要求し、non-sensitive scopeではoptionalとする。
- [x] statusが `READY_TO_BOOTSTRAP`、`ACTIVE`、`COMPLETE`、`FAILED`、`INCONSISTENT` を決定的に区別する。
- [x] statusのACTIVE phaseは唯一のREADY taskに対応する次actionを返す。
- [x] focused tests、`npm test`、`npm run check:structure` がPASSする。
- [x] architecture/security/cost boundaryの拡大がない。

## Open Questions

None.

## Review Gate

This specification is ready for independent reviewer validation against the Context Pack, current code, tests, module registry, and existing orchestration contracts.
