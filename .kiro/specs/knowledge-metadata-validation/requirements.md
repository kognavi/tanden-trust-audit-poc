# Knowledge Metadata Validation Requirements

## Purpose

Repository knowledge vaultの確定知識が、Loopを重ねても機械的に検証可能な最低限のmetadata品質を維持する。

## Requirements

- Node.js標準機能だけで動作し、新規runtime/development dependencyを追加しない。
- `knowledge/` 配下のMarkdown noteを検査する。
- `README.md` と `knowledge/templates/` はvalidation対象外とする。
- 対象noteはfrontmatterを持つ。
- `id`、`type`、`status`、`created`、`updated`、`source`、`supports`、`contradicts`、`supersedes`、`reviewed_by` を持つ。
- statusは `inbox`、`draft`、`reviewed`、`approved`、`superseded` のいずれかとする。
- idはknowledge vault内で一意とする。
- `supports`、`contradicts`、`supersedes` の非空値は存在するnote idを参照する。
- `reviewed` / `approved` noteは `source` と `reviewed_by` を1件以上持つ。
- validation failureでは非0 exit codeを返すCLIを提供する。
- `npm run check:structure` にknowledge validationを統合する。
- Evidence処理のTrust BoundaryおよびAWS resourceを変更しない。
