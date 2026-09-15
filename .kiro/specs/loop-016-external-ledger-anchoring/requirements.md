# loop-016-external-ledger-anchoring Requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-016-external-ledger-anchoring-context.md`
- Context ID: `context-pack-loop-016-external-ledger-anchoring`

## Purpose

既存のverified-digest anchoring prototypeを、内部Ledger完了を必須とする追加のexternal proof layerへhardeningし、recomputed digestと最小provenanceだけを外部clientへ渡すlocal-first contractを提供する。

## Current Implementation Truth

- `EvidenceProcessingService`はSchema → Sign → Store → Ledgerを順序どおり完了した場合だけ`ledgerEventId`を返す。
- `VerifiedAnchorService`はEvidence/metadataを再検証し、trusted key resolverをconstructorへ固定し、再計算したnon-zero digestだけをanchor clientへ渡す。
- Existing tests already cover forged verification flags, arbitrary digest injection, unknown key IDs, public-key override, tampering, zero digest, duplicate, RPC read, and transaction failures.
- Missing controls are trusted internal-Ledger confirmation and normalized provider/network/transaction provenance.

## Requirements

- [x] External anchoring remains optional and executes only after `Evidence → Schema → Sign → Store → Ledger` has completed.
- [x] `VerifiedAnchorService` requires constructor-injected `trustedKeyResolver`, `internalLedgerVerifier`, and `anchorClient`; method input cannot override them.
- [x] Public anchoring input is limited to Evidence, signed sidecar metadata, and an internal `ledgerEventId`; it does not accept caller-supplied digest, verification booleans, public key, resolver, ledger verifier, or provider provenance.
- [x] Evidence digest is recomputed through the existing sidecar verifier and signature is verified with the key resolved from signed `metadata.keyId`.
- [x] Unknown key IDs, invalid signature, tampered Evidence/metadata, invalid/zero digest, and invalid metadata fail before internal Ledger or external-client calls where their prerequisite fails.
- [x] A trusted internal Ledger verifier confirms an intact chain and an exact `evidence.stored` event matching `ledgerEventId`, `evidenceId`, and `digestHex` before any external ledger read/write.
- [x] Missing, malformed, mismatched, or unconfirmed internal Ledger records and verifier errors fail closed before any external ledger call.
- [x] `PgSigningLogger` exposes a validated read-only event lookup needed by the trusted verifier without changing append semantics.
- [x] Anchor client provenance is constructor-bound and validated as provider, network, positive chain ID, and contract address; public input cannot alter it.
- [x] Successful transaction output is validated and normalized to transaction hash and block number, then combined with digest, signed key ID, internal ledger event/row hash, and anchor-client provenance in minimal JSON-safe `anchorVerification` evidence.
- [x] Evidence body, metadata body, signature, public/private key, RPC URL, credential, secret, and arbitrary provider response fields are excluded from `anchorVerification`.
- [x] Already-anchored state remains explicit and distinct from RPC-read and transaction-submit failures; failures never roll back completed Store/Ledger state.
- [x] `TrustAnchor.sol` remains unchanged and receives only one non-zero verified bytes32 digest.
- [x] Security Reviewer is mandatory.

## Invariants

- Preserve `Evidence → Schema → Sign → Store → Ledger`; external anchoring is strictly subsequent and cannot replace the internal Ledger.
- Fail closed before external calls on every verification or internal-ledger precondition failure.
- Keep trusted dependencies in the composition boundary, not request data.
- Do not add on-chain Evidence, PII, metadata, signature, key material, or secrets.
- Keep default development local-only and deterministic.
- Preserve all historical Loop artifacts; do not edit Loop 015 artifacts.

## Acceptance Criteria

- [x] Focused tests prove call order: cryptographic verification → internal Ledger confirmation → duplicate read → anchor submit.
- [x] Negative tests prove every invalid/tampered/untrusted/zero/ledger-failure case prevents external calls.
- [x] Tests prove caller attempts to override digest, booleans, resolver, public key, verifier, or provenance are ineffective.
- [x] Tests cover duplicate race, RPC-read failure, transaction-submit failure, malformed anchor state/provenance/receipt, and sanitized success evidence.
- [x] Local Hardhat tests compile and pass without a real wallet, production RPC, deployment, or transaction.
- [x] Spec Readiness, Implementation Conformance, focused tests, full test suite, Security Review, Verification Evidence, and `git diff --check` PASS.
- [x] No real transaction, wallet/private key use, funds/gas/credits/tokens, production RPC connection, deploy, AWS mutation, push, PR, or merge occurs.

## Open Questions

None.

## Review Gate

This Spec authorizes local application code, read-only PostgreSQL ledger lookup code, mocks/tests, and documentation only. It does not authorize any external network call or resource mutation.
