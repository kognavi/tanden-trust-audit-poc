# Context Pack Generator Design

## Flow

```text
Inbox note
  ↓
safe path validation
  ↓
token extraction
  ↓
repository file discovery
  ↓
keyword/path scoring
  ↓
top related files
  ↓
Context Pack Markdown
  ↓
Human / Agent review
```

## Retrieval

### Mandatory
- AGENTS.md

### Ranked scopes
- .kiro/specs/
- docs/
- lib/
- tests/
- knowledge/

### Scoring
- input noteから英数字technical tokenを抽出する。
- candidate pathにtokenが含まれる場合は高いweight。
- candidate contentにtokenが含まれる場合はfrequency capped score。
- exact input fileは除外する。
- score 0の候補は出力しない。
- tieはpathのlexicographic orderで安定化する。

## Output sections

- Intent
- Repository Rules
- Related Files
- Extracted Constraints
- Review Checklist

初版ではLLM summaryを生成しない。ConstraintはRepository-wideの固定安全ルールをContext Packへ明示する。

## Security

- resolved input pathがrepository root外なら拒否。
- binary/large generated directoryを探索しない。
- secrets検出を目的にファイル内容を広く出力しない。Context Packにはpathとscoreのみを基本とする。
- private key拡張子は探索除外する。
