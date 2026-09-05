# Module Registry

Current implementationのcanonical indexです。新規moduleを作る前に、実際のcodeとtestsをこの表と照合してください。差異がある場合はcode/testsを優先し、この表を同じ変更で更新します。

## Trust Boundary Flow

```text
Evidence → Schema → Sign → Store → Ledger
```

| File Path | Main Export | Trust Boundary Layer | Purpose | Related Test |
|---|---|---|---|---|
| lib/audit.js | canonicalizeJson, hashJson, hashFile, hashFileWithDetails, verifyFile | Evidence | JSON/ファイルのRFC 8785 JCS正規化、SHA-256 hash計算・比較 | tests/audit.test.js |
| lib/signature-digest.js | HASH_ALGORITHM, CANONICALIZATION, loadCanonicalizeFunction, canonicalizeEvidence, calculateDigestFromCanonicalJson, calculateDigestHexFromCanonicalJson, loadEvidenceFromFile, getEvidenceDigestDetails | Evidence | Evidence署名用の正規化、digest計算、ファイル読込 | tests/signature.test.js経由（専用testなし） |
| lib/sidecar-verifier.js | verifyEvidenceWithSidecarMetadata | Evidence | Evidence digestとsidecar metadata署名の統合検証 | tests/sidecar-verifier.test.js |
| lib/schema-validation.js | readJsonFile, validateEvidenceAgainstSchema, validateEvidenceFile | Schema | Evidence JSONのJSON Schema検証 | tests/schema-validation.test.js |
| lib/metadata.js | METADATA_SCHEMA_VERSIONほか定数, validateSidecarMetadataV2 | Schema | sidecar metadata v2の構造・制約検証と定数定義 | tests/metadata.test.js |
| lib/metadata-signing.js | omitSignature, createMetadataSigningPayload | Schema | 署名対象sidecar metadata payloadの整形 | tests/metadata-signing.test.js |
| lib/canonicalize-loader.js | loadCanonicalizeFunction, canonicalizeValue | Util | CommonJSからRFC 8785 canonicalize packageを利用するloader | 各testで間接cover（専用testなし） |
| lib/local-ecdsa-provider.js | SIGNATURE_ALGORITHM, LocalEcdsaProvider | Sign | local ECDSA P-256鍵によるEvidence署名・検証provider | tests/local-ecdsa-provider.test.js |
| lib/aws-kms-provider.js | SIGNATURE_ALGORITHM, KMS_SIGNING_ALGORITHM, decodeDerSignatureToRaw, encodeRawToDer, AwsKmsProvider | Sign | AWS KMS ECC_SECG_P256K1 / ECDSA_SHA_256によるEvidence署名・検証provider | tests/aws-kms-provider.test.js, tests/cross-provider-parity.test.js |
| lib/metadata-signature.js | calculateMetadataSigningDigestFromPayload, calculateMetadataSigningDigestHexFromPayload, getMetadataSigningDigestDetails, signSidecarMetadata, verifySidecarMetadataSignature | Sign | sidecar metadataの署名用digest生成・署名・検証 | tests/metadata-signature.test.js |
| lib/signature.js | constants, LocalEcdsaProvider, signature-digest exports, generateEcKeyPair, signDigest, verifyDigestSignature, signEvidence, verifyEvidenceSignature | Sign | LocalEcdsaProviderを使うEvidence署名APIとdigest helperの再export | tests/signature.test.js |
| lib/json-object-store.js | LocalJsonObjectStore, assertValidObjectKey | Store | local filesystemのJSON object store | tests/json-object-store.test.js |
| lib/s3-json-object-store.js | S3JsonObjectStore, assertValidBucket, streamToString, isNotFoundError, isPreconditionFailedError | Store | Amazon S3のJSON object store（conditional write対応） | tests/s3-json-object-store.test.js, tests/s3-json-object-store.integration.js |
| lib/pg-evidence-store.js | PgEvidenceStore, EvidenceStoreError, assertValidEvidenceId, assertValidVersion, assertValidDigestHex | Store | 署名、digest、KMS key IDを含むversioned EvidenceをPostgreSQLへappend/read | tests/pg-evidence-store.test.js |
| lib/pg-signing-logger.js | PgSigningLogger, GENESIS_HASH | Ledger | PostgreSQLのappend-only signing event hash chainを記録・検証 | tests/pg-signing-logger.test.js |
| lib/audit-manager.js | AuditManager, AuditLedgerWriteError | Ledger | signing providerとPgSigningLoggerを協調し、署名・検証eventをLedgerへ記録 | tests/audit-manager.test.js |
| lib/evidence-processing-service.js | EvidenceProcessingService, EvidenceValidationError, EvidenceStoreWriteError, EvidenceLedgerWriteError | Application | 既存Schema validator、signing provider、PgEvidenceStore互換Store、PgSigningLogger互換Ledgerをcomposeし、`Schema → Sign → Store → Ledger`の順序とpartial failure semanticsを単一APIで強制 | tests/evidence-processing-service.test.js |
| lib/normalized-agent-event.js | validateNormalizedAgentEvent, assertNormalizedAgentEvent, NormalizedAgentEventValidationError | Ingress / Schema | runtime-neutralなAgent tool-call event contractをvalidateし、raw promptやsecret-bearing fieldなど想定外入力をfail closedで拒否 | tests/normalized-agent-event.test.js |
| lib/collectors/fixture-agent-collector.js | FixtureAgentCollector | Ingress Adapter | synthetic fixtureをruntime event相当として読み出し、Normalized Agent Event contractを通してisolated copyを返すlocal-first adapter | tests/fixture-agent-collector.test.js |
| lib/ai-agent-evidence-mapper.js | AI_AGENT_EVIDENCE_SCHEMA_VERSION, HASH_ALGORITHM, mapNormalizedAgentEventToEvidence | Evidence Mapping | normalized Agent eventをAWS SDK shapeへ依存せずAI Agent Evidence profileへ変換し、EvidenceProcessingService前段へ渡す | tests/ai-agent-evidence-mapper.test.js, tests/ai-agent-collector-e2e.test.js |
| lib/verified-anchor-service.js | VerifiedAnchorService, TrustedKeyResolver, VerificationGateError, AlreadyAnchoredError, AnchorTransactionError | External Proof / Application | signed metadataのkeyIdをdeployment trusted keyringへbindし、既存sidecar verifierを内部実行して、Evidenceから再計算したverified bytes32 digestだけをWeb3 clientへ渡す | tests/verified-anchor-service.test.js |

## Cross-layer Tests

- `tests/local-sidecar-e2e.test.js`: local storeでEvidenceとsidecar metadataの保存・検証・改ざん検知
- `tests/s3-sidecar-e2e.test.js`: fake Amazon S3 clientで同flowを検証
- `tests/ai-agent-collector-e2e.test.js`: fixture Agent event → normalized contract → AI Agent Evidence mapper → EvidenceProcessingService → local ECDSA → Store/Ledger test doubles → signature verification / tamper failure のlocal-first E2E

## Known Issues

1. `audit.js`と`signature-digest.js`にはcanonicalizationとdigest責務の重複がある。Phase 2では変更しない。
2. `signature-digest.js`と`canonicalize-loader.js`には専用test fileがなく、他moduleのtestから間接的にcoverされる。
3. `AuditManager`はSchema validationやEvidence Storeを呼ばず、providerとLedgerの協調責務を維持する。production-orientedな取り込み処理では`EvidenceProcessingService`をentry pointとして使用する必要があり、低レベルmoduleの個別呼び出し自体は禁止していない。

## Update Rule

`lib/AGENTS.md`のModule Registry Ruleに従い、新規file、export、責務、関連testの変更と同じ変更単位で更新します。
