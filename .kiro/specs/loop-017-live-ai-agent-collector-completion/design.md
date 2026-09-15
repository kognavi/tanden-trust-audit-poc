# loop-017-live-ai-agent-collector-completion Design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md`
- Context ID: `context-pack-loop-017-live-ai-agent-collector-completion`

## Current State

The fixture and AgentCore adapters already converge on the same Normalized Agent Event validator, mapper, and `EvidenceProcessingService`. The live demo validates session/trace correlation, signs and appends Evidence, records an internal Ledger event, then checks original/tampered signatures. Its verification input is the value captured during `appendEvidence()`, not a record reloaded from the Store, so the end-to-end reload claim is incomplete.

## Proposed Design

### Canonical processing and reload

Retain `BedrockAgentCoreCollector`, `mapNormalizedAgentEventToEvidence()`, and `EvidenceProcessingService` unchanged. `runAgentCoreLiveDemo()` will:

1. collect and validate only the response `auditEvent`;
2. reject `containsPersonalData` or `containsSecrets` before processing;
3. map through the existing mapper;
4. process through Schema → Local ECDSA Sign → local demo Store append → local demo Ledger append;
5. reload by the returned `evidenceId` and `version` from the local demo Store;
6. require an exact identity/version/digest match;
7. verify the reloaded Evidence and stored signature with the ephemeral public key;
8. verify a tampered clone fails;
9. return only an allowlisted, sanitized summary.

### Deterministic local Store and Ledger

Keep the test doubles private to the live-demo application module. The Store keys immutable records by `evidenceId:version`, rejects duplicates, clones on append/read, and exposes `getEvidenceVersion()`. The Ledger records only the existing `evidence.stored` request and returns a deterministic event ID. Both append stages record a private stage trace used to enforce and report order without exposing Evidence contents.

The reload verifier rejects a missing/non-object record, mismatched evidence ID/version/digest, missing Evidence/signature, an invalid signature, or a reloaded Evidence whose recomputed digest does not match the processing result. Error codes remain stage-specific and contain no raw payload.

### Mapping and output

Tests compare all required mapping objects between the validated Runtime audit event and the stored/reloaded AI Agent Evidence. The summary includes only source/region/qualifier, hashed Runtime ARN, session/trace IDs, Evidence/tool/policy/approval/side-effect identifiers, digest, Ledger event ID, stage statuses, and data-minimization booleans. It excludes actor principal details and Evidence bodies even though mapping preservation is tested internally.

### AWS decision boundary

No live invocation is required to implement or validate this change. Once local gates, Reviewer, Security Reviewer, and Verification Evidence pass, Loop 017 stops at `HUMAN_AWS_DEMO_DECISION`. A future approved action may run the existing manual workflow exactly once against an existing Runtime; no deploy/resource creation is included.

### Security-review provenance gate

The first Verification Evidence attempt exposed a governance mismatch: an explicitly delegated and completed Security Review was serialized as `N/A` because no changed path matched the generic sensitive-path heuristic. The Gate will require and record `security-review.md` when either sensitive paths exist or a Security Reviewer is delegated. Existing behavior for undelegated, non-sensitive work remains unchanged. A deterministic regression covers delegated/no-sensitive-path PASS and missing-review failure.

## Affected Components

- `lib/agentcore-live-demo.js`
- `tests/agentcore-live-demo.test.js`
- `tests/bedrock-agentcore-collector.test.js`
- `docs/agentcore-live-demo.md`
- `docs/module-registry.md`
- `docs/evidence-lifecycle.md`
- `docs/ai-agent-evidence-profile.md`
- `docs/architecture-diagram.md`
- `docs/roadmap.md`
- `scripts/run-verification-evidence-gate.js`
- `tests/verification-evidence-gate.test.js`
- `knowledge/20-research/context-packs/loop-017-live-ai-agent-collector-completion-context.md`
- `knowledge/30-learnings/loop-017-live-ai-agent-collector-completion.md`
- `.kiro/specs/loop-017-live-ai-agent-collector-completion/`

## Trust Boundary Impact

- `Evidence → Schema → Sign → Store → Ledger`: unchanged.
- New proof edge: `Ledger completion → Store reload → local verification`.
- Reload never rewrites Store or Ledger and cannot convert a failed prior stage into success.

## Security

- IAM / KMS impact: none; local ephemeral ECDSA only, no credential or key persistence.
- Secret / PII impact: events declaring PII or secrets are rejected before processing; output remains allowlisted.
- Auditability impact: explicit stage order and reload status close the gap between append input and persisted record verification.
- Runtime response and prompt remain ephemeral workflow files deleted with `if: always()`; top-level model text is ignored by the collector.
- Security Reviewer is mandatory.

## Cost and Operations

- Local implementation and validation perform no AWS calls and have no AWS cost.
- A future approved demo would invoke one existing Amazon Bedrock AgentCore Runtime and its configured Bedrock model once; it can incur usage-based Runtime/model charges.
- No RDS/Aurora, NAT Gateway, ECS/EC2, OpenSearch, provisioned throughput, deploy, IAM/KMS mutation, Terraform apply, or persistent resource is introduced.
- The existing Runtime, if human-provisioned separately, is outside this Loop's creation/cleanup authority.

## Alternatives Considered

- Verify the append input variable: rejected because it does not prove Store reload integrity.
- Add PostgreSQL to the one-shot demo: rejected because a deterministic local Store proves the application contract without database/AWS setup or cost.
- Redesign Evidence/schema for AgentCore fields: rejected because current normalized mapping already preserves the required semantics.
- Persist the raw response for debugging: rejected due prompt/model/secret/PII exposure risk.
- Automatically invoke AWS after tests: rejected because explicit Human Approval is required.

## Validation Plan

- `npm run spec:ready -- loop-017-live-ai-agent-collector-completion`
- `node --test tests/fixture-agent-collector.test.js tests/ai-agent-collector-e2e.test.js tests/bedrock-agentcore-collector.test.js tests/agentcore-live-demo.test.js`
- AgentCore application typecheck using its lockfile/dependencies if available.
- AWS-free AgentCore/CDK static or synth checks available in the environment; no deploy command.
- `npm run check:structure`
- `npm run impl:conform -- loop-017-live-ai-agent-collector-completion 08ed70e8e2ffc9582ad0d03994d9ea9187bac811`
- independent Reviewer, independent Security Reviewer, Verification Evidence Gate
- `git diff --check`
- `node --test tests/verification-evidence-gate.test.js`

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims were checked against code/tests/module registry and Runtime/workflow assets.
- [x] Trust boundary impact is explicit and preserves the canonical sequence.
- [x] Security, data minimization, AWS cost, and operations are explicit.
- [x] Human Approval boundary requires stopping before any live AWS invocation.
