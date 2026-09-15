---
id: context-pack-loop-016-external-ledger-anchoring
type: context-pack
status: draft
created: 2026-09-14
updated: 2026-09-14
source:
  - AGENTS.md
  - contracts/AGENTS.md
  - docs/module-registry.md
  - docs/architecture.md
  - docs/architecture-diagram.md
  - docs/evidence-lifecycle.md
  - docs/threat-model.md
  - docs/adr/0004-signing-event-ledger.md
  - lib/evidence-processing-service.js
  - lib/verified-anchor-service.js
  - lib/sidecar-verifier.js
  - lib/pg-signing-logger.js
  - contracts/TrustAnchor.sol
  - scripts/anchor-evidence.js
  - tests/evidence-processing-service.test.js
  - tests/verified-anchor-service.test.js
  - test/TrustAnchor.test.js
supports: []
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: Loop 016 External Ledger Anchoring

## Intent

Tandenの内部trust boundary `Evidence → Schema → Sign → Store → Ledger`を完了したverified Evidenceだけを、追加のexternal proof layerへanchorできるlocal-first contractを整備する。External ledgerは内部Ledgerを置換せず、その後段のoptional boundaryとして扱う。

## Starting Provenance

- Starting branch history includes completed Loop 015 remediation.
- Starting HEAD: `9849d394931b20b96d6a488e735dd4f04bcdb0a6`
- New branch: `feature/loop-016-external-ledger-anchoring`
- Existing prior Loop artifacts remain historical source-of-truth records and are not edited by default.

## Current Implementation Truth

- `EvidenceProcessingService.processEvidence()` enforces Schema → Sign → Store → Ledger and returns `evidenceId`, `version`, recomputed signing digest, store reference, and `ledgerEventId` only after the internal Ledger append succeeds.
- `VerifiedAnchorService.anchorVerifiedEvidence()` validates signed sidecar metadata, resolves `metadata.keyId` through a constructor-injected trusted resolver, reverifies metadata signature and Evidence digest, rejects invalid/zero digests, checks duplicate state, and passes only the recomputed bytes32 digest to an injected `anchorClient`.
- The public method does not accept a verification boolean, digest, resolver, or public key. Extra caller fields are ignored and cannot override constructor dependencies.
- Existing tests already reject unknown key IDs, mismatched trusted keys, attacker public-key injection, tampered Evidence/metadata/signature, signed zero metadata digest, duplicate anchors, read RPC failure, and transaction failure before inappropriate Web3 calls.
- `TrustAnchor.sol` stores only `bytes32 => timestamp`, rejects zero and duplicate digests, and emits `Anchored`. It does not verify off-chain signatures or prove source truth.
- Local Hardhat contract tests cover success/event/timestamp, duplicate rejection, and zero rejection.
- `scripts/anchor-evidence.js` can compose a real Hardhat/Ethers contract client from environment configuration. It is outside default tests and is not safe to execute in this Loop because it may connect to a configured network and submit a transaction.
- Current `VerifiedAnchorService` does not require a trusted assertion that the internal Ledger stage completed. It can therefore anchor a correctly signed/stored-looking Evidence/metadata pair without evidence of the internal `Ledger` step.
- Current success output returns an opaque `transactionResult`; it does not normalize provider, network, chain ID, contract address, transaction hash, block number, and internal ledger reference into an auditable anchor verification record.

## Threats / Risks Addressed

- External anchoring is invoked before internal Ledger completion, silently changing the effective trust order.
- Caller-forged booleans or arbitrary hashes bypass local recomputation and signature verification.
- A caller injects an attacker public key or overrides the trusted key resolver.
- Unknown key IDs, invalid signatures, tampered Evidence/metadata, or invalid/zero digests reach an external client.
- Duplicate state, RPC-read failure, and transaction-submission failure become ambiguous or trigger unsafe retries.
- A transaction hash without provider/network/contract/chain provenance cannot be independently correlated or reproduced.
- External anchor output leaks Evidence, signature, PII, secret, wallet material, or raw provider responses.

## Minimal Design Direction

1. Preserve `VerifiedAnchorService` as the single production-oriented off-chain verification gate.
2. Add a constructor-injected `internalLedgerVerifier` dependency. After cryptographic verification and digest recomputation, but before any `anchorClient` read/write, require it to confirm that the caller-selected `ledgerEventId` resolves through the trusted Ledger reader to an intact `evidence.stored` record with the exact `evidenceId` and `digestHex`. Treat missing/mismatched/malformed records, invalid chain integrity, and verifier errors as fail-closed internal-ledger precondition failures. The signed metadata `keyId` remains independently bound by `TrustedKeyResolver` and is included in the normalized output; the current internal Ledger payload may legitimately have a null local-signing KMS key ID.
3. Keep resolver and ledger-verifier dependencies constructor-bound; the public call accepts only `{ evidence, metadata }` and cannot override them.
4. Require the trusted `anchorClient` composition boundary to expose static provider/network/chain/contract identity without accepting these values from the public call.
5. Validate and normalize the successful transaction result into a minimal `anchorVerification` record containing internal ledger reference plus provider, network, chain ID, contract address, digest, transaction hash, and block number. Do not include Evidence body, metadata body, signature, public key, private key, RPC URL, credentials, or arbitrary provider response fields.
6. Preserve `AlreadyAnchoredError` and `AnchorTransactionError`; make read-state versus submit-transaction operation explicit and testable without changing the no-rollback rule for completed off-chain state.
7. Keep `TrustAnchor.sol` unchanged unless tests identify a contract-level gap. No contract deployment, wallet, RPC, or live transaction is needed.

## Non-goals

- No real blockchain/Web3 transaction, wallet, private key, funds, gas, credits, tokens, production RPC, contract deployment, explorer verification, or network mutation.
- No AWS apply/deploy/IAM/KMS/resource mutation.
- No replacement or rollback of PostgreSQL Ledger, Evidence Store, signed metadata, or the core processing flow.
- No Merkle batching, relayer authorization, multi-chain routing, bridge, oracle, upgradeability, token, or smart-contract access-control expansion.
- No migration of historical anchors and no claim that `block.timestamp` is a trusted timestamp authority.
- No push, PR creation, or merge without explicit Human Approval.

## Affected Components

- `lib/verified-anchor-service.js`
- `lib/internal-ledger-verifier.js`
- `lib/pg-signing-logger.js`
- `tests/verified-anchor-service.test.js`
- `tests/internal-ledger-verifier.test.js`
- `tests/pg-signing-logger.test.js`
- `scripts/anchor-evidence.js`
- `docs/module-registry.md`
- `docs/evidence-lifecycle.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `knowledge/20-research/context-packs/loop-016-external-ledger-anchoring-context.md`
- `knowledge/30-learnings/loop-016-external-ledger-anchoring.md`
- `.kiro/specs/loop-016-external-ledger-anchoring/`

## Security Constraints

- Fail closed before any external ledger call for missing/unconfirmed internal Ledger state, untrusted key ID, invalid signature, tampered Evidence/metadata, and invalid/zero digest.
- Recompute the trusted digest from Evidence; never accept caller-supplied digest or verification flags.
- Do not accept trusted resolver, public key, ledger verifier, provider/network identity, or transaction provenance through `anchorVerifiedEvidence()` input.
- Preserve minimal on-chain payload: one non-zero verified `bytes32` digest only.
- Do not log or store secrets, wallet/private key, RPC URL, Evidence body, metadata body, signature, raw provider response, or unnecessary PII.
- Security Reviewer is mandatory and independent from Builder and Reviewer.

## Validation Targets

- Existing negative anchoring tests remain green.
- New deterministic tests prove internal Ledger confirmation occurs after cryptographic verification but before `getAnchoredAt()` and `anchorDigest()`.
- Missing, false, malformed, mismatched, or throwing internal Ledger confirmation blocks all external-client calls.
- Public-call attempts to override resolver, public key, ledger verifier, digest, booleans, or provenance cannot affect the trusted path.
- Success returns normalized minimal provider/network/transaction/internal-ledger provenance; malformed provenance or transaction receipts fail explicitly.
- Duplicate, RPC-read, and transaction-submit semantics remain distinct and testable.
- Local Hardhat compile/tests run without a configured wallet or production RPC if tooling is available.
- Focused tests, full `npm run check:structure`, Spec Readiness, Implementation Conformance, independent Reviewer, independent Security Reviewer, Verification Evidence Gate, and `git diff --check` PASS.

## Human Approval Boundaries

- Do not run `scripts/anchor-evidence.js`, `scripts/deploy-anchor.js`, or any command configured for Sepolia/production RPC.
- Do not use a real wallet/private key or submit/sign a real transaction.
- Do not spend funds, gas, credits, or tokens.
- Do not deploy contracts or mutate AWS/GitHub resources.
- Stop at `HUMAN_MERGE_DECISION`.

## Review Checklist

- [x] Existing implementation and tests were inspected before proposing new work.
- [x] Already-implemented fail-closed requirements are preserved rather than duplicated.
- [x] Remaining gaps are limited to internal-Ledger ordering enforcement and normalized provenance.
- [x] External anchoring remains optional and strictly after the core trust boundary.
- [x] No live network, wallet, secret, deployment, or mutation is required.
