---
id: learning-loop-016-external-ledger-anchoring
type: learning
status: draft
created: 2026-09-14
updated: 2026-09-14
source:
  - knowledge/20-research/context-packs/loop-016-external-ledger-anchoring-context.md
  - .kiro/specs/loop-016-external-ledger-anchoring/design.md
  - lib/verified-anchor-service.js
  - lib/internal-ledger-verifier.js
supports:
  - context-pack-loop-016-external-ledger-anchoring
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 016 - External Ledger Anchoring Learning

## What became clearer

- External anchoring is a downstream corroboration step, not a replacement for the internal Store or append-only Ledger.
- A signed sidecar alone does not establish that the verified Evidence completed the internal Ledger step. The anchor gate must bind the recomputed digest to an exact `evidence.stored` event after full-chain verification.
- Caller-supplied booleans, digests, public keys, resolvers, or provider metadata cannot be security decisions. Trust dependencies and external provenance belong to deployment composition.
- Duplicate pre-checks do not eliminate races. A contract duplicate after a successful read needs the same explicit already-anchored classification.
- Read failures, submit failures, and malformed transaction results require separate machine-testable operation labels.

## Accepted trade-offs

- The existing digest-only contract remains unchanged; Loop 016 hardens the application gate and provenance boundary.
- Chain ID and block number are normalized as decimal strings for JSON-safe evidence.
- Full internal hash-chain verification is intentionally performed before each external call. This favors audit confidence over throughput in the minimal prototype.
- The CLI requires explicit network/chain/contract configuration rather than discovering provenance after external access.

## Validation boundary

- Unit and integration tests use fakes; contract checks use only the local Hardhat network.
- No result from this Loop proves production RPC availability, funded-wallet behavior, contract deployment, or external-ledger finality.
- Transaction and block identifiers are correlation provenance, not a trusted timestamp or proof that the source event was truthful.

## Next action

Independent Reviewer and Security Reviewer must confirm fail-closed ordering, trust dependency binding, duplicate/failure semantics, provenance minimization, and the absence of real transaction/deployment activity before Verification Evidence is generated.
