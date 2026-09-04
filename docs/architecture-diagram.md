# Architecture Diagram

## Product View

~~~mermaid
flowchart LR
    AR[AI Agent / SaaS Runtime] --> RC[Runtime Collector / Adapter<br/>planned]
    RC --> AE[AI Agent Evidence Profile]
    AE --> PS[EvidenceProcessingService]
    PS --> SC[JSON Schema validation]
    SC --> SG[Signing Provider]
    SG --> ES[Versioned Evidence Store]
    ES --> LG[Hash-chained Signing Ledger]
    LG --> VR[Independent Verification]
    ES --> IM[Immutable Retention<br/>target]
    VR --> XA[External Trust Anchor<br/>optional]
~~~

主役はAI Agentから生成されるEvidenceです。

External anchorはoptional boundaryであり、Blockchainをproduct coreとはしません。

## Current Implementation

~~~mermaid
flowchart LR
    E[Evidence JSON] --> PS[EvidenceProcessingService]
    PS --> V[JSON Schema validation]
    V --> C[RFC 8785 JCS + SHA-256]
    C --> LS[Local ECDSA Provider]
    C --> KS[AwsKmsProvider]
    LS --> ST[Store abstraction]
    KS --> ST
    ST --> PG[PgEvidenceStore]
    PG --> PL[PgSigningLogger hash chain]
    PL --> VF[Verification]
    VF --> VA[VerifiedAnchorService<br/>optional]
    VA --> WA[TrustAnchor.sol<br/>Sepolia prototype]
~~~

実線は実装済みmoduleの責務を示しますが、production deploy済みという意味ではありません。

AI Agent-specific runtime collectorはまだ未実装です。新しい `schemas/ai-agent-evidence.schema.json` はEvidence envelopeを定義し、既存のEvidenceProcessingServiceへ接続する前段のprofileです。

## Trust Boundary

~~~text
Evidence → Schema → Sign → Store → Ledger
~~~

この順序はrepository invariantです。

Web3 anchoringはcore flow完了後のexternal proof boundaryです。

## Target AWS Architecture

~~~mermaid
flowchart LR
    A[AI Agent Runtime] --> C[Collector / Adapter]
    C --> API[Ingestion API]
    API --> VAL[Schema + policy checks]
    VAL --> KMS[AWS KMS signing]
    KMS --> S3[S3 Versioning / Object Lock]
    S3 --> DB[Hardened PostgreSQL / metadata index]
    DB --> CT[CloudTrail / CloudWatch correlation]
    DB --> AUD[Auditor / Compliance / IR]
    AUD --> VER[Independent verifier]
    VER --> EXT[External anchor<br/>optional]
~~~

Targetはproduction-orientedであり、未deploy部分を含みます。

## Security Property Comparison

| Property | Current PoC | Target |
|---|---|---|
| AI Agent context | schema/profile added | live runtime collectors |
| Structural validation | implemented | ingestionでfail-closed |
| Authenticity | local + AwsKmsProvider | least-privilege IAM / key policy / separation of duties |
| Storage | local/S3 adapter + PgEvidenceStore | WORM retention + HA/backup |
| Ledger | PostgreSQL hash chain | hardened roles + reconciliation + completeness checks |
| AWS audit | SDK path implemented | CloudTrail retention/correlation/alarms |
| Web3 | verified digest testnet prototype | optional external trust proof only |
