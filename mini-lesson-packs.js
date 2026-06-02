const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const PACKS_DIR = path.join(__dirname, 'mini-lessons', 'packs');
const PACK_ID_RE = /^[a-zA-Z0-9-]+$/;

function splitFrontMatter(raw) {
  const m = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  let fm;
  try {
    fm = YAML.parse(m[1]);
  } catch {
    return null;
  }
  return { fm, body: m[2] };
}

function parseStageItems(block) {
  const items = [];
  const lines = block.split(/\r?\n/);
  let cur = null;
  for (const line of lines) {
    const esM = line.match(/^-\s*es:\s*(.+)$/);
    const enM = line.match(/^\s{2,}en:\s*(.+)$/);
    if (esM) {
      if (cur && cur.es) items.push(cur);
      cur = { es: esM[1].trim(), en: '' };
    } else if (enM && cur) {
      cur.en = enM[1].trim();
    }
  }
  if (cur && cur.es) items.push(cur);
  return items;
}

function parseStages(body) {
  const stages = {};
  const re = /^## (stage_\d+_\w+)\s*$/gm;
  const headers = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    headers.push({ name: m[1], index: m.index, headerEnd: m.index + m[0].length });
  }
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].headerEnd;
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    stages[headers[i].name] = parseStageItems(body.slice(start, end));
  }
  return stages;
}

function parseTitleLine(body) {
  const match = body.match(/^\s*#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function listPacks() {
  if (!fs.existsSync(PACKS_DIR)) return [];
  const files = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.md')).sort();
  const packs = [];
  for (const file of files) {
    const id = path.basename(file, '.md');
    if (!PACK_ID_RE.test(id)) continue;
    const raw = fs.readFileSync(path.join(PACKS_DIR, file), 'utf8');
    const sp = splitFrontMatter(raw);
    if (!sp || !sp.fm || !sp.fm.lesson_meta) continue;
    const meta = sp.fm.lesson_meta;
    packs.push({
      id,
      title: meta.title || id,
      slug: meta.slug || '',
      topic: meta.topic || '',
      order: meta.order != null ? meta.order : 999,
      source_lesson: meta.source_lesson || '',
    });
  }
  packs.sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
  return packs;
}

function getPack(packId) {
  if (!packId || !PACK_ID_RE.test(packId)) return null;
  const filePath = path.join(PACKS_DIR, `${packId}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const sp = splitFrontMatter(raw);
  if (!sp) return null;
  const stages = parseStages(sp.body);
  return {
    id: packId,
    lesson_meta: sp.fm.lesson_meta || {},
    progression_rules: sp.fm.progression_rules || {},
    schema_version: sp.fm.schema_version,
    title_line: parseTitleLine(sp.body),
    stages,
  };
}

module.exports = { listPacks, getPack };
