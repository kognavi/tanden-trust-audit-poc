# Knowledge Metadata Validation Design

## Components

- `scripts/validate-knowledge-metadata.js`
  - knowledge Markdown discovery
  - constrained YAML-like frontmatter parsing
  - per-note validation
  - unique ID and relation integrity validation
  - CLI exit status
- `tests/knowledge-metadata.test.js`
  - parser and validation behavior
- `package.json`
  - `validate:knowledge` command
  - `check:structure` integration

## Parsing boundary

General-purpose YAML parserは実装しない。Repositoryのknowledge templateで使用する次のsubsetのみ扱う。

- scalar: `key: value`
- inline empty list: `key: []`
- block list:
  - `key:`
  - subsequent `- value`

未知の複雑なYAML構造を暗黙解釈せず、必要なmetadata fieldだけを読み取る。

## Validation flow

```text
discover notes
  ↓
parse frontmatter
  ↓
validate required fields/status
  ↓
build id index
  ↓
validate duplicate IDs
  ↓
validate relation targets
  ↓
report all errors
```

## Security / cost

- filesystem read only
- network accessなし
- AWS APIなし
- external dependency追加なし
- Evidence trust boundaryへの影響なし
