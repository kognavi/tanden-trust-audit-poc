# Agent Development Constitution

このファイルは、Kiro、Codexその他の開発Agentが最初に読むRepository-wideルールです。詳細な仕様を複製せず、既存文書を参照してください。

## Project Purpose

このRepositoryは、**AI Agentのsecurity-relevant actionを後から第三者が検証可能なEvidenceへ変換する基盤**を検証するPoCです。

主対象は以下です。

- AI Agent evidence profile
- tamper-evident audit evidence
- AWS KMS signing
- versioned evidence storage
- append-only / hash-chained ledger
- immutable retention
- audit / compliance verification
- optional external trust anchoring

Web3 / blockchainはprimary product boundaryではなく、外部trust anchorの選択肢として扱います。

## Architecture Invariant

Trust Boundaryは常に次の一方向です。

~~~text
Evidence → Schema → Sign → Store → Ledger
~~~

- Schema validationを通さずSignへ渡さない。
- StoreにSignロジックを持たせない。
- Signを通していないEvidenceをLedgerへ記録しない。
- 逆方向の依存、循環依存、理由のないLayer責務の混在を作らない。
- Architecture変更では、このTrust Boundaryへの影響を明示する。
- External anchoringはcore flow完了後のoptional boundaryとする。

## AI Agent Evidence Rules

AI Agent関連の実装では以下を優先します。

- raw prompt、raw response、secret、credential、不要なPIIをEvidenceへ保存しない。
- 可能な場合はreference、version、digest、trace/correlation IDを保存する。
- actor、agent、model、policy、tool/action、approval、side effectの文脈を明示する。
- runtime logとaudit evidenceを同一視しない。
- 収集元が信頼できない場合、暗号署名だけで「事実」と断定しない。
- collector追加時も既存のEvidenceProcessingService trust boundaryを迂回しない。

AI Agent evidence profileの基準文書:

- `docs/ai-agent-evidence-profile.md`
- `schemas/ai-agent-evidence.schema.json`

## Before Writing Code

新しい実装を作る前に、必ず次を確認します。

1. `docs/module-registry.md`
2. 変更箇所に関連する既存コード
3. 関連テスト
4. AI Agent profile変更の場合は `docs/ai-agent-evidence-profile.md`

責務が既存実装と大きく重複する場合、新規モジュールを作るより既存モジュールの拡張を優先します。

## Documentation Map

- `docs/module-registry.md`: current implementationのcanonical index
- codeおよびtests: 実際に存在する現在の挙動とcoverage
- `docs/architecture.md` / `docs/architecture-diagram.md`: currentとtarget architecture
- `docs/ai-agent-evidence-profile.md`: AI Agent evidenceのproduct-facing profile
- `docs/adr/`: 採用した設計判断
- `docs/roadmap.md`: 将来計画

現在状態はcode、tests、module registryを照合して判断します。差異があれば推測で埋めず、変更範囲に含まれる場合だけ整合させます。

## Security Baseline

次を禁止します。

- secretsまたはcredentialsのcommit
- production private keyのローカル保存
- schema validationのbypass
- CIを通すためのsecurity testまたはSecurity Controlの無効化
- 根拠のないIAMまたはAWS KMS権限の拡大
- auditabilityを低下させる変更
- PIIまたはEvidence本文のon-chain保存
- AI Agentのraw secret/tool credentialをEvidenceへ保存すること

Semgrep、CodeQL、Dependabot、dependency-cruiser、Madge、automated tests、IAM least privilege、AWS KMS separation of duties、CloudTrail auditabilityを維持します。

## Validation

実装変更後は、原則としてpackage scriptsをSingle Interfaceとして使用します。

~~~bash
npm run check:structure
~~~

変更リスクに応じて追加の既存scriptやtestも実行し、結果を報告します。

## Communication

- 結果説明は日本語で行う。
- code、API名、AWS service名、識別子は正式名称を維持する。
- 専門用語には必要に応じて短い説明を付ける。

## AI Development OS

このRepositoryでは、KiroとCodexを同一役割の重複要員ではなく、仕様駆動と独立検証を組み合わせる開発系として使用します。

- non-trivialな変更は原則として `.kiro/specs/<feature>/` に `requirements.md`、`design.md`、`tasks.md` を用意してから実装する。
- Kiroは主にrequirements、design、task decomposition、implementation orchestrationを担当する。
- Codexは主にimplementation、debugging、test追加、independent reviewを担当する。
- security-sensitiveまたはarchitecture-sensitiveな変更は、実装担当とは別のAgentによるreviewを優先する。
- Kiro Skillsは `.kiro/skills/`、Codex Skillsは `.agents/skills/` に置く。
- production deployment、IAM権限拡大、security control削除、破壊的操作、大幅なcost増加はHuman Approvalを必須とする。
- 詳細は `docs/ai-development-os.md` を参照する。
