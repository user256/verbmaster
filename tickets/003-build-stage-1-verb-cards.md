# 003 - Build stage 1 verb cards

## Goal

Create stage 1 flashcard-ready verb pairs for the village life mini-lesson.

## Scope

- Populate `stage_1_verbs` with Spanish to English pairs.
- Keep one canonical pair per source line.
- Keep order consistent with source lesson.

## Acceptance Criteria

- `stage_1_verbs` is present and non-empty.
- All verb lines from source are included exactly once.
- Entries are valid `{ es, en }` pairs.

## Dependencies

- `002-ingest-village-life-source.md`
