# Architecture Diagram

## Current Implementation

```mermaid
flowchart LR
    E[Evidence JSON] --> PS[EvidenceProcessingService]
    PS --> V[JSON Schema validation]
    V --> C[RFC 8785 JCS + SHA-256]
    C --> LS[Local ECDSA P-256]
    C --> KS[AwsKmsProvider<br/>ECC_SECG_P256K1]
    LS --> ST[Local / S3 JSON store]
    KS --> ST
    KS --> PG[PgEvidenceStore]
    PG --> PL
    LS --> AM[AuditManager]
    KS --> AM
    AM --> PL[PgSigningLogger hash chain]
    PL --> VA[VerifiedAnchorService]
    TK[Deployment trusted keyring] --> KR[TrustedKeyResolver]
    KR --> VA
    VA --> VF[Sidecar digest + signature verification]
    VF --> VD[Verified SHA-256 digest]
    VD -->|bytes32 digest only| WA[TrustAnchor.sol]
```

実線は実装済みmoduleの責務を示しますが、deploy済みという意味ではありません。`EvidenceProcessingService`はSchema、signing provider、`PgEvidenceStore`互換Store、`PgSigningLogger`互換Ledgerを順番に呼ぶapplication APIです。`AuditManager`は従来どおりproviderと`PgSigningLogger`のみを接続します。Official Web3 pathでは`VerifiedAnchorService`がsigned `keyId`をtrusted keyringへbindしてverificationを内部実行し、ContractへEvidence本文、PII、raw signature、public/private keyを送りません。

`TrustAnchor.sol`は外部proof boundaryとしてdigest、anchor済みstate、block timestampだけを保持します。Blockchain自身はEvidenceの真実性や署名を検証せず、`block.timestamp`もstrict trusted timestampではありません。

S3 unit/E2E testはfake clientを使い、実AWS S3 integration testはcredentialsと環境変数を必要とする別suiteです。AWS KMS unit testもinjected mock clientを使います。PostgreSQL moduleのunit testはfake pool/clientを使います。

## Target / Reference Architecture

```mermaid
flowchart LR
    P[Producer] --> API[API Gateway / Lambda]
    API --> SC[Schema]
    SC --> KMS[AWS KMS signing]
    KMS --> S3[S3 Versioning / Object Lock]
    S3 --> DB[DynamoDB metadata or hardened PostgreSQL]
    DB --> CT[CloudTrail / CloudWatch]
    DB --> VF[Off-chain verification]
    VF --> AN[External anchor<br/>verified digest only]
```

この図はproduction-oriented targetであり未deployです。DynamoDBはtarget/alternative metadata architectureであり、S3 Object Lock、IAM/KMS policy、CloudTrail correlation、API/Lambda/EventBridge、authorized relayer運用はplannedです。verified digest application gate自体はcurrent PoCに実装済みです。

## Security Property Comparison

| Property | Current PoC | Target / Reference |
|---|---|---|
| Structural validation | `EvidenceProcessingService`では署名前にfail-closedで強制。既存低レベルentry pointは個別利用可能 | ingestion serviceでfail-closedに強制 |
| Authenticity | local providerとAwsKmsProvider実装済み | least-privilege IAM、key policy、separation of duties込み |
| Storage | local/S3 adapter、PostgreSQL store実装済み | S3 Object Lock、retention、HA/backup |
| Ledger | PostgreSQL hash chain実装済み | hardened DB rolesとexternal chain-head anchoring |
| AWS audit | SDK callsは実装済み。CloudTrail構成はRepository外 | CloudTrail retention、correlation、alarm |
| Web3 | official pathはtrusted-key-bound off-chain verification後のdigestだけを送信。Contractはpermissionless | authorized relayer、監視、運用key管理を含むproduction control |
