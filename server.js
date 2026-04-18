const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'verbmaster.db'));

app.use(express.static(path.join(__dirname, 'public')));

// Serve MP3s — Docker: /app/mp3s volume, local dev: fallback to Hugo static dir
app.use('/mp3s', express.static(
  process.env.MP3_PATH || path.resolve('../Verbmaster/verbmaster/static/mp3s')
));

// ── Verbs ──────────────────────────────────────────────────────────────────

// GET /api/verbs?limit=50&offset=0&q=search
// GET /api/verbs?full=1 — entire verb list (for “random from full deck”)
app.get('/api/verbs', (req, res) => {
  if (req.query.full === '1') {
    const rows = db.prepare(
      'SELECT id, infinitive, meaning, importance FROM verbs ORDER BY importance ASC NULLS LAST'
    ).all();
    return res.json(rows);
  }

  const limit  = Math.min(parseInt(req.query.limit) || 50, 500);
  const offset = parseInt(req.query.offset) || 0;
  const q      = req.query.q ? `%${req.query.q}%` : null;

  const maxImp = req.query.max_importance ? parseInt(req.query.max_importance) : null;
  const minImp = req.query.min_importance ? parseInt(req.query.min_importance) : null;

  let rows;
  if (q) {
    rows = db.prepare(
      'SELECT id, infinitive, meaning, importance FROM verbs WHERE (infinitive LIKE ? OR meaning LIKE ?) ORDER BY importance ASC NULLS LAST LIMIT ? OFFSET ?'
    ).all(q, q, limit, offset);
  } else if (maxImp && minImp) {
    rows = db.prepare(
      'SELECT id, infinitive, meaning, importance FROM verbs WHERE importance >= ? AND importance <= ? ORDER BY importance ASC LIMIT ? OFFSET ?'
    ).all(minImp, maxImp, limit, offset);
  } else if (maxImp) {
    rows = db.prepare(
      'SELECT id, infinitive, meaning, importance FROM verbs WHERE importance <= ? ORDER BY importance ASC LIMIT ? OFFSET ?'
    ).all(maxImp, limit, offset);
  } else {
    rows = db.prepare(
      'SELECT id, infinitive, meaning, importance FROM verbs ORDER BY importance ASC NULLS LAST LIMIT ? OFFSET ?'
    ).all(limit, offset);
  }

  res.json(rows);
});

// GET /api/verbs-list?verbs=ser,estar — ordered list
app.get('/api/verbs-list', (req, res) => {
  if (!req.query.verbs) return res.status(400).json({ error: 'provide verbs' });
  const verbList = req.query.verbs.split(',').map(v => v.trim()).filter(Boolean);
  const ph = verbList.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, infinitive, meaning, importance FROM verbs WHERE infinitive IN (${ph})`
  ).all(...verbList);
  const map = Object.fromEntries(rows.map(r => [r.infinitive, r]));
  res.json(verbList.map(v => map[v]).filter(Boolean));
});

// GET /api/verbs/:infinitive — verb + full conjugation table
app.get('/api/verbs/:infinitive', (req, res) => {
  const verb = db.prepare('SELECT * FROM verbs WHERE infinitive = ?').get(req.params.infinitive);
  if (!verb) return res.status(404).json({ error: 'not found' });

  const conjugations = db.prepare(
    'SELECT pronoun, tense, form FROM conjugations WHERE verb_id = ? ORDER BY tense, pronoun'
  ).all(verb.id);

  res.json({ ...verb, conjugations });
});

// ── Conjugations ───────────────────────────────────────────────────────────

// GET /api/conjugations?verb_id=1&tenses=present,preterite
// GET /api/conjugations?verbs=ser,estar&tenses=present
// GET /api/conjugations?max_importance=50&tenses=present,preterite
app.get('/api/conjugations', (req, res) => {
  const tenses = req.query.tenses
    ? req.query.tenses.split(',').map(t => t.trim()).filter(Boolean)
    : ['present', 'preterite', 'future'];

  const tp = tenses.map(() => '?').join(',');
  let rows;

  if (req.query.verb_id) {
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.pronoun, c.tense, c.form
       FROM conjugations c JOIN verbs v ON v.id = c.verb_id
       WHERE c.verb_id = ? AND c.tense IN (${tp})
       ORDER BY c.tense, c.pronoun`
    ).all(req.query.verb_id, ...tenses);

  } else if (req.query.verbs) {
    const vl = req.query.verbs.split(',').map(v => v.trim()).filter(Boolean);
    const vp = vl.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.pronoun, c.tense, c.form
       FROM conjugations c JOIN verbs v ON v.id = c.verb_id
       WHERE v.infinitive IN (${vp}) AND c.tense IN (${tp})
       ORDER BY v.infinitive, c.tense, c.pronoun`
    ).all(...vl, ...tenses);

  } else if (req.query.max_importance) {
    const maxI = parseInt(req.query.max_importance);
    const minI = req.query.min_importance ? parseInt(req.query.min_importance) : null;
    if (minI) {
      rows = db.prepare(
        `SELECT v.infinitive, v.meaning, c.pronoun, c.tense, c.form
         FROM conjugations c JOIN verbs v ON v.id = c.verb_id
         WHERE v.importance >= ? AND v.importance <= ? AND c.tense IN (${tp})
         ORDER BY v.importance, c.tense, c.pronoun`
      ).all(minI, maxI, ...tenses);
    } else {
      rows = db.prepare(
        `SELECT v.infinitive, v.meaning, c.pronoun, c.tense, c.form
         FROM conjugations c JOIN verbs v ON v.id = c.verb_id
         WHERE v.importance <= ? AND c.tense IN (${tp})
         ORDER BY v.importance, c.tense, c.pronoun`
      ).all(maxI, ...tenses);
    }

  } else {
    return res.status(400).json({ error: 'provide verb_id, verbs, or max_importance' });
  }

  res.json(rows);
});

// ── Example sentences ──────────────────────────────────────────────────────

// GET /api/sentences?verb_id=1&tenses=preterite&limit=20
// GET /api/sentences?verbs=ser,estar&tenses=present
// GET /api/sentences?max_importance=50
app.get('/api/sentences', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 200, 500);
  const minImportance = req.query.min_importance ? parseInt(req.query.min_importance) : null;
  const tenses = req.query.tenses
    ? req.query.tenses.split(',').map(t => t.trim()).filter(Boolean)
    : null;

  const tp = tenses ? tenses.map(() => '?').join(',') : null;
  const tenseClause = tenses ? `AND s.tense IN (${tp})` : '';
  const tenseArgs   = tenses || [];

  let rows;

  if (req.query.verb_id) {
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, s.sentence_es, s.sentence_en, s.tense,
              s.pronoun, s.conjugated_form, s.importance, s.audio_hash
       FROM example_sentences s JOIN verbs v ON v.id = s.verb_id
       WHERE s.verb_id = ? ${tenseClause}
       ORDER BY s.importance ASC NULLS LAST LIMIT ?`
    ).all(req.query.verb_id, ...tenseArgs, limit);

  } else if (req.query.verbs) {
    const vl = req.query.verbs.split(',').map(v => v.trim()).filter(Boolean);
    const vp = vl.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, s.sentence_es, s.sentence_en, s.tense,
              s.pronoun, s.conjugated_form, s.importance, s.audio_hash
       FROM example_sentences s JOIN verbs v ON v.id = s.verb_id
       WHERE v.infinitive IN (${vp}) ${tenseClause}
       ORDER BY s.importance ASC NULLS LAST LIMIT ?`
    ).all(...vl, ...tenseArgs, limit);

  } else if (req.query.max_importance) {
    const importanceClause = minImportance ? 'v.importance >= ? AND v.importance <= ?' : 'v.importance <= ?';
    const importanceArgs = minImportance ? [minImportance, parseInt(req.query.max_importance)] : [parseInt(req.query.max_importance)];
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, s.sentence_es, s.sentence_en, s.tense,
              s.pronoun, s.conjugated_form, s.importance, s.audio_hash
       FROM example_sentences s JOIN verbs v ON v.id = s.verb_id
       WHERE ${importanceClause} ${tenseClause}
       ORDER BY v.importance, s.importance ASC NULLS LAST LIMIT ?`
    ).all(...importanceArgs, ...tenseArgs, limit);

  } else {
    return res.status(400).json({ error: 'provide verb_id, verbs, or max_importance' });
  }

  res.json(rows);
});

// ── Conversations ──────────────────────────────────────────────────────────

// GET /api/conversations?verbs=ser,estar
// GET /api/conversations?max_importance=50
app.get('/api/conversations', (req, res) => {
  const minImportance = req.query.min_importance ? parseInt(req.query.min_importance) : null;
  let rows;

  if (req.query.verbs) {
    const vl = req.query.verbs.split(',').map(v => v.trim()).filter(Boolean);
    if (!vl.length) return res.json([]);
    const vp = vl.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.register, c.turn_order, c.speaker, c.phrase_es, c.phrase_en
       FROM conversations c JOIN verbs v ON v.id = c.verb_id
       WHERE v.infinitive IN (${vp})
       ORDER BY v.importance, v.infinitive, c.register, c.turn_order`
    ).all(...vl);

  } else if (req.query.max_importance) {
    const importanceClause = minImportance ? 'v.importance >= ? AND v.importance <= ?' : 'v.importance <= ?';
    const importanceArgs = minImportance ? [minImportance, parseInt(req.query.max_importance)] : [parseInt(req.query.max_importance)];
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.register, c.turn_order, c.speaker, c.phrase_es, c.phrase_en
       FROM conversations c JOIN verbs v ON v.id = c.verb_id
       WHERE ${importanceClause}
       ORDER BY v.importance, v.infinitive, c.register, c.turn_order`
    ).all(...importanceArgs);

  } else if (req.query.verb_id) {
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.register, c.turn_order, c.speaker, c.phrase_es, c.phrase_en
       FROM conversations c JOIN verbs v ON v.id = c.verb_id
       WHERE v.id = ?
       ORDER BY c.register, c.turn_order`
    ).all(req.query.verb_id);

  } else {
    return res.status(400).json({ error: 'provide verb_id, verbs, or max_importance' });
  }

  res.json(rows);
});

// GET /api/conversations/:infinitive
app.get('/api/conversations/:infinitive', (req, res) => {
  const verb = db.prepare('SELECT id FROM verbs WHERE infinitive = ?').get(req.params.infinitive);
  if (!verb) return res.status(404).json({ error: 'not found' });

  const rows = db.prepare(
    `SELECT register, turn_order, speaker, phrase_es, phrase_en
     FROM conversations WHERE verb_id = ? ORDER BY register, turn_order`
  ).all(verb.id);

  const informal = rows.filter(r => r.register === 'informal');
  const formal   = rows.filter(r => r.register === 'formal');
  res.json({ informal, formal });
});

// ── Phrasemaster ───────────────────────────────────────────────────────────

// GET /api/topics
app.get('/api/topics', (req, res) => {
  res.json(db.prepare('SELECT id, slug, title FROM phrase_topics ORDER BY title').all());
});

// GET /api/topics/:slug
app.get('/api/topics/:slug', (req, res) => {
  const topic = db.prepare('SELECT * FROM phrase_topics WHERE slug = ?').get(req.params.slug);
  if (!topic) return res.status(404).json({ error: 'not found' });

  const phrases = db.prepare(
    'SELECT id, phrase_es, phrase_en, key_verb, audio_hash FROM topic_phrases WHERE topic_id = ? ORDER BY id'
  ).all(topic.id);

  res.json({ ...topic, phrases });
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Verbmaster running on http://localhost:${PORT}`));
