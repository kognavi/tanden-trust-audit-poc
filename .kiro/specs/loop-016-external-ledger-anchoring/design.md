# loop-016-external-ledger-anchoring Design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-016-external-ledger-anchoring-context.md`
- Context ID: `context-pack-loop-016-external-ledger-anchoring`

## Current State

The verified anchor prototype already performs sidecar schema validation, trusted-key resolution, signature verification, Evidence digest recomputation, zero rejection, duplicate preflight, and explicit Web3 failure mapping. It does not prove the internal Ledger step completed and returns an opaque transaction result without a stable provenance schema.

## Proposed Design

### Ordered external boundary

`VerifiedAnchorService.anchorVerifiedEvidence({ evidence, metadata, ledgerEventId })` performs:

1. validate signed metadata;
2. resolve signed `keyId` through constructor-bound `TrustedKeyResolver`;
3. reverify metadata signature and recompute Evidence SHA-256 digest;
4. reject invalid/zero digest;
5. call constructor-bound `internalLedgerVerifier.verifyRecordedEvidence({ ledgerEventId, evidenceId, digestHex })`;
6. require `{ confirmed: true, eventId, rowHash }` with exact event ID and valid 64-hex row hash;
7. read duplicate state using the recomputed bytes32 digest;
8. submit only that digest;
9. validate and normalize the receipt;
10. return minimal `anchorVerification` provenance.

No request field selects a digest, key, resolver, verifier, provider, network, chain, contract, transaction, or public key.

### Trusted internal Ledger verifier

Add `PgInternalLedgerVerifier` around `PgSigningLogger`. It calls `verifyChainIntegrityAndGetEvent(eventId)`, which verifies the full chain and selects the target from one query result. It confirms event type `evidence.stored` and exact payload `evidenceId`/`digestHex`, returning only confirmation, event ID, and row hash. Missing/mismatch/invalid chain returns a structured unconfirmed result; infrastructure errors are wrapped by `VerifiedAnchorService` as `InternalLedgerVerificationError`.

`PgSigningLogger.verifyChainIntegrityAndGetEvent()` validates the event ID, uses one ordered full-ledger query, and maps the selected row with the existing event shape. It does not alter schema or append behavior. `getEventById()` remains a non-security convenience read.

### Provenance and error contract

The constructor validates `anchorClient.provenance`:

- provider: non-empty string
- network: non-empty string
- chainId: positive integer represented as a decimal string in output
- contractAddress: `0x` plus 40 hex characters

The anchor result requires a 32-byte hex transaction hash and non-negative block number, normalized to strings. `anchorVerification` contains schema version, Evidence ID, digest, signed key ID, internal ledger event/row hash, and external provider/network/chain/contract/transaction/block fields only.

`AnchorTransactionError.operation` distinguishes `read-anchor-state`, `submit-anchor-transaction`, and `validate-transaction-result`. `AlreadyAnchoredError` remains separate for preflight and duplicate-race semantics.

### CLI boundary

Update `scripts/anchor-evidence.js` composition to require internal Ledger connection/event configuration and construct the verifier, while retaining environment-only secrets and static configured network provenance. This script is not executed in Loop 016. No RPC discovery is performed before the service's verification and Ledger gates.

## Affected Components

- `lib/verified-anchor-service.js`
- `lib/internal-ledger-verifier.js`
- `lib/pg-signing-logger.js`
- `tests/verified-anchor-service.test.js`
- `tests/internal-ledger-verifier.test.js`
- `tests/pg-signing-logger.test.js`
- `tests/anchor-evidence-script.test.js`
- `scripts/anchor-evidence.js`
- `docs/module-registry.md`
- `docs/evidence-lifecycle.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `knowledge/20-research/context-packs/loop-016-external-ledger-anchoring-context.md`
- `knowledge/30-learnings/loop-016-external-ledger-anchoring.md`
- `.kiro/specs/loop-016-external-ledger-anchoring/`

## Trust Boundary Impact

- Core: `Evidence → Schema → Sign → Store → Ledger` unchanged.
- New optional edge: `Ledger → verified external digest anchor`.
- External failure never reverses or rewrites core state.

## Security

- Trusted dependencies are constructor-bound; public input cannot override them.
- PostgreSQL reads are parameterized and read-only.
- Only recomputed digest reaches the external client/contract.
- Output is allowlisted and JSON-safe; no Evidence, signature, keys, secrets, RPC URLs, or raw responses.
- Smart contract remains unchanged, so no new storage, external call, reentrancy, upgrade, access-control, or gas surface is introduced.
- Public contract anchoring still does not prove submitter identity; off-chain verification provenance is the authoritative application record.

## Cost and Operations

- Automated work uses mocks and local Hardhat only: no gas, funds, tokens, RPC credits, or AWS cost.
- Full-chain integrity verification is intentionally conservative and may be O(n); production-scale indexing/checkpointing is a future optimization and must not weaken integrity.
- Real DB/RPC/wallet/deployment operations remain Human Approval boundaries.

## Alternatives Considered

- Trust caller-supplied processing booleans/receipt: rejected as forgeable.
- Accept a public key in method input: rejected because it defeats trusted key binding.
- Anchor directly from `EvidenceProcessingService`: rejected because external failure must remain optional and must not change core success/rollback semantics.
- Modify `TrustAnchor.sol` to verify signatures: rejected due key-format, gas, privacy, and trust-complexity expansion.
- Merkle batching or multi-chain routing: deferred as out of minimal scope.

## Validation Plan

- `node --test tests/verified-anchor-service.test.js tests/internal-ledger-verifier.test.js tests/pg-signing-logger.test.js`
- `npm run check:structure`
- `npx hardhat test --network hardhat`
- `npm run spec:ready -- loop-016-external-ledger-anchoring`
- `npm run impl:conform -- loop-016-external-ledger-anchoring 9849d394931b20b96d6a488e735dd4f04bcdb0a6`
- `git diff --check`
- independent Reviewer, independent Security Reviewer, Verification Evidence Gate

## Review Checklist

- [x] Design reuses existing verified anchor and Ledger modules.
- [x] Core/internal/external boundaries and failure ordering are explicit.
- [x] Caller-controlled trust inputs are rejected.
- [x] Provenance is minimal, normalized, and non-secret.
- [x] Contract/security/cost/operation implications are explicit.
- [x] Human Approval boundaries prohibit every live mutation.
