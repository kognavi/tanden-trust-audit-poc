# `lib/` Implementation Rules

このファイルはrootの[`AGENTS.md`](../AGENTS.md)を補足し、`lib/`配下の実装に適用します。

## Trust Boundary Enforcement

```text
Evidence → Schema → Sign → Store → Ledger
```

- **Evidence**: Evidenceの入力、RFC 8785 JCS canonicalization、digest生成を扱う。
- **Schema**: Evidenceと署名Metadataの構造・制約を検証し、不正な入力を後段へ渡さない。
- **Sign**: 検証済みデータの署名と署名検証を扱う。private keyの保護境界を維持する。
- **Store**: 署名済みEvidenceとMetadataを保存・取得する。署名を生成しない。
- **Ledger**: 署名済みEvidenceに関するeventをappend-onlyかつtamper-evidentに記録する。

Layerをskipまたは逆方向に依存させず、責務を混在させません。Architecture変更では各Layerへの影響と、Invariantを維持する根拠を記載します。

## Duplicate Implementation Guard

新規モジュールを作る前に[`docs/module-registry.md`](../docs/module-registry.md)を確認します。目的が既存モジュールと大きく重複する場合は、既存コードの拡張を優先します。

特に、既知の重複候補である`lib/audit.js`と`lib/signature-digest.js`のcanonicalizationおよびdigest責務を確認してください。

## Module Registry Rule

次の場合は、同じ変更で[`docs/module-registry.md`](../docs/module-registry.md)を更新します。

- `lib/`への新規ファイル追加
- exportの追加
- モジュール責務の変更
- 関連テストの追加または変更

実装済みのroadmap項目に影響する場合は、rootのDocumentation Mapに従い`docs/roadmap.md`との整合も確認します。

## Dependency Rules

- Layer違反と循環依存を作らない。
- production moduleからtest codeへ依存しない。
- 外部dependencyの追加は必要性、保守状況、security、license、attack surfaceを確認する。
- 実装後は`npm run check:structure`を実行する。
- 検証失敗を隠すためにtest、dependency-cruiser、Madgeその他のguardを無効化しない。

## Tests

変更対象とリスクに応じて、unit tests、integration tests、negative tests（不正入力を拒否するテスト）、tamper detection testsを追加または更新します。Security-sensitive codeでは正常系だけでなく、改ざん、認可エラー、不正形式、依存サービス障害などの異常系を重視します。
