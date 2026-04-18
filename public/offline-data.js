let offlineDataPromise = null;

async function getOfflineData() {
  if (!offlineDataPromise) {
    offlineDataPromise = fetch('/offline-data.json').then(res => {
      if (!res.ok) throw new Error('Offline data unavailable');
      return res.json();
    });
  }
  return offlineDataPromise;
}

async function fetchJsonWithOffline(url, offlineResolver) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    if (!offlineResolver) throw error;
    const data = await getOfflineData();
    return offlineResolver(data);
  }
}

function parseList(value) {
  return (value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function offlineVerbs(data, { maxImportance = null, minImportance = null, limit = 500, offset = 0, q = '', all = false } = {}) {
  const query = q.trim().toLowerCase();
  let rows = data.verbs;

  if (all) {
    if (query) {
      rows = rows.filter(v =>
        v.infinitive.toLowerCase().includes(query) ||
        String(v.meaning || '').toLowerCase().includes(query)
      );
    }
    return rows.slice(offset);
  }

  if (query) {
    rows = rows.filter(v =>
      v.infinitive.toLowerCase().includes(query) ||
      String(v.meaning || '').toLowerCase().includes(query)
    );
  }
  if (maxImportance !== null) rows = rows.filter(v => v.importance <= maxImportance);
  if (minImportance !== null) rows = rows.filter(v => v.importance >= minImportance);

  return rows.slice(offset, offset + limit);
}

function offlineVerbsList(data, verbsParam) {
  const wanted = parseList(verbsParam);
  const byInfinitive = new Map(data.verbs.map(v => [v.infinitive, v]));
  return wanted.map(v => byInfinitive.get(v)).filter(Boolean);
}

function offlineVerb(data, infinitive) {
  const verb = data.verbs.find(v => v.infinitive === infinitive);
  if (!verb) return null;
  const conjugations = data.conjugations
    .filter(c => c.infinitive === infinitive)
    .map(({ pronoun, tense, form }) => ({ pronoun, tense, form }));
  return { ...verb, conjugations };
}

function offlineConjugations(data, { verbId = null, verbsParam = '', maxImportance = null, minImportance = null, tensesParam = '' } = {}) {
  const tenses = parseList(tensesParam || 'present,preterite,future');
  const tenseSet = new Set(tenses);
  let allowedInfinitives = null;

  if (verbId !== null) {
    const verb = data.verbs.find(v => v.id === verbId);
    allowedInfinitives = new Set(verb ? [verb.infinitive] : []);
  } else if (verbsParam) {
    allowedInfinitives = new Set(parseList(verbsParam));
  } else if (maxImportance !== null) {
    allowedInfinitives = new Set(
      data.verbs
        .filter(v => v.importance <= maxImportance && (minImportance === null || v.importance >= minImportance))
        .map(v => v.infinitive)
    );
  }

  return data.conjugations.filter(c =>
    (!allowedInfinitives || allowedInfinitives.has(c.infinitive)) &&
    tenseSet.has(c.tense)
  );
}
