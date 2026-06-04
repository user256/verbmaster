// Interactive study deck for mini-lesson packs.
// Reuses the app's flashcard CSS (fc-*) for a consistent look.
//
// A stage is studied in two SEPARATE phases:
//   Phase 1: Spanish -> English. When the deck is done, an interstitial lets the
//            user replay Spanish -> English, or continue to English -> Spanish.
//   Phase 2: English -> Spanish (production). Ends with a round summary; the user
//            can replay the whole stage (back to phase 1) or review errors.
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

  // dir: 'es2en' shows the Spanish prompt; 'en2es' shows the English prompt.
  function buildCards(items, packId, stageKey, dir) {
    return items
      .filter(it => it.es && it.en)
      .map(it => ({
        front: dir === 'es2en' ? it.es : it.en,
        back:  dir === 'es2en' ? it.en : it.es,
        dir,
        // Namespaced progress key — keeps these out of the verb/conjugation stats.
        // Keyed on the Spanish side so both directions of one item share history.
        statKey: `ml:${packId}:${stageKey}:${it.es}`,
        pronoun: it.es,
      }));
  }

  function dirLabel(dir) {
    return dir === 'es2en' ? 'ES → EN' : 'EN → ES';
  }

  function mountMiniLessonStudy(container, items, opts) {
    const packId = opts.packId || 'pack';
    const stageKey = opts.stageKey || 'stage';
    // Optional forward navigation shown when the English -> Spanish pass finishes.
    // May be a descriptor or a function returning one (resolved lazily at the end,
    // so an asynchronously-added next stage like "Conjugate" is picked up):
    //   { label, onAdvance } — primary "next" button leading to the next stage
    //   { finished: true, backHref?, backLabel? } — terminal "you've finished" note
    //   null/omitted — plain stage-complete (e.g. the "All" deck)
    const resolveNextStep = () =>
      (typeof opts.nextStep === 'function' ? opts.nextStep() : opts.nextStep) || null;
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
          <div class="round-actions" id="mls-round-actions"></div>
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
    const roundActions = container.querySelector('#mls-round-actions');
    const statDir     = container.querySelector('#mls-dir');
    const statCorrect = container.querySelector('#mls-correct');
    const statWrong   = container.querySelector('#mls-wrong');
    const statRemain  = container.querySelector('#mls-remain');

    let deck = [];
    let idx = 0;
    let correct = 0;
    let errors = [];
    let phase = 'es2en'; // 'es2en' | 'en2es'

    function freshPass(dir) {
      return shuffleDeck(buildCards(usable, packId, stageKey, dir));
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

    function showCards() {
      card.classList.remove('hidden');
      btnRight.classList.remove('hidden');
      btnWrong.classList.remove('hidden');
      roundEnd.classList.add('hidden');
    }

    function hideCards() {
      card.classList.add('hidden');
      btnRight.classList.add('hidden');
      btnWrong.classList.add('hidden');
      statDir.textContent = '';
    }

    function errorListHtml() {
      return '<ul>' + errors.map(c =>
        `<li>${escapeHtml(c.front)} → <strong>${escapeHtml(c.back)}</strong> <span class="fc-tense">(${dirLabel(c.dir)})</span></li>`
      ).join('') + '</ul>';
    }

    // Interstitial shown after the Spanish -> English pass.
    function showInterstitial() {
      hideCards();
      roundEnd.classList.remove('hidden');
      roundMsg.textContent = errors.length === 0
        ? `Spanish → English complete. Perfect — ${correct} correct.`
        : `Spanish → English complete. ${correct} correct, ${errors.length} wrong.`;
      errorList.innerHTML = errors.length ? errorListHtml() : '';
      roundActions.innerHTML = `
        <button id="mls-replay-es">Practise Spanish → English again</button>
        ${errors.length ? '<button id="mls-review-es" class="hidden-on-perfect">Review these errors</button>' : ''}
        <button id="mls-continue-en" class="btn-right">Continue to English → Spanish ▸</button>`;

      container.querySelector('#mls-replay-es').addEventListener('click', () => startPhase('es2en'));
      const reviewBtn = container.querySelector('#mls-review-es');
      if (reviewBtn) reviewBtn.addEventListener('click', () => startReview(errors, 'es2en'));
      container.querySelector('#mls-continue-en').addEventListener('click', () => startPhase('en2es'));
    }

    // Final summary shown after the English -> Spanish pass. When a nextStep is
    // provided it leads with a "well done, move on" primary button.
    function showFinal() {
      hideCards();
      roundEnd.classList.remove('hidden');
      const clean = errors.length === 0;
      const nextStep = resolveNextStep();
      if (nextStep) {
        roundMsg.textContent = clean
          ? `Well done! Stage complete — ${correct} correct.`
          : `Stage done. ${correct} correct, ${errors.length} wrong.`;
      } else {
        roundMsg.textContent = clean
          ? 'Stage complete! Spanish → English and back.'
          : `English → Spanish done. ${correct} correct, ${errors.length} wrong.`;
      }
      errorList.innerHTML = errors.length ? errorListHtml() : '';
      const finished = nextStep && nextStep.finished;
      if (finished) {
        roundMsg.textContent = clean
          ? "You've finished this lesson! 🎉"
          : `You've finished this lesson! 🎉 (${correct} correct, ${errors.length} wrong on the last pass.)`;
      }
      const advanceBtn = (nextStep && !finished)
        ? `<button id="mls-next" class="btn-right">Well done — next: ${escapeHtml(nextStep.label)} ▸</button>` : '';
      const finishLink = (finished && nextStep.backHref)
        ? `<a class="mls-finish-link" href="${escapeHtml(nextStep.backHref)}">${escapeHtml(nextStep.backLabel || '← All mini lessons')}</a>` : '';
      roundActions.innerHTML = `
        ${advanceBtn}
        <button id="mls-replay-stage">Play whole stage again</button>
        ${errors.length ? '<button id="mls-review-en">Review these errors</button>' : ''}
        ${finishLink}`;

      if (advanceBtn) {
        container.querySelector('#mls-next').addEventListener('click', () => nextStep.onAdvance());
      }
      container.querySelector('#mls-replay-stage').addEventListener('click', () => startPhase('es2en'));
      const reviewBtn = container.querySelector('#mls-review-en');
      if (reviewBtn) reviewBtn.addEventListener('click', () => startReview(errors, 'en2es'));
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
      if (idx >= deck.length) { endOfDeck(); return; }
      showCard();
    }

    function endOfDeck() {
      if (phase === 'es2en') showInterstitial();
      else showFinal();
    }

    function startPhase(dir) {
      phase = dir;
      deck = freshPass(dir);
      idx = 0; correct = 0; errors = [];
      showCards();
      showCard();
    }

    // Re-run just the missed cards, keeping the phase they belong to.
    function startReview(missed, dir) {
      phase = dir;
      deck = shuffleDeck(missed);
      idx = 0; correct = 0; errors = [];
      showCards();
      showCard();
    }

    card.addEventListener('click', () => card.classList.toggle('flipped'));
    btnRight.addEventListener('click', () => advance(true));
    btnWrong.addEventListener('click', () => advance(false));

    startPhase('es2en');
  }

  window.mountMiniLessonStudy = mountMiniLessonStudy;
})();
