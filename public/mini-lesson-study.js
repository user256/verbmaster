// Interactive study deck for mini-lesson packs.
// Reuses the app's flashcard CSS (fc-*) for a consistent look, but runs its own
// two-pass round: every card is shown Spanish -> English first, then the same
// cards English -> Spanish (production practice), then the round ends.
//
// mountMiniLessonStudy(container, items, opts)
//   items: array of { es, en }
//   opts:  { packId, stageKey } — used to namespace progress keys

(function () {
  function shuffleDeck(cards) {
    const P = window.VerbmasterProgress;
    if (P?.weakSpotEnabled?.() && P?.enabled?.() && P?.weakBiasedShuffleCards) {
      return P.weakBiasedShuffleCards(cards);
    }
    const a = [...cards];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Build the two passes: pass 0 = ES->EN, pass 1 = EN->ES.
  // Each entry carries everything the renderer and progress store need.
  function buildPass(items, packId, stageKey, dir) {
    return items
      .filter(it => it.es && it.en)
      .map(it => ({
        // dir: 'es2en' shows Spanish prompt; 'en2es' shows English prompt
        front: dir === 'es2en' ? it.es : it.en,
        back:  dir === 'es2en' ? it.en : it.es,
        dir,
        // Namespaced progress key — keeps these out of the verb/conjugation stats.
        // Keyed on the Spanish side so both directions of one item share history.
        statKey: `ml:${packId}:${stageKey}:${it.es}`,
        // recordFlashcard reads .pronoun for the (unused) fallback key; harmless.
        pronoun: it.es,
      }));
  }

  function mountMiniLessonStudy(container, items, opts) {
    const packId = opts.packId || 'pack';
    const stageKey = opts.stageKey || 'stage';
    const usable = items.filter(it => it.es && it.en);

    if (!usable.length) {
      container.innerHTML = `
        <div class="fc-wrap">
          <div class="fc-stats"><span>Correct: 0</span><span>Wrong: 0</span><span>Remaining: 0</span></div>
          <div class="fc-empty">No cards in this stage.</div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="fc-wrap">
        <div class="fc-stats">
          <span id="mls-dir"></span>
          <span id="mls-correct">Correct: 0</span>
          <span id="mls-wrong">Wrong: 0</span>
          <span id="mls-remain">Remaining: 0</span>
        </div>

        <div class="fc-card" id="mls-card">
          <div class="fc-inner">
            <div class="fc-front"></div>
            <div class="fc-back"></div>
          </div>
        </div>

        <div class="fc-buttons">
          <button id="mls-wrong-btn" class="btn-wrong">Wrong</button>
          <button id="mls-right-btn" class="btn-right">Right</button>
        </div>

        <div id="mls-round-end" class="fc-round-end hidden">
          <p id="mls-round-msg"></p>
          <div id="mls-error-list"></div>
          <div class="round-actions">
            <button id="mls-replay">Play again</button>
            <button id="mls-fix" class="hidden">Review errors</button>
          </div>
        </div>
      </div>`;

    const card      = container.querySelector('#mls-card');
    const front     = container.querySelector('.fc-front');
    const back      = container.querySelector('.fc-back');
    const btnRight  = container.querySelector('#mls-right-btn');
    const btnWrong  = container.querySelector('#mls-wrong-btn');
    const roundEnd  = container.querySelector('#mls-round-end');
    const roundMsg  = container.querySelector('#mls-round-msg');
    const errorList = container.querySelector('#mls-error-list');
    const replayBtn = container.querySelector('#mls-replay');
    const fixBtn    = container.querySelector('#mls-fix');
    const statDir     = container.querySelector('#mls-dir');
    const statCorrect = container.querySelector('#mls-correct');
    const statWrong   = container.querySelector('#mls-wrong');
    const statRemain  = container.querySelector('#mls-remain');

    let deck = [];
    let idx = 0;
    let correct = 0;
    let errors = [];

    // Fresh two-pass deck: all cards ES->EN, then all cards EN->ES.
    function freshDeck() {
      const pass1 = shuffleDeck(buildPass(usable, packId, stageKey, 'es2en'));
      const pass2 = shuffleDeck(buildPass(usable, packId, stageKey, 'en2es'));
      return [...pass1, ...pass2];
    }

    function dirLabel(dir) {
      return dir === 'es2en' ? 'ES → EN' : 'EN → ES';
    }

    function updateStats() {
      const c = deck[idx];
      statDir.textContent = c ? dirLabel(c.dir) : '';
      statCorrect.textContent = `Correct: ${correct}`;
      statWrong.textContent   = `Wrong: ${errors.length}`;
      statRemain.textContent  = `Remaining: ${Math.max(0, deck.length - idx)}`;
    }

    function showCard() {
      const inner = card.querySelector('.fc-inner');
      inner.style.transition = 'none';
      card.classList.remove('flipped');
      void inner.offsetWidth;
      inner.style.transition = '';

      const c = deck[idx];
      front.innerHTML = `
        <span class="fc-pronoun" style="font-size:1.6rem">${escapeHtml(c.front)}</span>
        <span class="fc-hint">tap to flip</span>`;
      back.innerHTML = `<span class="fc-back-form">${escapeHtml(c.back)}</span>`;
      updateStats();
    }

    function endRound() {
      card.classList.add('hidden');
      btnRight.classList.add('hidden');
      btnWrong.classList.add('hidden');
      roundEnd.classList.remove('hidden');
      statDir.textContent = '';

      if (errors.length === 0) {
        roundMsg.textContent = 'Perfect round! Spanish → English and back.';
        fixBtn.classList.add('hidden');
      } else {
        roundMsg.textContent = `Round done. ${correct} correct, ${errors.length} wrong.`;
        errorList.innerHTML = '<ul>' + errors.map(c =>
          `<li>${escapeHtml(c.front)} → <strong>${escapeHtml(c.back)}</strong> <span class="fc-tense">(${dirLabel(c.dir)})</span></li>`
        ).join('') + '</ul>';
        fixBtn.classList.remove('hidden');
      }
    }

    function advance(wasRight) {
      const cur = deck[idx];
      if (wasRight) correct++;
      else errors.push(cur);
      const P = window.VerbmasterProgress;
      if (P?.enabled?.()) {
        P.recordFlashcard(cur, wasRight);
        P.touchLast?.(location.href, document.title);
      }
      idx++;
      if (idx >= deck.length) { endRound(); return; }
      showCard();
    }

    function start(cards) {
      deck = cards;
      idx = 0;
      correct = 0;
      errors = [];
      roundEnd.classList.add('hidden');
      errorList.innerHTML = '';
      card.classList.remove('hidden');
      btnRight.classList.remove('hidden');
      btnWrong.classList.remove('hidden');
      showCard();
    }

    card.addEventListener('click', () => card.classList.toggle('flipped'));
    btnRight.addEventListener('click', () => advance(true));
    btnWrong.addEventListener('click', () => advance(false));
    replayBtn.addEventListener('click', () => start(freshDeck()));
    // Review errors keeps the direction each error was made in.
    fixBtn.addEventListener('click', () => start(shuffleDeck(errors)));

    start(freshDeck());
  }

  window.mountMiniLessonStudy = mountMiniLessonStudy;
})();
