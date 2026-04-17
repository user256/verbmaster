#!/usr/bin/env node
// Seeds SQLite DB from existing CSV files

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const CSV_DIR = path.resolve('../Verbmaster/verbmaster/csv');
const VERBS_CSV   = path.join(CSV_DIR, 'verbs.csv');
const FRASES_CSV  = path.join(CSV_DIR, 'verb-frases.csv');
const DB_PATH = path.resolve('./verbmaster.db');

if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE verbs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    infinitive TEXT NOT NULL UNIQUE,
    meaning    TEXT NOT NULL,
    importance INTEGER
  );

  CREATE TABLE conjugations (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    verb_id INTEGER NOT NULL REFERENCES verbs(id),
    pronoun TEXT NOT NULL,
    tense   TEXT NOT NULL CHECK(tense IN ('present','preterite','imperfect','conditional','future')),
    form    TEXT NOT NULL
  );

  CREATE TABLE example_sentences (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    verb_id        INTEGER NOT NULL REFERENCES verbs(id),
    sentence_es    TEXT NOT NULL,
    sentence_en    TEXT NOT NULL,
    tense          TEXT NOT NULL,
    pronoun        TEXT,
    conjugated_form TEXT NOT NULL,
    importance     INTEGER,
    audio_hash     TEXT
  );

  CREATE TABLE conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    verb_id    INTEGER NOT NULL REFERENCES verbs(id),
    register   TEXT NOT NULL CHECK(register IN ('informal','formal')),
    turn_order INTEGER NOT NULL,
    speaker    TEXT,
    phrase_es  TEXT NOT NULL,
    phrase_en  TEXT NOT NULL
  );

  CREATE TABLE phrase_topics (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    slug  TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL
  );

  CREATE TABLE topic_phrases (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id  INTEGER NOT NULL REFERENCES phrase_topics(id),
    phrase_es TEXT NOT NULL,
    phrase_en TEXT NOT NULL,
    key_verb  TEXT,
    audio_hash TEXT
  );

  CREATE INDEX idx_conj_verb   ON conjugations(verb_id);
  CREATE INDEX idx_conj_tense  ON conjugations(tense);
  CREATE INDEX idx_sent_verb   ON example_sentences(verb_id);
  CREATE INDEX idx_conv_verb   ON conversations(verb_id);
  CREATE INDEX idx_tp_topic    ON topic_phrases(topic_id);
`);

// ── CSV parser ─────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

function readCSV(filepath) {
  if (!fs.existsSync(filepath)) return null;
  const content = fs.readFileSync(filepath, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  return lines.slice(1).map(parseCSVLine);
}

// ── Tense normaliser ───────────────────────────────────────────────────────
const TENSE_MAP = { past: 'preterite', present: 'present', future: 'future',
  preterite: 'preterite', imperfect: 'imperfect', conditional: 'conditional' };
function normaliseTense(t) {
  return TENSE_MAP[t.toLowerCase()] || null;
}

const VALID_TENSES = new Set(['present','preterite','imperfect','conditional','future']);

// ── Prepared statements ────────────────────────────────────────────────────
const insertVerb  = db.prepare('INSERT OR IGNORE INTO verbs (infinitive, meaning, importance) VALUES (?, ?, ?)');
const insertConj  = db.prepare('INSERT INTO conjugations (verb_id, pronoun, tense, form) VALUES (?, ?, ?, ?)');
const insertSent  = db.prepare('INSERT INTO example_sentences (verb_id, sentence_es, sentence_en, tense, pronoun, conjugated_form, importance, audio_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const insertConv  = db.prepare('INSERT INTO conversations (verb_id, register, turn_order, speaker, phrase_es, phrase_en) VALUES (?, ?, ?, ?, ?, ?)');
const insertTopic = db.prepare('INSERT OR IGNORE INTO phrase_topics (slug, title) VALUES (?, ?)');
const insertPhrase = db.prepare('INSERT INTO topic_phrases (topic_id, phrase_es, phrase_en, key_verb, audio_hash) VALUES (?, ?, ?, ?, ?)');
const getVerb     = db.prepare('SELECT id FROM verbs WHERE infinitive = ?');
const getTopic    = db.prepare('SELECT id FROM phrase_topics WHERE slug = ?');

const CONJ_COLS = ['present','preterite','imperfect','conditional','future'];

// ── Topic title map ────────────────────────────────────────────────────────
const TOPIC_TITLES = {
  'asking-questions':    'Asking Questions',
  'being-enthusiastic':  'Being Enthusiastic',
  'daily-interactions':  'Daily Interactions',
  'daily-life':          'Daily Life',
  'essential-phrases':   'Essential Phrases',
  'family-life':         'Family Life',
  'future-plans':        'Future Plans',
  'gerundio-mixed':      'Gerundio Mixed',
  'Irregular-gerundio':  'Irregular Gerundio',
  'Irregular gerundio':  'Irregular Gerundio',
  'location-prepositions':'Location Prepositions',
  'money':               'Money',
  'recent-activities':   'Recent Activities',
  'recent-events':       'Recent Events',
  'reflexive-verbs':     'Reflexive Verbs',
  'tourism-attractions': 'Tourism Attractions',
  'tourism-entertainment':'Tourism Entertainment',
  'tourism-etiquette':   'Tourism Etiquette',
  'tourism-food':        'Tourism & Food',
  'tourism-hotel':       'Tourism Hotel',
  'tourism-money':       'Tourism & Money',
  'tourism-navigation':  'Tourism Navigation',
  'tourism':             'Tourism',
};

// ── Seed ───────────────────────────────────────────────────────────────────
const seedAll = db.transaction(() => {

  // 1. Verbs + conjugations
  let verbCount = 0, conjCount = 0, verbSkipped = 0;
  const verbsRows = readCSV(VERBS_CSV);
  for (const row of verbsRows) {
    const infinitive = row[0];
    const meaning    = row[1];
    const importance = parseInt(row[4]) || null;
    if (!infinitive || !meaning) continue;

    insertVerb.run(infinitive, meaning, importance);
    const verb = getVerb.get(infinitive);
    if (!verb) continue;

    const conjCSV = path.join(CSV_DIR, `${infinitive}.csv`);
    const conjRows = readCSV(conjCSV);
    if (!conjRows) { verbSkipped++; continue; }

    for (const conjRow of conjRows) {
      const pronoun = conjRow[0];
      if (!pronoun) continue;
      for (let i = 0; i < CONJ_COLS.length; i++) {
        const form = conjRow[i + 1];
        if (form) { insertConj.run(verb.id, pronoun, CONJ_COLS[i], form); conjCount++; }
      }
    }
    verbCount++;
  }
  console.log(`Verbs: ${verbCount} seeded, ${verbSkipped} skipped. Conjugations: ${conjCount}`);

  // 2. Example sentences (combined verb-frases.csv)
  // cols: row, sentence, english translation, tense, pronoun, unconjugated verb, conjugated verb, Importance, hash
  let sentCount = 0, sentSkipped = 0;
  const frasesRows = readCSV(FRASES_CSV);
  for (const row of frasesRows) {
    const sentence_es     = row[1];
    const sentence_en     = row[2];
    const tenseRaw        = row[3];
    const pronoun         = row[4];
    const infinitive      = row[5];
    const conjugated_form = row[6];
    const importance      = parseInt(row[7]) || null;
    const audio_hash      = row[8] || null;

    if (!sentence_es || !infinitive || !conjugated_form) continue;
    const tense = normaliseTense(tenseRaw);
    if (!tense) { sentSkipped++; continue; }

    const verb = getVerb.get(infinitive);
    if (!verb) { sentSkipped++; continue; }

    insertSent.run(verb.id, sentence_es, sentence_en || '', tense, pronoun || '', conjugated_form, importance, audio_hash);
    sentCount++;
  }
  console.log(`Sentences: ${sentCount} seeded, ${sentSkipped} skipped`);

  // 3. Conversations (per-verb informal/formal CSVs)
  // cols: row, speaker, phrase, translation
  let convCount = 0;
  const verbResult = db.prepare('SELECT id, infinitive FROM verbs').all();
  for (const verb of verbResult) {
    for (const register of ['informal', 'formal']) {
      const csvPath = path.join(CSV_DIR, `${verb.infinitive}-${register}.csv`);
      const rows = readCSV(csvPath);
      if (!rows) continue;
      rows.forEach((row, i) => {
        const speaker   = row[1] || '';
        const phrase_es = row[2];
        const phrase_en = row[3];
        if (!phrase_es) return;
        insertConv.run(verb.id, register, i, speaker, phrase_es, phrase_en || '');
        convCount++;
      });
    }
  }
  console.log(`Conversations: ${convCount} lines seeded`);

  // 4. Phrasemaster topics + phrases
  // cols: row, phrase, translation, personal pronoun, preposition/key verb, meaning, tense, key vocabulary, english vocabulary, page, hash
  // (some files have fewer cols — use indices carefully)
  let topicCount = 0, phraseCount = 0;
  const pmDir = path.join(CSV_DIR, 'phrasemaster');
  const pmFiles = fs.readdirSync(pmDir).filter(f => f.endsWith('.csv'));

  for (const fname of pmFiles) {
    const slug  = fname.replace(/\.csv$/, '');
    const title = TOPIC_TITLES[slug] || slug;
    insertTopic.run(slug, title);
    const topic = getTopic.get(slug);
    topicCount++;

    const rows = readCSV(path.join(pmDir, fname));
    if (!rows) continue;

    for (const row of rows) {
      const phrase_es = row[1];
      const phrase_en = row[2];
      if (!phrase_es) continue;

      // hash is last non-empty col
      const audio_hash = row[row.length - 1] || null;
      // key verb: col 4 (meaning/key verb) when present
      const key_verb = row[4] || null;

      insertPhrase.run(topic.id, phrase_es, phrase_en || '', key_verb, audio_hash);
      phraseCount++;
    }
  }
  console.log(`Topics: ${topicCount}, phrases: ${phraseCount}`);
});

seedAll();
db.close();
console.log('Done.');
