---
id: loop-014-kms-signing-api-contract-hardening
type: idea
status: inbox
created: 2026-09-14
updated: 2026-09-14
source:
  - AGENTS.md
  - docs/module-registry.md
  - lib/aws-kms-provider.js
  - lib/local-ecdsa-provider.js
  - lib/signature.js
  - tests/aws-kms-provider.test.js
  - tests/cross-provider-parity.test.js
supports:
  - loop-013-work-first-development-orchestration
contradicts: []
supersedes: []
reviewed_by: []
---

# Loop 014 - KMS Signing API Contract Hardening

## Intent

AWS KMSとLocal ECDSA providerの低レベル署名APIについて、raw messageとdigestの境界、hashing回数、algorithm、curve、signature encoding、KeySpec、backward compatibilityを明示的で誤用しにくいcontractとして固定する。

## Current concern

- `signDigest` / `verifyDigestSignature` という名称に対し、現在の実入力はprecomputed digestではなくraw canonical message bytesである。
- AWS KMSは `MessageType: RAW` と `ECDSA_SHA_256` によりmessageを内部でSHA-256処理する。
- Local providerも `crypto.sign('sha256', message, ...)` / `crypto.verify('sha256', message, ...)` により同じmessageを内部で一度hashする。
- 誤ってprecomputed SHA-256 digestをraw-message APIへ渡すと、意図しない二重hashになる。
- `lib/signature.js` の引数名、既存testsの一部変数名、module registry、古い設計文書には現在のcontractと一致しない表現が残る。

## Required contract topics

- raw-message APIとdigest APIを混同しない公開境界
- `MessageType: RAW` の固定とSHA-256一回処理の保証
- LocalEcdsaProvider / AwsKmsProviderのbehavioral parity
- signature algorithm: `ECDSA_SHA_256`
- curve / KeySpec: `secp256k1` / `ECC_SECG_P256K1`
- stored signature encoding: 64-byte IEEE P1363 `r || s`
- AWS KMS API signature encoding: ASN.1 DER
- existing callersのbackward compatibilityと安全な移行

## Security and governance boundary

- Security Reviewerを必須とする。
- `Evidence → Schema → Sign → Store → Ledger` を変更しない。
- 旧 `.kiro/specs/kms-blockchain-tx-signing/` はhistorical referenceに限定し、実装source of truthとして再開しない。
- stashを復活させない。
- real AWS APIを呼ばない。
- AWS resource、IAM policy、KMS key、KMS key policyを変更しない。
- merge、deploy、AWS applyはHuman Approvalなしに行わない。
- committed runtimeはdry-run baselineを維持する。

## Expected validation

- raw canonical message bytesがLocal/KMSの両providerで同一である。
- SignとVerifyの両方でSHA-256が一度だけ適用される。
- KMS Sign/Verifyがともに `MessageType: RAW` を使用する。
- algorithm、curve、KeySpec、signature encodingの不一致をfail closedで拒否する。
- 既存のhigh-level `signEvidence` / `verifyEvidenceSignature` 利用者を壊さない。
- mock/local testsだけで通常検証できる。

## Open questions

- 既存の`signDigest` / `verifyDigestSignature`をdeprecated aliasとして残し、新しいraw-message名を追加するか。
- digest専用APIを新設するか、今回のscopeでは明示的にnon-goalとするか。
- Local providerにもraw message型・signature長・key curveの追加validationを導入するか。
- provider contract constantsを共通moduleへ集約するか、循環依存を避けて各providerに保持するか。
