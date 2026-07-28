# Module Registry

Single source of truth for existing modules. Before creating a new module,
check this table for overlapping functionality (see dedup-guard.md).

## Trust Boundary Flow
Evidence → Schema (validate) → Sign → Store → Ledger (record)

| File Path | Main Export | Trust Boundary Layer | Purpose (1 line) | Related Test |
|---|---|---|---|---|
| lib/audit.js | canonicalizeJson, hashJson, hashFile, hashFileWithDetails, verifyFile | Evidence | JSON/ファイルの正規化とハッシュ計算・検証 | tests/audit.test.js |
| lib/signature-digest.js | canonicalizeEvidence, calculateDigestFromCanonicalJson, calculateDigestHexFromCanonicalJson, loadEvidenceFromFile, getEvidenceDigestDetails | Evidence | Evidenceの正規化とダイジェスト計算 ⚠️audit.jsと機能重複疑い、専用テストなし | (テストなし・signature.test.js経由のみ) |
| lib/sidecar-verifier.js | verifyEvidenceWithSidecarMetadata | Evidence | Evidenceとサイドカーメタデータの統合検証 | tests/sidecar-verifier.test.js |
| lib/schema-validation.js | readJsonFile, validateEvidenceAgainstSchema, validateEvidenceFile | Schema | Evidence JSONのSchema検証(ajv) | tests/schema-validation.test.js |
| lib/metadata.js | validateSidecarMetadataV1, METADATA_SCHEMA_VERSION, 各定数 | Schema | サイドカーメタデータのSchema検証・定数定義 | tests/metadata.test.js |
| lib/metadata-signing.js | omitSignature, createMetadataSigningPayload | Schema | 署名前のメタデータペイロード整形 | tests/metadata-signing.test.js |
| lib/canonicalize-loader.js | loadCanonicalizeFunction, canonicalizeValue | Util | JCS正規化関数の動的ローダー | (テストなし・各テスト経由で間接カバー) |
| lib/local-ecdsa-provider.js | LocalEcdsaProvider, SIGNATURE_ALGORITHM | Sign | ローカル鍵によるECDSA署名プロバイダ | tests/local-ecdsa-provider.test.js |
| lib/aws-kms-provider.js | AwsKmsProvider, decodeDerSignatureToRaw | Sign | AWS KMSによるECDSA署名プロバイダ | tests/aws-kms-provider.test.js |
| lib/metadata-signature.js | signSidecarMetadata, verifySidecarMetadataSignature | Sign | サイドカーメタデータの署名生成・検証 | tests/metadata-signature.test.js |
| lib/signature.js | signEvidence, verifyEvidenceSignature, generateEcKeyPair, signDigest, verifyDigestSignature, LocalEcdsaProvider(再export) | Sign | Evidence署名処理の統合エントリポイント ⚠️signature-digest.jsを内部再export | tests/signature.test.js |
| lib/json-object-store.js | LocalJsonObjectStore, assertValidObjectKey | Store | ローカルファイルシステムのJSONオブジェクトストア | tests/json-object-store.test.js |
| lib/s3-json-object-store.js | S3JsonObjectStore, assertValidBucket, streamToString, isNotFoundError | Store | AWS S3ベースのJSONオブジェクトストア | tests/s3-json-object-store.test.js, tests/s3-json-object-store.integration.js |
| lib/pg-signing-logger.js | PgSigningLogger, GENESIS_HASH | Ledger | Postgresによる改ざん検知チェーン記録 | tests/pg-signing-logger.test.js |
| lib/audit-manager.js | AuditManager, AuditLedgerWriteError | Ledger | Evidence→Schema→Sign→Store→Ledgerの全体オーケストレーション | tests/audit-manager.test.js |

## E2E Tests (Cross-layer)
- tests/local-sidecar-e2e.test.js — ローカル環境でのフルフロー検証
- tests/s3-sidecar-e2e.test.js — AWS S3環境でのフルフロー検証

## ⚠️ Known Issues (要別タスク対応)
1. **`audit.js` vs `signature-digest.js`** — 正規化＋ハッシュ計算のロジックが機能重複している疑いあり。統合または責務分離の検討が必要。
2. **`signature-digest.js`** — 専用テストファイルが存在せず、`signature.js`の再exportを通じてのみ間接的にテストされている。直接テストの追加、または`signature.js`への統合を検討。
3. **`canonicalize-loader.js`** — 専用テストなし。低リスク（薄いラッパー）だが将来的にカバレッジ追加を検討。

## Update Rule
See `.kiro/steering/module-registry-update.md` — このファイルはコード変更と同じコミットで更新すること。
