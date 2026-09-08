# Loop Engineering v0.2 Requirements

## Purpose

AIとの会話を一時的なinterfaceとして扱い、Repository内のMarkdownを継続状態として残す。

## Requirements

- `knowledge/` をObsidian互換のMarkdown Vaultとして追加する。
- `knowledge/00-inbox/` を人間の入力入口とする。
- non-trivialなAI編集はbranchまたはgit worktree上で行う。
- mainのknowledgeをAIが直接破壊的に変更しない。
- noteは `supports`、`contradicts`、`supersedes` をrelation metadataとして使用できる。
- AI生成knowledgeはstatus、source、review情報を持てる。
- past decisionは原則削除せず、append / supersedeで履歴を残す。
- security-sensitive / architecture-sensitiveなknowledge変更は独立reviewを優先する。
- raw prompt、raw response、secret、credential、不要なPIIを保存しない。
- 既存の `Evidence → Schema → Sign → Store → Ledger` invariantを変更しない。
- AWS resource、production dependency、recurring costを追加しない。
