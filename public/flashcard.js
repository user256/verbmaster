// Shared flashcard logic
// buildConjCards(rows) — rows from /api/conjugations
// mountFlashcards(el, cards) — renders flashcard UI into el

// buildVerbCards(verbs) — simple Spanish → English vocab cards
// verbs: array of { infinitive, meaning }
function buildVerbCards(verbs) {
  return verbs.map(v => ({
    infinitive: v.infinitive,
    meaning: '',
    pronoun: v.infinitive,
    tense: '',
    back: v.meaning,
  }));
}

function buildConjCards(conjugations) {
  return conjugations.map(c => ({
    infinitive: c.infinitive,
    meaning: c.meaning || '',
    pronoun: c.pronoun,
    tense: c.tense,
    back: c.form,
  }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mountFlashcards(container, allCards) {
  if (!allCards.length) {
    container.innerHTML = `
      <div class="fc-wrap">
        <div class="fc-stats">
          <span>Correct: 0</span>
          <span>Wrong: 0</span>
          <span>Remaining: 0</span>
        </div>
        <div class="fc-empty">No cards match this selection.</div>
      </div>
    `;
    return;
  }

  let deck = shuffle(allCards);
  let idx = 0;
  let errors = [];
  let correct = 0;
  let errorMode = false;

  container.innerHTML = `
    <div class="fc-wrap">
      <div class="fc-stats">
        <span id="fc-correct">Correct: 0</span>
        <span id="fc-errors">Wrong: 0</span>
        <span id="fc-remain">Remaining: 0</span>
      </div>

      <div class="fc-card" id="fc-card">
        <div class="fc-inner">
          <div class="fc-front"></div>
          <div class="fc-back"></div>
        </div>
      </div>

      <div class="fc-buttons">
        <button id="fc-wrong" class="btn-wrong">Wrong</button>
        <button id="fc-right" class="btn-right">Right</button>
      </div>

      <div class="fc-options">
        <label class="fc-opt-label" id="fc-translation-option">Translation
          <select id="fc-translation-pos">
            <option value="front" selected>On front</option>
            <option value="back">On back</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label class="fc-opt-label fc-opt-reverse">
          <input type="checkbox" id="fc-reverse"> Reverse
        </label>
        <label class="fc-opt-label fc-opt-reverse" id="fc-meaning-reverse-option">
          <input type="checkbox" id="fc-meaning-reverse"> Reverse meaning
        </label>
      </div>

      <div id="fc-round-end" class="fc-round-end hidden">
        <p id="fc-round-msg"></p>
        <div id="fc-error-list"></div>
        <div class="round-actions">
          <button id="fc-replay">Play again</button>
          <button id="fc-fix" class="hidden">Review errors</button>
        </div>
      </div>
    </div>
  `;

  const card     = container.querySelector('#fc-card');
  const front    = container.querySelector('.fc-front');
  const back     = container.querySelector('.fc-back');
  const btnRight = container.querySelector('#fc-right');
  const btnWrong = container.querySelector('#fc-wrong');
  const roundEnd = container.querySelector('#fc-round-end');
  const roundMsg = container.querySelector('#fc-round-msg');
  const errorList = container.querySelector('#fc-error-list');
  const replayBtn = container.querySelector('#fc-replay');
  const fixBtn   = container.querySelector('#fc-fix');
  const statCorrect = container.querySelector('#fc-correct');
  const statErrors  = container.querySelector('#fc-errors');
  const statRemain  = container.querySelector('#fc-remain');
  const translationSelect = container.querySelector('#fc-translation-pos');
  const translationOption = container.querySelector('#fc-translation-option');
  const reverseOption     = container.querySelector('.fc-opt-reverse');
  const meaningReverseOption = container.querySelector('#fc-meaning-reverse-option');
  const reverseCheck      = container.querySelector('#fc-reverse');
  const meaningReverseCheck = container.querySelector('#fc-meaning-reverse');

  const isConjDeck = allCards.some(c => c.tense);
  if (isConjDeck) {
    meaningReverseOption.style.display = 'none';
  } else {
    translationOption.style.display = 'none';
    reverseOption.style.display = 'none';
  }

  translationSelect.addEventListener('change', showCard);
  reverseCheck.addEventListener('change', showCard);
  meaningReverseCheck.addEventListener('change', showCard);

  function updateStats() {
    statCorrect.textContent = `Correct: ${correct}`;
    statErrors.textContent  = `Wrong: ${errors.length}`;
    statRemain.textContent  = `Remaining: ${Math.max(0, deck.length - idx)}`;
  }

  function showCard() {
    const inner = card.querySelector('.fc-inner');
    inner.style.transition = 'none';
    card.classList.remove('flipped');
    void inner.offsetWidth;
    inner.style.transition = '';
    const c = deck[idx];
    const transPos = translationSelect.value;
    const reversed = reverseCheck.checked;
    const meaningReversed = meaningReverseCheck.checked;

    let questionHTML, answerHTML, reverseQuestionHTML, reverseAnswerHTML;

    if (c.tense) {
      const showOnFront = transPos === 'front' && c.meaning;
      const showOnBack  = transPos === 'back'  && c.meaning;
      const reverseShowOnFront = transPos === 'back' && c.meaning;
      const reverseShowOnBack = transPos === 'front' && c.meaning;
      questionHTML = `
        <span class="fc-pronoun">${c.infinitive} — ${c.pronoun}</span>
        ${showOnFront ? `<span class="fc-meaning">${c.meaning}</span>` : ''}
        <span class="fc-tense">(${c.tense})</span>
        <span class="fc-hint">tap to flip</span>
      `;
      answerHTML = showOnBack
        ? `<span class="fc-back-form">${c.back}</span><span class="fc-back-meaning">${c.meaning}</span>`
        : `<span class="fc-back-form">${c.back}</span>`;
      reverseQuestionHTML = `
        <span class="fc-pronoun">${c.infinitive} — ${c.pronoun}</span>
        ${reverseShowOnFront ? `<span class="fc-meaning">${c.meaning}</span>` : ''}
        <span class="fc-tense">(${c.tense})</span>
        <span class="fc-hint">tap to flip</span>
      `;
      reverseAnswerHTML = `
        <span class="fc-back-form">${c.back}</span>
        ${reverseShowOnBack ? `<span class="fc-back-meaning">${c.meaning}</span>` : ''}
      `;
    } else {
      questionHTML = `
        <span class="fc-pronoun" style="font-size:1.6rem">${c.pronoun}</span>
        <span class="fc-hint">tap to flip</span>
      `;
      answerHTML = `<span class="fc-back-form">${c.back}</span>`;
      reverseQuestionHTML = `
        <span class="fc-pronoun" style="font-size:1.6rem">${c.back}</span>
        <span class="fc-hint">tap to flip</span>
      `;
      reverseAnswerHTML = `<span class="fc-back-form">${c.pronoun}</span>`;
    }

    if (c.tense && reversed) {
      front.innerHTML = reverseQuestionHTML;
      back.innerHTML  = reverseAnswerHTML;
    } else if (!c.tense && meaningReversed) {
      front.innerHTML = reverseQuestionHTML;
      back.innerHTML  = reverseAnswerHTML;
    } else {
      front.innerHTML = questionHTML;
      back.innerHTML  = answerHTML;
    }
    updateStats();
  }

  function endRound() {
    card.classList.add('hidden');
    btnRight.classList.add('hidden');
    btnWrong.classList.add('hidden');
    roundEnd.classList.remove('hidden');

    if (errors.length === 0) {
      roundMsg.textContent = 'Perfect round!';
      fixBtn.classList.add('hidden');
    } else {
      roundMsg.textContent = `Round done. ${correct} correct, ${errors.length} wrong.`;
      errorList.innerHTML = '<ul>' + errors.map(c =>
        c.tense
          ? `<li>${c.pronoun} — ${c.infinitive} (${c.tense}) → <strong>${c.back}</strong></li>`
          : `<li>${c.pronoun} → <strong>${c.back}</strong></li>`
      ).join('') + '</ul>';
      fixBtn.classList.remove('hidden');
    }
  }

  function advance(wasRight) {
    if (!wasRight) errors.push(deck[idx]);
    else correct++;
    idx++;
    if (idx >= deck.length) { endRound(); return; }
    showCard();
    updateStats();
  }

  card.addEventListener('click', () => card.classList.toggle('flipped'));
  btnRight.addEventListener('click', () => advance(true));
  btnWrong.addEventListener('click', () => advance(false));

  replayBtn.addEventListener('click', () => {
    deck = shuffle(allCards);
    idx = 0; errors = []; correct = 0; errorMode = false;
    roundEnd.classList.add('hidden');
    card.classList.remove('hidden');
    btnRight.classList.remove('hidden');
    btnWrong.classList.remove('hidden');
    errorList.innerHTML = '';
    showCard();
  });

  fixBtn.addEventListener('click', () => {
    deck = shuffle(errors);
    idx = 0; errors = []; correct = 0; errorMode = true;
    roundEnd.classList.add('hidden');
    card.classList.remove('hidden');
    btnRight.classList.remove('hidden');
    btnWrong.classList.remove('hidden');
    errorList.innerHTML = '';
    showCard();
  });

  showCard();
}
