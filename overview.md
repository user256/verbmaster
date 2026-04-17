# Verbmaster Redux — Overview

Rebuild of the existing Hugo/CSV static site as a proper web app with a relational database. Goal: same learning features, but with user accounts, progress tracking, and a maintainable data layer.

---

## Existing System (Hugo/CSV)

The current Verbmaster is a Hugo static site. All data lives in CSV files. There is no user state — everything resets on page reload. Key limitations to fix:

- No user accounts or progress persistence
- Conjugation data split across hundreds of individual CSV files
- No server-side logic; can't personalise difficulty or track weak spots
- Audio files stored as pre-hashed MP3s with no management layer

---

## Data Model

### Core entities

**`verbs`**
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| infinitive | varchar | e.g. `abandonar` |
| translation | varchar | e.g. `to abandon` |
| importance | int | rank 1–N; used to build practice sets |
| verb_class | enum | `ar`, `er`, `ir` |
| is_irregular | bool | |
| stem_change | varchar | e.g. `e→ie`, null if none |

**`conjugations`** — one row per pronoun × verb × tense
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| verb_id | int FK | → verbs |
| pronoun | varchar | yo, tú, él/ella/Ud., nosotros, vosotros, ellos/Uds. |
| tense | enum | `present`, `preterite`, `imperfect`, `conditional`, `future` |
| form | varchar | the conjugated form |

**`example_sentences`** — replaces the per-verb `-frases.csv` files
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| verb_id | int FK | → verbs |
| sentence_es | varchar | Spanish sentence with conjugated verb |
| sentence_en | varchar | English translation |
| tense | enum | same enum as conjugations |
| pronoun | varchar | |
| conjugated_form | varchar | the target word (used to blank the sentence) |
| importance | int | |
| audio_hash | varchar | MD5 hash for audio file lookup |

**`conversations`** — replaces `-informal.csv` / `-formal.csv`
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| verb_id | int FK | → verbs |
| register | enum | `informal`, `formal` |
| turn_order | int | dialogue line sequence |
| speaker | varchar | speaker label |
| phrase_es | varchar | |
| phrase_en | varchar | |

**`phrase_topics`** — replaces `phrasemaster/` CSV files
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| slug | varchar | e.g. `tourism`, `family-life` |
| title | varchar | |

**`topic_phrases`**
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| topic_id | int FK | → phrase_topics |
| phrase_es | varchar | |
| phrase_en | varchar | |
| verb | varchar | primary verb in phrase |
| audio_hash | varchar | |
| vocab_key | varchar | key for vocab dl |
| vocab_val | varchar | value for vocab dl |

**`users`**
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| email | varchar unique | |
| password_hash | varchar | bcrypt |
| created_at | timestamp | |

**`user_progress`** — spaced repetition / error tracking per user per card
| column | type | notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK | → users |
| card_type | enum | `conjugation`, `verb`, `phrase` |
| card_ref_id | int | FK to conjugations / verbs / topic_phrases depending on card_type |
| correct_count | int | |
| error_count | int | |
| last_seen | timestamp | |
| next_due | timestamp | SRS scheduling |

---

## Feature Modules

### 1. Verb Pages (`/verbos/{verb}`)

Replaces individual Hugo verb content pages.

**Tabs:**
- **Tenses** — rendered explanation of each tense with example sentences (from `example_sentences`, grouped by tense)
- **Flashcards** — conjugation flip-cards (see §4)
- **Conversations** — informal/formal dialogue viewer; tap `?` to reveal translation

**Data sources:** `verbs`, `conjugations`, `example_sentences`, `conversations`

---

### 2. Practice Sets (`/practicar/{set}`)

Replaces Hugo `practicar/` pages. A practice set is a curated list of verbs, defined either by importance threshold or explicit verb list.

**Tabs:**
- **Verbs** — linked list of verbs in the set with translations
- **Flashcards** — verb flashcards + conjugation flashcards for all verbs in set (see §3, §4)
- **Conjugation game** — type-in quiz (see §5)
- **Audio** — audio flashcards (see §6)

**Config options** (stored per page or in DB):
- `count` mode: show all verbs with importance ≤ N
- `verbs` mode: explicit list of verb slugs

---

### 3. Verb Flashcards

Flip-card: Spanish infinitive → English translation (or reversed).

**Controls:**
- Right / Wrong buttons
- Reverse toggle (swap front/back)
- Limit selector (10 / 20 / 30 / 40 / 50 / Unlimited)
- Error review: on round end, wrong cards loop until cleared

**Data source:** `verbs` (infinitive + translation)

**Progress hook:** on right/wrong, POST to `/api/progress` with `card_type=verb`, `card_ref_id`, result

---

### 4. Conjugation Flashcards

Flip-card front: `{pronoun} — {infinitive} ({tense})`  
Flip-card back: `{conjugated form}`

**Controls:**
- Tense filter multi-select: Present / Preterite / Imperfect / Conditional / Future
- "Include Conditional and Imperfect" checkbox (extends default Present/Preterite/Future set)
- Limit selector
- Right / Wrong buttons
- Error list printed on round end; "Review errors" re-queues wrong cards only

**Data source:** `conjugations` joined to `verbs`

**Key logic:**
1. Pull all conjugation rows for the active verb set
2. Apply tense filter
3. Apply limit (take last N if set)
4. Shuffle using Fisher-Yates
5. Track errors in session; on round end offer error-only re-run

**Progress hook:** POST result per card to `/api/progress`

---

### 5. Conjugation Game (Type-in Quiz)

Shown on practicar and verbos pages. User types the conjugated form; no flip-card UI.

**Flow:**
1. Pick sentence from `example_sentences`; blank out `conjugated_form` in the Spanish text
2. Show: `{sentence with blank}` + `({English translation})` + `{infinitive}` + `({tense})`
3. User types answer; submit on Enter or button click
4. Compare normalised (lowercase, strip trailing `.`) to `conjugated_form`
5. Correct → green feedback, advance; Wrong → red feedback showing correct answer, advance

**Controls:**
- Number of questions input + "Set Max" button
- Tense filter (Present / Past / Future / All)
- Hide infinitive toggle
- Hide translation toggle
- Accent insertion buttons: á é í ó ú ü ñ
- Audio playback button (plays MP3 by hash); playback speed slider (0.5× – 1.5×)
- Score + Errors counters
- "Jugar de nuevo" restart on round end

**Data source:** `example_sentences` joined to `verbs`

---

### 6. Audio Flashcards

Plays the MP3 for an example sentence; user hears and self-scores.

**Controls:** Right / Wrong buttons, playback speed slider  
**Data source:** `example_sentences` (audio_hash → `/mp3s/{hash}.mp3`)

---

### 7. Phrasemaster (`/phrasemaster/{topic}`)

Topic-based phrase learning (tourism, family life, money, etc.)

**Tabs:**
- **Conjugation cards** — phrase flashcards (see §8) + vocab cards (see §9)
- **Audio** — audio phrase cards

**Data source:** `phrase_topics`, `topic_phrases`

---

### 8. Phrase Flashcards

Flip-card: English translation → Spanish phrase (or reversed).

**Controls:**
- Right / Wrong buttons
- Reverse toggle
- Limit selector
- Score / Errors / Remaining counters
- Error review loop

**Data source:** `topic_phrases`

---

### 9. Vocab Cards

Flip-card built from the vocab dictionary extracted from phrase CSV  
(`vocab_key` / `vocab_val` columns in `topic_phrases`).

Identical flip-card UI to §8 but source is the vocabulary subset.

---

### 10. User Progress & Spaced Repetition

New in Redux — does not exist in the current Hugo site.

- Every right/wrong event from flashcard and game modules POSTs to `/api/progress`
- `user_progress` stores per-card correct/error counts and `next_due` (SRS)
- Dashboard page shows weak verbs (high error rate), due cards, and streak

---

## Tech Stack Recommendation

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js (Express) or Python (FastAPI) | Straightforward REST + SSR |
| DB | PostgreSQL | Relational; enums suit tense/register; full-text search for verb lookup |
| ORM | Prisma (Node) or SQLAlchemy (Python) | Type-safe queries; migration tooling |
| Frontend | React + Vite or plain HTML/JS | React for flashcard state; Vite for dev speed |
| Auth | JWT (httpOnly cookie) | Simple, stateless |
| Audio | Static file serve or S3 | Existing MP3s keyed by hash |
| Hosting | Railway / Fly.io | Simple Postgres + app container |

---

## Data Migration Plan

All conjugation and phrase data currently lives in CSV files. Migration steps:

1. Parse `verbs.csv` → seed `verbs` table
2. For each verb slug, parse `{verb}.csv` → seed `conjugations` (6 rows × 5 tenses = 30 rows per verb)
3. Parse `verb-frases.csv` and per-verb `-frases.csv` files → seed `example_sentences`
4. Parse `-informal.csv` / `-formal.csv` per verb → seed `conversations`
5. Parse `phrasemaster/*.csv` → seed `phrase_topics` + `topic_phrases`

Write a one-time migration script; keep CSVs as source-of-truth until DB is verified.

---

## Pages / Routes Summary

| Route | Description |
|-------|-------------|
| `/` | Home / landing |
| `/verbos` | Verb index (searchable) |
| `/verbos/:verb` | Single verb page (tenses, flashcards, conversations) |
| `/practicar` | Practice set index |
| `/practicar/:set` | Practice set page (verb list, flashcards, game, audio) |
| `/phrasemaster` | Topic index |
| `/phrasemaster/:topic` | Topic phrase page (flashcards, audio) |
| `/dashboard` | User progress dashboard (authenticated) |
| `/api/progress` | POST — record flashcard result |
| `/api/verbs` | GET — verb list with filters |
| `/api/verbs/:verb` | GET — verb detail + conjugations |
| `/api/conjugations` | GET — conjugation rows (filtered by verb, tense) |
| `/api/sentences` | GET — example sentences (filtered by verb, tense, importance) |
| `/auth/register` | POST |
| `/auth/login` | POST |
