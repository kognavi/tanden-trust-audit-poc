# `contracts/` Solidity and Web3 Rules

このファイルはrootの[`AGENTS.md`](../AGENTS.md)を補足し、`contracts/TrustAnchor.sol`を含むSolidity / Web3変更に適用します。Evidence本文はoff-chainに保持し、contractは最小限のanchoring用途に限定します。Web3 anchoringは、off-chainの`Evidence → Schema → Sign → Store → Ledger`に含まれるLedger Layerそのものではなく、その後段または独立した外部証明境界です。

## On-chain Data Policy

Evidence本文、PII（個人識別情報）、不要なMetadataをon-chainへ保存してはいけません。原則として保存できるのは次だけです。

- hashまたはdigest
- compact verification data（検証に必要な小さいデータ）
- anchoringに必要な最小情報

現在のPoCでは、`scripts/anchor-evidence.js`がEvidenceから計算したdigestを直接anchorしており、`TrustAnchor.sol`自体は、そのdigestが署名済みまたは検証済みであることを証明しません。この現状を、production-readyな保証と誤解してはいけません。

新規またはproduction-orientedなanchoring flowでは、off-chainのTrust Boundaryを完了し、署名・検証済みであることを確認したdigestまたはverification dataだけをanchorすることを目標ルールとします。Contractまたはanchoring flowの変更時は、現在のPoCとの差異、off-chain verification、Trust Boundary、外部anchoring境界への影響を説明します。

## Smart Contract Security Review

Solidity変更では最低限、次を確認し、該当しない項目も理由を判断します。

- access controlとauthorization
- reentrancy
- external calls
- duplicate anchoring
- denial of service
- storage growth
- front-runningおよびordering dependency
- timestamp assumptions
- upgradeability risk
- event correctness

Security Controlやnegative testを無効化して検証を通してはいけません。

## Timestamp

`block.timestamp`はvalidatorにより限定的に操作され得るため、厳密なTrusted Timestampとして扱いません。表示・順序補助と、独立した時刻証明を区別します。

## Gas and Storage

新しいstorage variable、mapping、array、loopを追加する場合は、transactionのGas Cost、読み書き回数、unbounded loopの有無、将来の状態肥大化を評価します。On-chain dataは検証目的に必要な最小量にします。

## Upgradeability

明示的な要求と脅威分析がない限り、ProxyまたはUpgradeable Contractを導入しません。導入提案時は、管理者権限、初期化、storage layout、upgrade key侵害を含む追加リスクを説明します。

## External Dependencies

新しいSolidity dependencyを導入する前に、必要性、maintenance status、security history、license、attack surfaceを確認します。標準的で監査済みの実装を優先し、不要なdependencyを追加しません。
