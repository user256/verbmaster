# 007 - QA and content validation

## Goal

Validate that the first mini-lesson pack is structurally correct and faithful to source content.

## Scope

- Verify counts per stage against source sections.
- Verify text integrity (accents, punctuation, ordering).
- Verify progression rules are represented in pack metadata.

## Acceptance Criteria

- Stage counts match source:
  - verbs: 8
  - phrases: 16
  - sentences: 7
- No malformed `{ es, en }` entries.
- Pack references original lesson source path.

## Dependencies

- `003-build-stage-1-verb-cards.md`
- `004-build-stage-2-phrase-cards.md`
- `005-build-stage-3-sentence-drills.md`
- `006-wire-mini-lesson-pack-entrypoint.md`
