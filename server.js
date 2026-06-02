const express = require('express');
const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const miniLessonPacks = require('./mini-lesson-packs');

const app = express();
app.disable('x-powered-by');
const db = new Database(path.join(__dirname, 'verbmaster.db'));

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
}
app.use(securityHeaders);

/** @returns {string[] | null} null if parameter present but empty after parsing */
function parseTensesQuery(raw) {
  if (raw === undefined) return ['present', 'preterite', 'future'];
  const tenses = String(raw).split(',').map(t => t.trim()).filter(Boolean);
  return tenses.length ? tenses : null;
}

/** @returns {string[] | null} null if missing or empty */
function parseVerbsQueryRequired(raw) {
  if (raw == null || raw === '') return null;
  const vl = String(raw).split(',').map(v => v.trim()).filter(Boolean);
  return vl.length ? vl : null;
}

function parseVerbId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

app.use(express.static(path.join(__dirname, 'public')));

const lessonsDir = path.join(__dirname, 'lessons');
if (fs.existsSync(lessonsDir)) {
  app.use('/lessons', express.static(lessonsDir));
}

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
  const verbList = parseVerbsQueryRequired(req.query.verbs);
  if (!verbList) return res.status(400).json({ error: 'provide verbs' });
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
  const tenses = parseTensesQuery(req.query.tenses);
  if (!tenses) return res.status(400).json({ error: 'provide non-empty tenses list' });

  const tp = tenses.map(() => '?').join(',');
  let rows;

  if (req.query.verb_id) {
    const verbId = parseVerbId(req.query.verb_id);
    if (verbId === null) return res.status(400).json({ error: 'invalid verb_id' });
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.pronoun, c.tense, c.form
       FROM conjugations c JOIN verbs v ON v.id = c.verb_id
       WHERE c.verb_id = ? AND c.tense IN (${tp})
       ORDER BY c.tense, c.pronoun`
    ).all(verbId, ...tenses);

  } else if (req.query.verbs) {
    const vl = parseVerbsQueryRequired(req.query.verbs);
    if (!vl) return res.status(400).json({ error: 'provide non-empty verbs list' });
    const vp = vl.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.pronoun, c.tense, c.form
       FROM conjugations c JOIN verbs v ON v.id = c.verb_id
       WHERE v.infinitive IN (${vp}) AND c.tense IN (${tp})
       ORDER BY v.infinitive, c.tense, c.pronoun`
    ).all(...vl, ...tenses);

  } else if (req.query.max_importance) {
    const maxI = parseInt(req.query.max_importance, 10);
    if (!Number.isFinite(maxI)) return res.status(400).json({ error: 'invalid max_importance' });
    const minI = req.query.min_importance ? parseInt(req.query.min_importance, 10) : null;
    if (req.query.min_importance != null && req.query.min_importance !== '' && !Number.isFinite(minI))
      return res.status(400).json({ error: 'invalid min_importance' });
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
  const limitRaw = parseInt(req.query.limit, 10);
  const limit  = Math.min(Number.isFinite(limitRaw) ? limitRaw : 200, 500);
  const minImportanceRaw = req.query.min_importance ? parseInt(req.query.min_importance, 10) : null;
  const minImportance = minImportanceRaw != null && Number.isFinite(minImportanceRaw) ? minImportanceRaw : null;
  if (req.query.min_importance != null && req.query.min_importance !== '' && minImportance === null)
    return res.status(400).json({ error: 'invalid min_importance' });

  let tenses = null;
  if (req.query.tenses !== undefined) {
    const parsed = String(req.query.tenses).split(',').map(t => t.trim()).filter(Boolean);
    if (!parsed.length) return res.status(400).json({ error: 'provide non-empty tenses list' });
    tenses = parsed;
  }

  const tp = tenses ? tenses.map(() => '?').join(',') : null;
  const tenseClause = tenses ? `AND s.tense IN (${tp})` : '';
  const tenseArgs   = tenses || [];

  let rows;

  if (req.query.verb_id) {
    const verbId = parseVerbId(req.query.verb_id);
    if (verbId === null) return res.status(400).json({ error: 'invalid verb_id' });
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, s.sentence_es, s.sentence_en, s.tense,
              s.pronoun, s.conjugated_form, s.importance, s.audio_hash
       FROM example_sentences s JOIN verbs v ON v.id = s.verb_id
       WHERE s.verb_id = ? ${tenseClause}
       ORDER BY s.importance ASC NULLS LAST LIMIT ?`
    ).all(verbId, ...tenseArgs, limit);

  } else if (req.query.verbs) {
    const vl = parseVerbsQueryRequired(req.query.verbs);
    if (!vl) return res.status(400).json({ error: 'provide non-empty verbs list' });
    const vp = vl.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, s.sentence_es, s.sentence_en, s.tense,
              s.pronoun, s.conjugated_form, s.importance, s.audio_hash
       FROM example_sentences s JOIN verbs v ON v.id = s.verb_id
       WHERE v.infinitive IN (${vp}) ${tenseClause}
       ORDER BY s.importance ASC NULLS LAST LIMIT ?`
    ).all(...vl, ...tenseArgs, limit);

  } else if (req.query.max_importance) {
    const maxImp = parseInt(req.query.max_importance, 10);
    if (!Number.isFinite(maxImp)) return res.status(400).json({ error: 'invalid max_importance' });
    const importanceClause = minImportance ? 'v.importance >= ? AND v.importance <= ?' : 'v.importance <= ?';
    const importanceArgs = minImportance ? [minImportance, maxImp] : [maxImp];
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
  const minImportanceRaw = req.query.min_importance ? parseInt(req.query.min_importance, 10) : null;
  const minImportance = minImportanceRaw != null && Number.isFinite(minImportanceRaw) ? minImportanceRaw : null;
  if (req.query.min_importance != null && req.query.min_importance !== '' && minImportance === null)
    return res.status(400).json({ error: 'invalid min_importance' });
  let rows;

  if (req.query.verbs) {
    const vl = parseVerbsQueryRequired(req.query.verbs);
    if (!vl) return res.status(400).json({ error: 'provide non-empty verbs list' });
    const vp = vl.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.register, c.turn_order, c.speaker, c.phrase_es, c.phrase_en
       FROM conversations c JOIN verbs v ON v.id = c.verb_id
       WHERE v.infinitive IN (${vp})
       ORDER BY v.importance, v.infinitive, c.register, c.turn_order`
    ).all(...vl);

  } else if (req.query.max_importance) {
    const maxImp = parseInt(req.query.max_importance, 10);
    if (!Number.isFinite(maxImp)) return res.status(400).json({ error: 'invalid max_importance' });
    const importanceClause = minImportance ? 'v.importance >= ? AND v.importance <= ?' : 'v.importance <= ?';
    const importanceArgs = minImportance ? [minImportance, maxImp] : [maxImp];
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.register, c.turn_order, c.speaker, c.phrase_es, c.phrase_en
       FROM conversations c JOIN verbs v ON v.id = c.verb_id
       WHERE ${importanceClause}
       ORDER BY v.importance, v.infinitive, c.register, c.turn_order`
    ).all(...importanceArgs);

  } else if (req.query.verb_id) {
    const verbId = parseVerbId(req.query.verb_id);
    if (verbId === null) return res.status(400).json({ error: 'invalid verb_id' });
    rows = db.prepare(
      `SELECT v.infinitive, v.meaning, c.register, c.turn_order, c.speaker, c.phrase_es, c.phrase_en
       FROM conversations c JOIN verbs v ON v.id = c.verb_id
       WHERE v.id = ?
       ORDER BY c.register, c.turn_order`
    ).all(verbId);

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

// ── Mini lessons (markdown packs under mini-lessons/packs/) ────────────────

app.get('/api/mini-lessons', (req, res) => {
  try {
    res.json({ packs: miniLessonPacks.listPacks() });
  } catch {
    res.status(500).json({ error: 'failed to list mini-lessons' });
  }
});

app.get('/api/mini-lessons/:packId', (req, res) => {
  const pack = miniLessonPacks.getPack(req.params.packId);
  if (!pack) return res.status(404).json({ error: 'not found' });
  res.json(pack);
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Verbmaster running on http://localhost:${PORT}`));
