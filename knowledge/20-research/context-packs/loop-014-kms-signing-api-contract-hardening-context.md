---
id: context-pack-loop-014-kms-signing-api-contract-hardening
type: context-pack
status: draft
created: 2026-09-14
updated: 2026-09-14
source:
  - knowledge/00-inbox/loop-014-kms-signing-api-contract-hardening.md
  - AGENTS.md
  - lib/aws-kms-provider.js
  - lib/local-ecdsa-provider.js
  - lib/signature.js
  - lib/metadata-signature.js
  - scripts/test-kms-signing.js
  - docs/module-registry.md
  - tests/aws-kms-provider.test.js
  - tests/local-ecdsa-provider.test.js
  - tests/cross-provider-parity.test.js
  - tests/metadata-signature.test.js
  - docs/aws-kms-signing-design.md
  - docs/signature-provider-design.md
  - .kiro/specs/kms-blockchain-tx-signing/requirements.md
  - .kiro/specs/kms-blockchain-tx-signing/tasks.md
supports:
  - loop-014-kms-signing-api-contract-hardening
contradicts: []
supersedes: []
reviewed_by: []
---

# Context Pack: loop-014-kms-signing-api-contract-hardening

## Intent

AWS KMSとLocal ECDSA providerの低レベル署名APIについて、raw messageとdigestの境界、hashing回数、algorithm、curve、encoding、KeySpec、backward compatibilityを明示的で誤用しにくいcontractとして固定する。

Source inbox: `knowledge/00-inbox/loop-014-kms-signing-api-contract-hardening.md`

## Current Implementation Truth

- `AwsKmsProvider.signDigest(message)` と `verifyDigestSignature(message, signature)` は、名称に反してprecomputed digestではなくraw canonical message bytesを受け取る。
- AWS KMS Sign/Verifyは `SigningAlgorithm: ECDSA_SHA_256`、`MessageType: RAW` を使用し、KMS内部でSHA-256を一度適用する。
- `LocalEcdsaProvider` は `crypto.sign('sha256', message, ...)` / `crypto.verify('sha256', message, ...)` を使用し、同じraw messageを一度hashする。
- Local/KMSともに`secp256k1`を使用する。AWS KMS側の必須KeySpecは`ECC_SECG_P256K1`であり、`GetPublicKey`結果を最初の操作前に検査する。
- provider間の保存・受け渡しsignature形式は64-byte IEEE P1363 `r || s`。KMS API境界ではASN.1 DERへ相互変換する。
- `signEvidence` / `verifyEvidenceSignature` はRFC 8785 canonical JSONのUTF-8 bytesを低レベルAPIへ渡し、別途計算したSHA-256 `digestHex`をmetadataとして返す。
- `lib/signature.js` のwrapper引数名は依然`digest`であり、現行raw-message contractと一致しない。
- `lib/metadata-signature.js` もproviderの`signDigest` / `verifyDigestSignature`をraw canonical metadata bytesで呼び出している。
- `tests/cross-provider-parity.test.js` はLocal/KMSが同じcanonical bytesを一度だけhashすることを検証するが、低レベルAPIの命名・入力validation・移行契約は固定していない。
- `docs/module-registry.md` はLocal providerを「P-256」と記載しており、実コードの`secp256k1`と不一致である。

## Problem

現在のhashing動作は正しいが、`signDigest` / `verifyDigestSignature`という名称がraw-message contractと矛盾する。将来の呼び出し元がprecomputed SHA-256 digestを渡すと、LocalとKMSの両方でそのdigestをさらにSHA-256処理し、意図した署名対象と異なる値を署名する。コメントと一部テストだけでは、このsecurity contractを長期的に保証できない。

## Candidate Design Direction

- raw message専用の明確なAPI名を追加し、high-level codeをそのAPIへ移行する。
- 既存の`signDigest` / `verifyDigestSignature`はbackward compatibilityのため直ちに削除せず、deprecated aliasとして同じraw-message semanticsを維持する。
- digest専用APIは、AWS KMS `MessageType: DIGEST`との混在リスクを増やすため、このLoopでは追加しない。
- provider contract constantsと入力validationを共有し、Local/KMS双方でraw message、signature length、algorithm、curve、encodingの前提をfail closedにする。
- 実装詳細は新Specで確定し、Context Pack自体をimplementation truthにしない。

## Repository Rules

- `AGENTS.md` must be read before implementation.
- code / tests / module registry remain current implementation truth.

## Related Files

- `lib/aws-kms-provider.js`: KMS RAW signing、KeySpec enforcement、DER/P1363変換。
- `lib/local-ecdsa-provider.js`: local secp256k1 signingとKMS互換のsingle-hash semantics。
- `lib/signature.js`: backward-compatible facade。低レベルwrapperの引数名がstale。
- `lib/metadata-signature.js`: provider低レベルAPIの既存consumer。
- `scripts/test-kms-signing.js`: manual real-KMS smoke test。実行はHuman Approval境界だがAPI call siteは現行contractへ合わせる。
- `docs/module-registry.md`: canonical index。Local curve記述の修正が必要。
- `tests/aws-kms-provider.test.js`: KMS commands、RAW mode、KeySpec、encoding、error semantics。
- `tests/cross-provider-parity.test.js`: provider間のsingle-hash parity。
- `.kiro/specs/kms-blockchain-tx-signing/`: historical reference only。現行実装source of truthではなく、taskを再開しない。

## Extracted Constraints

- Preserve Evidence -> Schema -> Sign -> Store -> Ledger.
- Keep Local-first / AWS-on-demand.
- Do not add AWS resources or external AI services for Context Pack generation.
- Do not store raw prompts, raw responses, secrets, credentials, or unnecessary PII.
- Context Pack is supporting context, not a replacement for code/tests/module registry.
- Human or independent Agent review remains required before implementation decisions are treated as approved.
- Security Reviewer is mandatory because the change affects cryptographic API boundaries.
- Preserve `MessageType: RAW` and exactly-one SHA-256 processing across Sign and Verify.
- Do not revive or execute the old `kms-blockchain-tx-signing` Plan or any stash.
- Do not call real AWS APIs or modify AWS resources, IAM, KMS keys, or KMS key policies.
- Do not merge, deploy, or run AWS apply without Human Approval.
- Preserve high-level `signEvidence` / `verifyEvidenceSignature` compatibility unless the reviewed Spec explicitly documents a migration.

## Validation Targets

- New raw-message API names communicate the actual input contract.
- Existing deprecated aliases retain behavior and are regression-tested.
- Local/KMS Sign and Verify operate on identical bytes with exactly one SHA-256 application.
- KMS Sign and Verify both use `MessageType: RAW` and `ECDSA_SHA_256`.
- Both providers enforce the expected signature encoding and curve contract without accepting ambiguous inputs.
- All tests run locally with an injected fake KMS client; no AWS credentials are required.
- `npm run check:structure`, implementation conformance, independent Reviewer, and independent Security Reviewer remain required before Verification Evidence.

## Review Checklist

- [x] Related files are actually relevant to the Inbox intent.
- [x] No security-sensitive context is missing.
- [x] No stale knowledge is being treated as implementation truth.
- [x] Scope is narrow enough for the next spec/implementation step.
