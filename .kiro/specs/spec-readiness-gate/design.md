# Spec Readiness Gate Design

## Flow

```text
.kiro/specs/<feature>/
  ↓
requirements/design/tasks existence
  ↓
Source Context Pack consistency
  ↓
required sections
  ↓
placeholder scan
  ↓
Open Questions scan
  ↓
Review Checklist scan
  ↓
READY / NOT READY
```

## Parsing

General Markdown parserは追加しない。

- ATX heading `## ...` をsection boundaryとして扱う。
- Source Context Packは既存scaffold形式から抽出する。
- unchecked checkboxは `- [ ]` を検出する。
- placeholderは `<...>` を検出する。
- Open Questionsはsection内のnon-empty bulletを未解決と扱う。
- `None` または `Resolved: none` の明示を解決済みとして許可する。

## Safety

- filesystem read-only
- networkなし
- AWS APIなし
- implementation自動化なし
