// Optional local-only practice stats (localStorage). Off by default; toggle in nav.

(function () {
  const KEY_ON = 'verbmaster:progressOn';
  const KEY_WEAK = 'verbmaster:weakSpotOn';
  const KEY_STATS = 'verbmaster:cardStats';
  const KEY_LAST = 'verbmaster:lastPractise';

  function fyShuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function weightedShuffle(items, getWeight) {
    const pool = items.map(item => {
      let w = getWeight(item);
      if (!Number.isFinite(w) || w <= 0) w = 1;
      return { item, w };
    });
    const out = [];
    while (pool.length) {
      let total = 0;
      for (const p of pool) total += p.w;
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        r -= pool[idx].w;
        if (r <= 0) break;
      }
      if (idx >= pool.length) idx = pool.length - 1;
      out.push(pool[idx].item);
      pool.splice(idx, 1);
    }
    return out;
  }

  function weightForStatKey(id) {
    if (!id) return 1;
    const row = loadStats()[id];
    if (!row) return 1;
    const w = row.wrong || 0;
    const c = row.correct || 0;
    return Math.max(0.2, 0.4 + w * 0.9 - c * 0.32 + Math.max(0, w - c) * 0.28);
  }

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(KEY_STATS) || '{}') || {};
    } catch {
      return {};
    }
  }

  function saveStats(obj) {
    try {
      localStorage.setItem(KEY_STATS, JSON.stringify(obj));
    } catch (_) {}
  }

  function enabled() {
    return localStorage.getItem(KEY_ON) === '1';
  }

  function weakSpotEnabled() {
    return localStorage.getItem(KEY_WEAK) === '1';
  }

  function setWeakSpotEnabled(on) {
    if (!enabled()) return;
    if (on) localStorage.setItem(KEY_WEAK, '1');
    else localStorage.removeItem(KEY_WEAK);
    document.dispatchEvent(new CustomEvent('verbmaster-progress-changed', { detail: { weak: on } }));
    refreshNav();
  }

  function setEnabled(on) {
    if (on) localStorage.setItem(KEY_ON, '1');
    else {
      localStorage.removeItem(KEY_ON);
      localStorage.removeItem(KEY_WEAK);
    }
    document.dispatchEvent(new CustomEvent('verbmaster-progress-changed', { detail: { on } }));
    refreshNav();
  }

  function touchLast(href, title) {
    if (!enabled()) return;
    try {
      localStorage.setItem(
        KEY_LAST,
        JSON.stringify({ href: href || '', title: title || 'Verbmaster', ts: Date.now() })
      );
    } catch (_) {}
  }

  function getLast() {
    try {
      return JSON.parse(localStorage.getItem(KEY_LAST) || 'null');
    } catch {
      return null;
    }
  }

  function cardIdFlashcard(card) {
    if (!card) return null;
    if (card.statKey) return card.statKey;
    if (card.tense) {
      return `conj:${card.infinitive}:${card.pronoun}:${card.tense}:${card.back}`;
    }
    return `verb:${card.pronoun || card.infinitive}`;
  }

  function cardIdSentence(s) {
    if (!s || !s.infinitive || !s.conjugated_form) return null;
    const pr = (s.pronoun || '').replace(/\s+/g, '_');
    return `sent:${s.infinitive}:${s.tense || ''}:${pr}:${s.conjugated_form}`;
  }

  function cardIdAudio(s) {
    if (s && s.audio_hash) return `audio:${s.audio_hash}`;
    return cardIdSentence(s);
  }

  function cardIdPhrase(topicSlug, phraseEs) {
    if (!topicSlug || !phraseEs) return null;
    return `phrase:${topicSlug}:${phraseEs.slice(0, 200)}`;
  }

  function bumpNextDue(row, correct) {
    const now = Date.now();
    if (!correct) {
      row.nextDue = now + 3 * 60 * 60 * 1000;
      return;
    }
    const streak = Math.max(0, (row.correct || 0) - (row.wrong || 0));
    const days = Math.min(14, 1 + Math.floor(streak / 2));
    row.nextDue = now + days * 24 * 60 * 60 * 1000;
  }

  function record(id, correct) {
    if (!enabled() || !id) return;
    const stats = loadStats();
    const row = stats[id] || { correct: 0, wrong: 0 };
    if (correct) row.correct = (row.correct || 0) + 1;
    else row.wrong = (row.wrong || 0) + 1;
    row.last = Date.now();
    bumpNextDue(row, correct);
    stats[id] = row;
    saveStats(stats);
    refreshNav();
  }

  function recordFlashcard(card, correct) {
    record(cardIdFlashcard(card), correct);
  }

  function recordSentence(s, correct) {
    record(cardIdSentence(s), correct);
  }

  function recordAudioSentence(s, correct) {
    record(cardIdAudio(s), correct);
  }

  function recordPhrase(topicSlug, card, correct) {
    record(cardIdPhrase(topicSlug, card.pronoun || card.phrase_es), correct);
  }

  function getDueCount() {
    if (!enabled()) return 0;
    const now = Date.now();
    let n = 0;
    for (const row of Object.values(loadStats())) {
      if (row && typeof row.nextDue === 'number' && row.nextDue <= now) n++;
    }
    return n;
  }

  function weakBiasedShuffleCards(cards) {
    if (!weakSpotEnabled() || !enabled() || !cards || cards.length < 2) return fyShuffle(cards);
    return weightedShuffle(cards, c => weightForStatKey(cardIdFlashcard(c)));
  }

  function weakBiasedShuffleSentences(items) {
    if (!weakSpotEnabled() || !enabled() || !items || items.length < 2) return fyShuffle(items);
    return weightedShuffle(items, s => weightForStatKey(cardIdSentence(s) || cardIdAudio(s)));
  }

  function weakBiasedShuffleVerbRows(rows) {
    if (!weakSpotEnabled() || !enabled() || !rows || rows.length < 2) return fyShuffle(rows);
    return weightedShuffle(rows, v => weightForStatKey(v && v.infinitive ? `verb:${v.infinitive}` : ''));
  }

  function weakBiasedShuffleInfinitives(list) {
    if (!weakSpotEnabled() || !enabled() || !list || list.length < 2) return fyShuffle(list);
    return weightedShuffle(list, inf => weightForStatKey(`verb:${inf}`));
  }

  function weakBiasedShufflePhrases(cards) {
    if (!weakSpotEnabled() || !enabled() || !cards || cards.length < 2) return fyShuffle(cards);
    return weightedShuffle(cards, c =>
      weightForStatKey(cardIdPhrase(c._topicSlug, c.pronoun || c.phrase_es || ''))
    );
  }

  function refreshNav() {
    const badge = document.getElementById('nav-progress-due');
    const cb = document.getElementById('nav-progress-enabled');
    const weakCb = document.getElementById('nav-weak-spot-enabled');
    if (cb) cb.checked = enabled();
    if (weakCb) {
      const on = enabled();
      weakCb.disabled = !on;
      weakCb.checked = on && weakSpotEnabled();
    }
    if (!badge) return;
    const due = getDueCount();
    if (!enabled() || due === 0) {
      badge.textContent = '';
      badge.removeAttribute('aria-label');
      badge.classList.add('hidden');
    } else {
      badge.textContent = String(due);
      badge.setAttribute('aria-label', `${due} cards due for review`);
      badge.classList.remove('hidden');
    }
  }

  window.VerbmasterProgress = {
    enabled,
    setEnabled,
    weakSpotEnabled,
    setWeakSpotEnabled,
    touchLast,
    getLast,
    getDueCount,
    recordFlashcard,
    recordSentence,
    recordAudioSentence,
    recordPhrase,
    refreshNav,
    weakBiasedShuffleCards,
    weakBiasedShuffleSentences,
    weakBiasedShuffleVerbRows,
    weakBiasedShuffleInfinitives,
    weakBiasedShufflePhrases,
  };
})();
