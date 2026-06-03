// Optional conjugation practice for the verbs exposed in a mini-lesson.
// Reuses the app's existing conjugation flashcards (buildConjCards + mountFlashcards),
// the same experience as the Tenses tab on a verb page.
//
//   miniLessonConjugator.fetchAvailableVerbs(infinitives) -> Promise<string[]>
//       Returns the subset of infinitives that actually have conjugations in the DB
//       (lesson "verbs" like "estar rodeado de" or "fui" won't, and are dropped).
//   miniLessonConjugator.mount(container, infinitives)
//       Renders a tense picker + flip-card deck for those verbs.

(function () {
  const TENSES = ['present', 'preterite', 'future', 'imperfect', 'conditional'];
  const TENSE_LABELS = {
    present: 'Present', preterite: 'Preterite', future: 'Future',
    imperfect: 'Imperfect', conditional: 'Conditional',
  };
  const ALL = TENSES.join(',');

  // Cache conjugation rows per verb-list+tense query so switching tenses is snappy.
  async function fetchConjugations(infinitives, tenses) {
    if (!infinitives.length) return [];
    const url = `/api/conjugations?verbs=${encodeURIComponent(infinitives.join(','))}&tenses=${encodeURIComponent(tenses)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  }

  // Which of these infinitives have any conjugation data? (present is enough to test.)
  async function fetchAvailableVerbs(infinitives) {
    const unique = [...new Set(infinitives.map(s => (s || '').trim()).filter(Boolean))];
    if (!unique.length) return [];
    const rows = await fetchConjugations(unique, 'present');
    const have = new Set(rows.map(r => r.infinitive));
    // Preserve the lesson's ordering.
    return unique.filter(inf => have.has(inf));
  }

  function mount(container, infinitives) {
    const verbs = [...new Set(infinitives.map(s => (s || '').trim()).filter(Boolean))];

    container.innerHTML = `
      <p class="mlc-hint">Practise the conjugations of this lesson's verbs. Tap a card to flip.</p>
      <div class="fc-modes" id="mlc-tenses">
        ${TENSES.map((t, i) => `<button class="fc-mode-btn${i === 0 ? ' active' : ''}" data-tense="${t}">${TENSE_LABELS[t]}</button>`).join('')}
        <button class="fc-mode-btn" data-tense="__all__">All tenses</button>
      </div>
      <div id="mlc-deck"><p class="mlc-loading">Loading…</p></div>`;

    const deckEl = container.querySelector('#mlc-deck');
    const picker = container.querySelector('#mlc-tenses');

    async function loadTense(tenseKey) {
      deckEl.innerHTML = '<p class="mlc-loading">Loading…</p>';
      const tenses = tenseKey === '__all__' ? ALL : tenseKey;
      let rows;
      try {
        rows = await fetchConjugations(verbs, tenses);
      } catch {
        deckEl.innerHTML = '<p class="ml-err">Could not load conjugations.</p>';
        return;
      }
      const cards = buildConjCards(rows);
      // mountFlashcards renders its own empty state, but give a friendlier message
      // when a whole tense is simply missing for these verbs.
      if (!cards.length) {
        deckEl.innerHTML = `<div class="fc-wrap"><div class="fc-empty">No ${tenseKey === '__all__' ? '' : TENSE_LABELS[tenseKey].toLowerCase() + ' '}conjugations for these verbs.</div></div>`;
        return;
      }
      mountFlashcards(deckEl, cards);
    }

    picker.querySelectorAll('.fc-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.fc-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTense(btn.dataset.tense);
      });
    });

    loadTense('present');
  }

  window.miniLessonConjugator = { fetchAvailableVerbs, mount };
})();
