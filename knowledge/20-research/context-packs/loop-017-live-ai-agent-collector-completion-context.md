---
id: context-pack-loop-017-live-ai-agent-collector-completion
type: context-pack
status: draft
created: 2026-09-15
updated: 2026-09-15
source:
  - AGENTS.md
  - lib/AGENTS.md
  - docs/ai-development-os.md
  - docs/work-first-development-orchestration.md
  - docs/module-registry.md
  - docs/roadmap.md
  - docs/agentcore-live-demo.md
  - docs/agentcore-runtime-deploy.md
  - .kiro/specs/live-agent-collector-local-first/requirements.md
  - .kiro/specs/live-agent-collector-local-first/design.md
  - .kiro/specs/live-agent-collector-local-first/tasks.md
  - schemas/normalized-agent-event.schema.json
  - schemas/ai-agent-evidence.schema.json
  - lib/collectors/fixture-agent-collector.js
  - lib/collectors/bedrock-agentcore-collector.js
  - lib/ai-agent-evidence-mapper.js
  - lib/agentcore-live-demo.js
  - lib/evidence-processing-service.js
  - scripts/process-agentcore-live-response.js
  - app/TandenEvidenceDemo/main.ts
  - .github/workflows/agentcore-live-demo.yml
  - tests/fixture-agent-collector.test.js
  - tests/ai-agent-collector-e2e.test.js
  - tests/bedrock-agentcore-collector.test.js
  - tests/agentcore-live-demo.test.js
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: Loop 017 Live AI Agent Collector Completion

## Intent

Phase Bのlocal-first collector/mapperを維持したまま、Amazon Bedrock AgentCoreの合成tool-call responseが `runtime event → normalized agent event → AI Agent Evidence → Schema → Sign → Store → Ledger → Store reload verification` を通ることを監査可能にする。実AWS invocationの前提となるローカル実装と検証を完了し、実呼び出し自体はHuman Approval境界に置く。

## Starting Provenance

- Starting branch: `origin/main`
- Starting HEAD: `08ed70e8e2ffc9582ad0d03994d9ea9187bac811` (`Loop 016: External ledger anchoring (#179)`)
- New branch: `feature/loop-017-live-ai-agent-collector-completion`
- Loop 015/016を含む過去のFAILED/COMPLETE artifactは変更しない。
- 旧 `.kiro/specs/live-agent-collector-local-first/` は現行実装の経緯とPhase B-1/B-2境界を示す参考資料であり、Loop 017の新Specを置換しない。

## Current Implementation Truth

- `FixtureAgentCollector` と `BedrockAgentCoreCollector` は、同じNormalized Agent Event schemaと `mapNormalizedAgentEventToEvidence()` を使用する。
- focused baseline (`fixture-agent-collector`, `ai-agent-collector-e2e`, `bedrock-agentcore-collector`, `agentcore-live-demo`) はAWS-freeで10/10 PASSする。
- `BedrockAgentCoreCollector` はRuntime responseのtop-level model textを無視し、validated `auditEvent`だけをcloneし、invocation session/trace不一致をEvidence処理前にfail closedで拒否する。
- mapperはactor / agent / model / execution / policy / action(tool) / approval / sideEffect / references / artifacts / metadataをcloneしてAI Agent Evidenceへ保存する。
- `EvidenceProcessingService` は `Schema → Sign → Store → Ledger` の順序を実装し、Store成功後のLedger failureでは保存済みEvidenceをrollbackしない。
- `runAgentCoreLiveDemo()` はLocal ECDSA、ローカルtest Store、ローカルtest Ledgerを用いて既存canonical processing pathを実行し、original signature PASS / tampered Evidence FAILを確認する。
- ただし現在のtest Storeは `appendEvidence()` だけで、署名検証はappend時にcaptureした変数を直接使用する。Storeの `getEvidenceVersion()` 相当から再読込したEvidenceを検証していないため、primary goalのreload verificationは未証明である。
- 現在のtest Ledgerはappendを受け付けてIDを返すが、Store append、Ledger append、Store reload、signature verifyの順序を回帰テストで固定していない。
- `app/TandenEvidenceDemo/main.ts` は合成データ専用toolをexactly onceで呼び出し、actor / agent / model / policy / action / approval / side-effectを含むNormalized Agent Eventをtrusted tool callbackから生成する。request/runtime-session mismatchとtool-call回数不一致はfail closedである。
- manual workflowはOIDC roleで既存AgentCore Runtimeを1回だけinvokeし、raw request/responseを一時runnerから削除し、sanitized summaryだけを公開する。自動trigger、deploy、resource creationは含まない。
- 実AWS Runtime invocationはまだ実施されておらず、Human Approvalなしでは実施しない。

## Concrete Gap

1. Live-adapter preflightはStoreへ渡した値を検証しており、Storeから再取得したimmutable recordを検証していない。
2. Store → Ledger → reload → verifyの順序と、再読込recordが欠落・identity不一致・digest/signature不整合の場合のfail-closed semanticsが明文化・テストされていない。
3. live summaryはreload verificationの成否を区別しておらず、actor / agent / model mapping preservationも回帰テストで明示していない。
4. 一部のarchitecture/profile documentationにはcollectorがfuture workという古い記述が残る。実装source of truthに合わせた最小更新が必要である。
5. Verification Evidence Gateはpath heuristicがsensitive fileを検出した場合だけSecurity Review artifactを読むため、明示的にSecurity Reviewerを委任しTask GraphがPASSでもEvidenceへ`N/A`と記録する。Security Reviewer必須Loopではprovenance不整合となる。

## Minimal Design Direction

1. Evidence model、Normalized Agent Event schema、mapper、`EvidenceProcessingService`を変更しない。
2. `runAgentCoreLiveDemo()` 内のdeterministic local Storeを、append-only identity/version guardと `getEvidenceVersion(evidenceId, version)` を持つdemo test doubleへ強化する。
3. `processEvidence()` がStoreとLedgerを完了した後、resultのidentity/versionを使ってStoreからrecordを再読込し、そのreloaded Evidence、signature、digestを検証する。missing/mismatched/tampered recordはfail closedにする。
4. summaryはsecret/raw payloadを増やさず、reload verificationとcanonical stage completionを最小のstatus/provenanceで表現する。
5. testsでcanonical order、reloaded recordの使用、全主要mappingの保持、top-level/raw prompt除外、identity/digest/signature tamper拒否を固定する。
6. AgentCore Runtime application、IAM/CDK、live workflowのAWS invocation semanticsは具体的blockerがない限り変更しない。Node/runtimeやCLI差分はlocal static checkで確認できる範囲に留める。
7. Verification Gateはsensitive-path検出に加え、Security Reviewerが明示的に委任されている場合もPASS artifactと委任identityを必須化してEvidenceへ記録する。

## Security Constraints

- raw prompt、raw model response、credentials、OIDC token、AWS account/Runtime ARN、secret、customer data、不要なPIIをEvidence、summary、fixture、log、Verification Evidenceへ保存しない。
- events marked `containsPersonalData: true` or `containsSecrets: true` must fail before signing/storage/ledger.
- live responseはfixtureと同じNormalized Agent Event validationおよびmapper pathを使い、別のlive-only Evidence constructionを作らない。
- session/trace correlationをEvidence処理前にfail closedで検証する。
- verificationはStoreから再読込したcanonical Evidenceを対象とし、caller-supplied verification booleanやdigestを信頼しない。
- `Evidence → Schema → Sign → Store → Ledger` の順序とboundaryを変更しない。
- Security Reviewerは必須で、Builder/Reviewerと独立させる。

## Non-goals

- AI Agent Evidence model、normalized schema、signing contract、internal Ledger schemaの再設計。
- production collector、streaming/multi-event ingestion、queue、retry orchestration、persistent demo database。
- raw prompt/model response保存、real customer/PII/secret data使用。
- Runtime deploy、AWS resource作成、Terraform apply、IAM/KMS mutation、RDS/Aurora、NAT Gateway、ECS/EC2、OpenSearch、provisioned throughput。
- blockchain transaction、external anchor operation、wallet/private-key、RPC mutation。
- GitHub push、PR、merge。

## Affected Components

- `lib/agentcore-live-demo.js`
- `tests/agentcore-live-demo.test.js`
- `tests/bedrock-agentcore-collector.test.js`（必要な回帰のみ）
- `docs/agentcore-live-demo.md`
- `docs/module-registry.md`
- `docs/evidence-lifecycle.md`（stale cross-referenceのみ）
- `docs/ai-agent-evidence-profile.md`（stale cross-referenceのみ）
- `docs/architecture-diagram.md`（stale cross-referenceのみ）
- `docs/roadmap.md`
- `scripts/run-verification-evidence-gate.js`
- `tests/verification-evidence-gate.test.js`
- `knowledge/30-learnings/loop-017-live-ai-agent-collector-completion.md`
- `.kiro/specs/loop-017-live-ai-agent-collector-completion/`

## Validation Targets

- Spec Readiness and Implementation Conformance PASS.
- Existing local fixture/mapper focused tests remain PASS.
- New live-adapter tests prove preserved actor / agent / model / policy / tool / approval / side-effect mapping.
- Tests prove Store append → Ledger append → Store reload → reloaded signature/digest verification and tamper failure.
- Tests prove top-level response text/raw prompt/secret/PII are not persisted or emitted.
- Full `npm run check:structure`, architecture checks, `git diff --check`, independent Reviewer, independent Security Reviewer, and Verification Evidence Gate PASS.
- AgentCore app typecheck and CDK synth/static checks run locally when installed tooling is available; unavailable tooling is reported rather than bypassed.
- No AWS API call is made during validation.

## Human Approval Boundary

- Local implementation/reviews/Verification Evidence must all PASS before a real Runtime invocation can be considered.
- If an actual AgentCore invocation remains necessary to complete Phase B, stop at `HUMAN_AWS_DEMO_DECISION` and report service, expected cost, credentials/profile, region, resources, data, and cleanup.
- Human Approval does not authorize deploy, IAM/KMS mutation, resource creation, persistent AWS resources, external anchoring, push, PR, or merge unless separately explicit.

## Review Checklist

- [x] Current code, tests, module registry, prior spec, Runtime app, and manual workflow were inspected.
- [x] Existing fixture/local collector baseline was rerun AWS-free and passed 10/10.
- [x] Concrete gap is limited to reload verification, ordering proof, mapping regression, and stale documentation.
- [x] Existing Evidence model and trust boundary remain unchanged.
- [x] Security Reviewer and Human AWS demo boundary are explicit.
