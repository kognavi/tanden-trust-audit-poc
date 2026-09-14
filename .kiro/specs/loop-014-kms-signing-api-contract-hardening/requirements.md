# loop-014-kms-signing-api-contract-hardening Requirements

## Source Context Pack

- `knowledge/20-research/context-packs/loop-014-kms-signing-api-contract-hardening-context.md`
- Context ID: `context-pack-loop-014-kms-signing-api-contract-hardening`

## Purpose

Local ECDSAとAWS KMSの低レベル署名APIを、raw messageをSHA-256で一度だけhashしてECDSA署名する明示的なcontractへ固定し、既存利用者を壊さずに`signDigest`という誤解を招く名称から安全に移行できるようにする。

## Current Implementation Truth

- `AwsKmsProvider`は`MessageType: RAW`と`ECDSA_SHA_256`を使用し、canonical message bytesをKMSへ渡す。
- `LocalEcdsaProvider`は`crypto.sign('sha256', message, ...)`を使用し、同じmessage bytesを一度hashする。
- 両providerの現在の`signDigest` / `verifyDigestSignature`はprecomputed digestではなくraw messageを受け取る。
- 両providerは`secp256k1`を使用し、KMSは`ECC_SECG_P256K1`をfail closedで検証する。
- 保存・provider間受け渡しは64-byte IEEE P1363、KMS API境界はASN.1 DERである。
- `signature.js`と`metadata-signature.js`を含む既存consumerは旧名称を利用している。
- code、tests、`docs/module-registry.md`がcurrent implementation truthであり、旧`kms-blockchain-tx-signing` Planはhistorical referenceに限る。

## Requirements

- [x] 正規の低レベルAPIを`signRawMessage(message, ...)`と`verifyRawMessageSignature(message, signature, ...)`として公開する。
- [x] 正規APIはraw pre-hash bytesだけを意味し、内部hash algorithmをSHA-256に固定する。
- [x] AWS KMS Sign/Verifyは両方とも`MessageType: RAW`と`SigningAlgorithm: ECDSA_SHA_256`を使用する。
- [x] Local/KMS両providerは`secp256k1`、64-byte IEEE P1363 signatureという共通contractを持つ。
- [x] KMS providerは`ECC_SECG_P256K1`以外を拒否し、Local providerは異なるcurveのkeyを拒否する。
- [x] raw messageがBufferでない場合、空の場合、またはKMS RAW上限を超える場合はKMS APIを呼ぶ前に拒否する。
- [x] verify用signatureが64-byte Bufferでない場合、暗号処理やKMS APIを実行せず`false`としてfail closedに扱う。
- [x] 既存の`signDigest` / `verifyDigestSignature`は同じraw-message semanticsを持つdeprecated aliasとして維持する。
- [x] high-level evidenceとmetadata署名は正規raw-message APIを優先し、旧interfaceしか持たない注入providerには互換fallbackを提供する。
- [x] digest専用APIと`MessageType: DIGEST`は追加しない。
- [x] algorithm、curve、encoding、KeySpec、MessageType、message/signatureサイズのcontract constantsを単一moduleに集約する。
- [x] module registryと署名設計文書を現行contractへ整合させる。
- [x] AWS resource、IAM、KMS key、KMS key policy、dependencyを変更しない。

## Invariants

- Preserve `Evidence → Schema → Sign → Store → Ledger`.
- canonical JSON bytesはSign/Verifyで同一であり、SHA-256は一度だけ適用される。
- 32-byte Bufferだけからraw messageとdigestを安全に判別できるとは仮定しない。
- ambiguous inputの自動推測や`RAW` / `DIGEST`の暗黙切替を行わない。
- existing signature bytes、digestHex、high-level return shapeの互換性を維持する。
- Local-first / AWS-on-demandを維持し、通常testでreal AWSを呼ばない。
- Security Reviewerを必須とし、Builder → Reviewer → Security Reviewer → Verificationを迂回しない。

## Acceptance Criteria

- [x] 正規raw-message APIとdeprecated aliasの両方が同じ有効な署名を生成・検証する。
- [x] KMS mock testsがSign/Verify双方の`RAW`、algorithm、同一message bytesを固定する。
- [x] 独立したcrypto verificationによりLocal/KMSのsingle-SHA-256 semanticsが維持される。
- [x] P-256など契約外Local key、契約外KMS KeySpec、不正message、不正signatureをfail closedで拒否する。
- [x] metadata署名の新API利用とlegacy injected provider fallbackがtestされる。
- [x] `signEvidence` / `verifyEvidenceSignature`と既存facade利用者が回帰しない。
- [x] focused tests、`npm test`、`npm run check:structure`がPASSする。
- [x] AWS/IAM/KMS resource、dependency、recurring costに変更がない。
- [x] implementation後に独立Reviewerと独立Security ReviewerのPASSが必要である。

## Open Questions

None.

## Review Gate

This specification is ready for independent validation against the Context Pack, current code, tests, module registry, and cryptographic provider boundaries. Implementation does not authorize merge, deployment, AWS apply, IAM changes, or KMS changes.
