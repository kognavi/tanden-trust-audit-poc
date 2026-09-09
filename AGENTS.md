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
- `docs/ai-development-os.md`: AI Development OSの運用モデル
- `docs/loop-engineering.md`: Repository knowledge loopの運用モデル
- `knowledge/`: AIとHumanが共有するGit管理済みMarkdown knowledge vault

現在状態はcode、tests、module registryを照合して判断します。差異があれば推測で埋めず、変更範囲に含まれる場合だけ整合させます。

## Knowledge Loop Rules

AIとの会話そのものを長期状態の正本にしません。継続状態はRepository内のMarkdownとGit historyに残します。

- 未整理の思考、仮説、調査メモはまず `knowledge/00-inbox/` に置く。
- non-trivialなAI編集はbranchまたはgit worktreeで行い、mainのknowledgeを直接破壊的に書き換えない。
- 過去の設計判断や知識は原則として削除せず、新しいnoteから `supports`、`contradicts`、`supersedes` で関係を明示する。
- AI生成knowledgeはstatus、source、review情報を持てる形にする。
- security-sensitive / architecture-sensitiveなknowledge変更は実装担当とは別のAgentによるreviewを優先する。
- raw prompt、raw response、secret、credential、不要なPIIをknowledgeへ保存しない。
- knowledge noteはcode/tests/module registryより強いcurrent implementation truthとして扱わない。
- 詳細は `docs/loop-engineering.md` と `.kiro/specs/loop-engineering/` を参照する。

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

## Cost Guardrails

このRepositoryはportfolio PoCであり、default運用は **Local-first / AWS-on-demand** とします。

- 通常のdevelopmentとCIではreal AWS APIを呼ばない。
- AWS credentials/OIDCをdefault CIへ要求しない。
- NAT Gateway、persistent RDS/Aurora、OpenSearch、always-on ECS/EC2、provisioned model throughputをbaselineへ追加しない。
- real AWS integrationはmanual triggerかつ明示的Human Approvalを必要とする。
- AWS上の実証ではshort-lived resourceを優先し、実証後にcleanupする。
- recurring AWS costを発生させる変更はmerge前にHuman Approvalを必須とする。
- 詳細は `docs/cost-guardrails.md` を参照する。

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
- Loop Engineeringではチャットではなく `knowledge/` とGit historyを継続状態として使用する。
- non-trivialな新規featureでは、原則として `knowledge/20-research/context-packs/` のContext PackをSpec handoff入力とする。
- Context PackからSpecへ移る場合は `npm run spec:scaffold -- <context-pack-path> <feature-slug>` で3ファイルの標準骨格を作り、Kiro/Codexがcode/tests/module registryを照合して内容を確定する。
- generated scaffoldは承認済み仕様ではない。placeholderを残したままimplementationへ進まない。
- implementation開始前に `npm run spec:ready -- <feature-slug>` を実行し、Spec Readiness Gateがpassしていることを確認する。
- Spec Readiness Gateは最低限の完成条件を検査するだけで、要件妥当性や設計品質のHuman/Agent reviewを代替しない。
- Spec Readiness Gate通過後、`npm run impl:handoff -- <feature-slug>` でImplementation Handoff manifestを生成し、Source Context Pack / Spec / branch/worktree提案 / PR provenanceを実装担当へ渡す。
- Implementation Handoff generatorはgit branch/worktree/pushを自動実行しない。実Git操作はHuman/Developerが状態を確認して実行する。
- implementation完了後かつPR作成前に `npm run impl:conform -- <feature-slug> [base-ref]` を実行し、changed filesがreview済みSpecのAffected Componentsとprovenanceに適合することを確認する。
- Implementation Conformance Gateは意味的な要件適合を証明しない。scope drift/provenance driftを検出する補助Gateであり、independent reviewを代替しない。
- 詳細は `docs/ai-development-os.md` を参照する。
