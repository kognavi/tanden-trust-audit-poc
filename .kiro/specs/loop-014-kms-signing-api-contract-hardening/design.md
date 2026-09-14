# loop-014-kms-signing-api-contract-hardening Design

## Source Context Pack

- `knowledge/20-research/context-packs/loop-014-kms-signing-api-contract-hardening-context.md`
- Context ID: `context-pack-loop-014-kms-signing-api-contract-hardening`

## Current State

LocalとKMSの実装はどちらもcanonical message bytesをSHA-256で一度だけhashしてECDSA署名する。しかし低レベルmethod名は`signDigest` / `verifyDigestSignature`のままで、引数名・tests・一部文書もdigest入力と誤読できる。KMSはKeySpecを検証するが、Local providerは外部から渡されたkeyのcurveを検証せず、contract constantsも複数moduleとmetadataへ分散している。

## Proposed Design

### Shared contract

`lib/signing-contract.js`をSign layerの小さなcontract moduleとして追加し、algorithm、curve、KMS KeySpec、KMS MessageType、signature encoding、signature size、KMS RAW message sizeと、それらのfail-closed validatorsをexportする。

Raw messageとdigestはどちらもBufferになり得るため、内容や32-byte lengthから意味を推測しない。contractはAPI名とcall siteで明示する。

### Canonical API and compatibility

両providerへ`signRawMessage(message, privateKey?)`と`verifyRawMessageSignature(message, signature, publicKey?)`を追加する。

既存`signDigest` / `verifyDigestSignature`は削除せず、新methodを呼ぶdeprecated aliasとして残す。runtime warningは既存CLI/test outputを不安定にするため出さない。

`lib/signature.js`も新methodをexportし、旧wrapperは互換aliasとして維持する。provider自身の`signEvidence` / `verifyEvidenceSignature`は新methodを直接使用する。

`lib/metadata-signature.js`は新methodを持つproviderでは新methodを優先する。外部test doubleや既存custom providerが旧methodだけを実装している場合はlegacy methodへfallbackし、移行期間の互換性を維持する。どちらもない場合は明示的に拒否する。

### Provider enforcement

- AWS KMS: Sign/Verify双方でshared constantsを使い、`RAW`と`ECDSA_SHA_256`を固定する。KeySpecは`ECC_SECG_P256K1`だけを許可する。
- Local: private/public keyをNode `KeyObject`へ正規化し、`asymmetricKeyType === ec`かつ`namedCurve === secp256k1`を要求する。
- verify signatureは両providerで64-byte P1363 Bufferを要求する。malformed signatureは暗号処理やKMS APIを実行せず`false`を返し、既存のtamper-detection semanticsを維持する。
- KMSのDER parser/encoderは既存責務を維持する。

## Affected Components

- `lib/signing-contract.js`
- `lib/aws-kms-provider.js`
- `lib/local-ecdsa-provider.js`
- `lib/signature.js`
- `lib/metadata-signature.js`
- `scripts/test-kms-signing.js`
- `tests/signing-contract.test.js`
- `tests/aws-kms-provider.test.js`
- `tests/local-ecdsa-provider.test.js`
- `tests/signature.test.js`
- `tests/metadata-signature.test.js`
- `tests/cross-provider-parity.test.js`
- `docs/module-registry.md`
- `docs/signature-provider-design.md`
- `docs/aws-kms-signing-design.md`
- `knowledge/00-inbox/loop-014-kms-signing-api-contract-hardening.md`
- `knowledge/20-research/context-packs/loop-014-kms-signing-api-contract-hardening-context.md`
- `knowledge/30-learnings/loop-014-kms-signing-api-contract-hardening.md`
- `.kiro/specs/loop-014-kms-signing-api-contract-hardening/`

## Trust Boundary Impact

- `Evidence → Schema → Sign → Store → Ledger`: unchanged.
- Sign layer内部のinput contractだけを明確化し、Schema、Store、Ledgerの責務を移動しない。
- High-level evidence processing orderとsigned bytesを変更しない。

## Security

- IAM / KMS impact: none。resource、policy、key configurationを変更しない。
- Secret / PII impact: none。key materialやevidence本文を新たに保存しない。
- Auditability impact: API名とconstantsを実際の署名対象へ一致させ、hashing driftをtestで検知可能にする。
- Fail-closed impact: invalid message/signature/key curve/KeySpecを外部crypto service実行前に拒否する。
- Independent Security Reviewer: required because cryptographic API and verification behavior are security-sensitive.

## Cost and Operations

- AWS resource impact: none。
- Recurring cost impact: none。
- Dependency impact: none。Node.js standard libraryと既存AWS SDKのみを使用する。
- Operational burden: deprecated aliasを移行期間中に維持し、将来の削除は別Loopで判断する。
- Test executionはfake KMS/local cryptoのみで、AWS credentialsを要求しない。

## Alternatives Considered

- 既存methodを一括renameして削除: rejected。external/custom providerとscriptsの互換性を不必要に壊す。
- 32-byte入力をdigestとして自動判定: rejected。正当な32-byte raw messageと区別できず、曖昧である。
- `signDigest`を真のdigest APIへ意味変更: rejected。silent behavioral breakと`RAW`/`DIGEST`混在を招く。
- digest専用APIを同時追加: rejected。このLoopの目的は境界縮小であり、二つのKMS MessageTypeを公開すると誤用面が増える。
- コメントとtest名だけ修正: rejected。正規APIが誤称のまま残り、将来consumerの誤用を防げない。

## Validation Plan

- Contract unit tests: constants、message/signature validation、secp256k1 key validation、P-256 rejection。
- AWS KMS tests: new/legacy APIs、Sign/Verify `RAW`、algorithm、KeySpec、DER/P1363、no-call fail-fast。
- Local tests: new/legacy APIs、single SHA-256、wrong curve、invalid input/signature。
- Facade tests: new exportsとlegacy aliases。
- Metadata tests: new method preference、legacy provider fallback、missing provider method rejection。
- Cross-provider tests: identical canonical bytes、same curve/encoding contract、single-hash verification。
- Existing tests: `npm test` and `npm run check:structure`。
- Security checks: no `MessageType: DIGEST` production path、no AWS call、no secret、no IAM/KMS/infra/dependency diff。

## Review Checklist

- [x] Design matches reviewed requirements.
- [x] Current-state claims were checked against code/tests/module registry.
- [x] Raw message and digest are not inferred from Buffer length or content.
- [x] Backward compatibility is explicit and testable.
- [x] Trust boundary impact is explicit.
- [x] Security/cost/operations are explicit.
- [x] Security Reviewer is mandatory and independent from Builder.
- [x] Merge, deploy, AWS apply, IAM, and KMS changes remain Human Approval boundaries.
