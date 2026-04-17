const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'verbmaster.db'), { readonly: true });

const verbs = db.prepare(
  'SELECT id, infinitive, meaning, importance FROM verbs ORDER BY importance ASC NULLS LAST, infinitive'
).all();

const conjugations = db.prepare(
  `SELECT v.infinitive, v.meaning, c.pronoun, c.tense, c.form
   FROM conjugations c JOIN verbs v ON v.id = c.verb_id
   ORDER BY v.importance ASC NULLS LAST, v.infinitive, c.tense, c.pronoun`
).all();

const data = {
  generated_at: new Date().toISOString(),
  verbs,
  conjugations
};

const output = path.join(__dirname, 'public', 'offline-data.json');
fs.writeFileSync(output, JSON.stringify(data));
console.log(`Wrote ${output}: ${verbs.length} verbs, ${conjugations.length} conjugations`);
