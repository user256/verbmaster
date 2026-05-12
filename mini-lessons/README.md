# Mini Lessons

This directory contains standalone mini-lesson packs that are separate from
raw lesson source notes in `lessons/`.

## Purpose

Each mini-lesson uses a fixed 3-stage progression:

1. Stage 1: verbs (flashcards)
2. Stage 2: phrases and expressions (flashcards)
3. Stage 3: sentences (consolidation drills)

## Naming

- Lesson packs live in `mini-lessons/packs/`.
- Pack files are numbered and slugged: `NNN-topic-name.md`.
- The pack list lives in `mini-lessons/index.md`.

## Pack Schema (v1)

Each pack file contains:

- `lesson_meta`
  - `id`
  - `slug`
  - `title`
  - `topic`
  - `order`
  - `source_lesson`
- `progression_rules`
  - `unlock_stage_2_after_stage_1`
  - `unlock_stage_3_after_stage_2`
- `stage_1_verbs` as `{ es, en }` pairs
- `stage_2_phrases` as `{ es, en }` pairs
- `stage_3_sentences` as `{ es, en }` pairs

## Authoring Rules

- Preserve source ordering from the lesson note.
- Preserve accents and punctuation.
- Keep Spanish on `es` and English on `en`.
- Keep lesson source notes immutable; update packs in this directory instead.
