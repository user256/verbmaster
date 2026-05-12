# 002 - Ingest village life source

## Goal

Transform `lessons/1-village-life.md` into normalized staged mini-lesson data.

## Scope

- Read the source sections: verbs, phrases and expressions, sentences.
- Normalize entries into `{ es, en }` pairs.
- Preserve source order and accents.

## Acceptance Criteria

- A lesson pack file exists for village life.
- All entries are represented in the correct stage.
- No source text corruption (punctuation/diacritics preserved).

## Dependencies

- `001-create-mini-lesson-structure.md`
