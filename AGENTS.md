# Agent Development Constitution

このファイルは、Kiro、Codexその他の開発Agentが最初に読むRepository-wideルールです。詳細な仕様を複製せず、既存文書を参照してください。

## Project Purpose

このRepositoryは、tamper-evident audit trail（改ざんを検知できる監査証跡）とcryptographic evidence verification（暗号学的なEvidence検証）を検証するPoCです。AWS、AWS KMS signing、immutable storage（不変ストレージ）、Web3-compatible anchoringを対象にします。

## Architecture Invariant

Trust Boundaryは常に次の一方向です。

```text
Evidence → Schema → Sign → Store → Ledger
```

- Schema validationを通さずSignへ渡さない。
- StoreにSignロジックを持たせない。
- Signを通していないEvidenceをLedgerへ記録しない。
- 逆方向の依存、循環依存、理由のないLayer責務の混在を作らない。
- Architecture変更では、このTrust Boundaryへの影響を明示する。

## Before Writing Code

新しい実装を作る前に、必ず次を確認します。

1. [`docs/module-registry.md`](docs/module-registry.md)
2. 変更箇所に関連する既存コード
3. 関連テスト

責務が既存実装と大きく重複する場合、新規モジュールを作るより既存モジュールの拡張を優先します。

## Documentation Map

- [`docs/module-registry.md`](docs/module-registry.md): current implementationのcanonical index。ただし、実際のcodeやtestsより優先される絶対的な情報源ではない
- 関連するcodeおよびtests: 実際に存在する現在の挙動とcoverage
- [`docs/architecture.md`](docs/architecture.md)および`docs/architecture*.md`: Architecture。currentとtargetの記述を区別して読む
- [`docs/adr/`](docs/adr/): 採用した設計判断と、その選択理由
- [`docs/roadmap.md`](docs/roadmap.md)およびreference architecture文書: 将来計画またはtarget architecture

現在状態は、関連するcode、tests、`docs/module-registry.md`を照合して判断します。差異があればmodule registryの記載だけを盲信せず、推測で上書きしたり勝手に解消したりせずに報告し、明示された変更範囲に含まれる場合だけ整合させます。

## Security Baseline

次を禁止します。

- secretsまたはcredentialsのcommit
- production private keyのローカル保存
- schema validationのbypass
- CIを通すためのsecurity testまたはSecurity Controlの無効化
- 根拠のないIAMまたはAWS KMS権限の拡大
- auditability（後から操作を追跡・検証できる性質）を低下させる変更
- PII（個人識別情報）またはEvidence本文のon-chain保存

Semgrep、CodeQL、Dependabot、dependency-cruiser、Madge、automated tests、AWS IAM least privilege、AWS KMS separation of duties、CloudTrail auditabilityを維持します。

## Validation

`lib/`などの実装変更後は、原則としてpackage scriptsをSingle Interfaceとして使用します。

```bash
npm run check:structure
```

変更リスクに応じて追加の既存scriptやtestも実行し、結果を報告します。

## Communication

- 結果説明は日本語で行う。
- code、API名、AWS service名、識別子は正式名称を維持する。
- 専門用語には必要に応じて短い説明を付ける。
