// mountConjugationGame(container, sentences)
// sentences: array of { infinitive, sentence_es, sentence_en, tense, pronoun, conjugated_form, audio_hash }

function mountConjugationGame(container, allSentences) {
  if (!allSentences.length) {
    container.innerHTML = '<p style="color:var(--weak);font-size:14px">No sentences available for this set.</p>';
    return;
  }

  container.innerHTML = `
    <div class="cg-wrap">
      <div class="cg-controls">
        <div class="cg-control-row">
          <label class="cg-label" for="cg-num">Questions</label>
          <input class="cg-input-num" id="cg-num" type="number" value="10" min="1">
          <button class="btn-outline cg-btn-sm" id="cg-set-max">Max</button>
        </div>
        <div class="cg-tense-row">
          <span class="cg-label">Tenses</span>
          <div class="tense-checkboxes" id="cg-tense-filters">
            <label><input type="checkbox" value="present" checked> Present</label>
            <label><input type="checkbox" value="preterite" checked> Preterite</label>
            <label><input type="checkbox" value="future" checked> Future</label>
            <label><input type="checkbox" value="imperfect"> Imperfect</label>
            <label><input type="checkbox" value="conditional"> Conditional</label>
          </div>
        </div>
        <div class="cg-toggle-row">
          <label class="cg-toggle-label"><input type="checkbox" id="cg-hide-inf"> Hide infinitive</label>
          <label class="cg-toggle-label"><input type="checkbox" id="cg-hide-en"> Hide translation</label>
        </div>
        <button class="btn-blue cg-start-btn" id="cg-start">Start</button>
      </div>

      <div class="cg-game" id="cg-game" style="display:none">
        <div class="cg-scorebar">
          <span id="cg-score">Score: 0</span>
          <span id="cg-errors">Errors: 0</span>
          <span id="cg-remain">Remaining: 0</span>
        </div>

        <div class="cg-sentence-card" id="cg-sentence-card">
          <p class="cg-sentence" id="cg-sentence"></p>
          <p class="cg-translation" id="cg-translation"></p>
          <p class="cg-verb-hint" id="cg-verb-hint"></p>
        </div>

        <div class="cg-answer-row">
          <input class="form-input cg-answer" id="cg-answer" type="text" placeholder="Type conjugated form…" autocomplete="off" autocapitalize="off">
          <button class="btn-blue" id="cg-check">Check</button>
          <button class="cg-audio-btn" id="cg-audio" title="Play audio">▶</button>
        </div>

        <div class="cg-accents">
          <button type="button" class="cg-accent-btn" data-char="á">á</button>
          <button type="button" class="cg-accent-btn" data-char="é">é</button>
          <button type="button" class="cg-accent-btn" data-char="í">í</button>
          <button type="button" class="cg-accent-btn" data-char="ó">ó</button>
          <button type="button" class="cg-accent-btn" data-char="ú">ú</button>
          <button type="button" class="cg-accent-btn" data-char="ü">ü</button>
          <button type="button" class="cg-accent-btn" data-char="ñ">ñ</button>
        </div>

        <div class="cg-result" id="cg-result"></div>
      </div>

      <div class="cg-summary" id="cg-summary" style="display:none">
        <p class="cg-summary-msg" id="cg-summary-msg"></p>
        <div id="cg-error-list"></div>
        <button class="btn-blue" id="cg-restart" style="margin-top:16px">Play again</button>
      </div>
    </div>
  `;

  let deck = [];
  let idx  = 0;
  let score = 0;
  let errorCount = 0;
  let wrongItems = [];

  const numInput    = container.querySelector('#cg-num');
  const setMaxBtn   = container.querySelector('#cg-set-max');
  const startBtn    = container.querySelector('#cg-start');
  const gameEl      = container.querySelector('#cg-game');
  const summaryEl   = container.querySelector('#cg-summary');
  const controlsEl  = container.querySelector('.cg-controls');
  const sentenceEl  = container.querySelector('#cg-sentence');
  const translationEl = container.querySelector('#cg-translation');
  const verbHintEl  = container.querySelector('#cg-verb-hint');
  const answerEl    = container.querySelector('#cg-answer');
  const checkBtn    = container.querySelector('#cg-check');
  const audioBtn    = container.querySelector('#cg-audio');
  const resultEl    = container.querySelector('#cg-result');
  const scoreEl     = container.querySelector('#cg-score');
  const errorsEl    = container.querySelector('#cg-errors');
  const remainEl    = container.querySelector('#cg-remain');
  const summaryMsg  = container.querySelector('#cg-summary-msg');
  const errorListEl = container.querySelector('#cg-error-list');
  const restartBtn  = container.querySelector('#cg-restart');
  const hideInfCb   = container.querySelector('#cg-hide-inf');
  const hideEnCb    = container.querySelector('#cg-hide-en');

  function selectedTenses() {
    return [...container.querySelectorAll('#cg-tense-filters input:checked')].map(i => i.value);
  }

  function filteredSentences() {
    const tenses = selectedTenses();
    return allSentences.filter(s => tenses.includes(s.tense));
  }

  setMaxBtn.addEventListener('click', () => {
    numInput.value = filteredSentences().length;
  });

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  startBtn.addEventListener('click', () => {
    const filtered = filteredSentences();
    const n = Math.min(parseInt(numInput.value) || 10, filtered.length);
    deck = shuffle(filtered).slice(0, n);
    idx = 0; score = 0; errorCount = 0; wrongItems = [];
    controlsEl.style.display = 'none';
    summaryEl.style.display = 'none';
    gameEl.style.display = 'block';
    showQuestion();
  });

  function showQuestion() {
    if (idx >= deck.length) { endGame(); return; }
    const s = deck[idx];
    const blank = s.sentence_es.replace(new RegExp(s.conjugated_form, 'i'), '________');
    sentenceEl.textContent = blank;
    translationEl.textContent = hideEnCb.checked ? '' : `(${s.sentence_en})`;
    verbHintEl.innerHTML = hideInfCb.checked
      ? `<span class="cg-tense-badge">${s.tense}</span>`
      : `<span class="cg-inf">${s.infinitive}</span> <span class="cg-tense-badge">${s.tense}</span>`;
    answerEl.value = '';
    resultEl.innerHTML = '';
    answerEl.focus();
    updateScores();
  }

  function updateScores() {
    scoreEl.textContent   = `Score: ${score}`;
    errorsEl.textContent  = `Errors: ${errorCount}`;
    remainEl.textContent  = `Remaining: ${deck.length - idx}`;
  }

  function check() {
    const userAnswer   = answerEl.value.trim().toLowerCase().replace(/\.$/, '');
    const correctAnswer = deck[idx].conjugated_form.toLowerCase().replace(/\.$/, '');
    if (!userAnswer) return;

    if (userAnswer === correctAnswer) {
      resultEl.innerHTML = '<span class="cg-correct">✓ Correct</span>';
      score++;
    } else {
      resultEl.innerHTML = `<span class="cg-wrong">✗ Incorrect — correct answer: <strong>${correctAnswer}</strong></span>`;
      errorCount++;
      wrongItems.push(deck[idx]);
    }
    idx++;
    updateScores();
    setTimeout(showQuestion, 900);
  }

  checkBtn.addEventListener('click', check);
  answerEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });

  audioBtn.addEventListener('click', () => {
    const s = deck[idx];
    if (s && s.audio_hash) {
      new Audio(`/mp3s/${s.audio_hash}.mp3`).play().catch(() => {});
    }
  });

  container.querySelectorAll('.cg-accent-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = answerEl.selectionStart;
      const val = answerEl.value;
      answerEl.value = val.slice(0, pos) + btn.dataset.char + val.slice(pos);
      answerEl.setSelectionRange(pos + 1, pos + 1);
      answerEl.focus();
    });
  });

  function endGame() {
    gameEl.style.display = 'none';
    summaryEl.style.display = 'block';
    summaryMsg.textContent = `Round complete — ${score} correct, ${errorCount} wrong out of ${deck.length}.`;
    if (wrongItems.length) {
      errorListEl.innerHTML = '<ul class="cg-error-list">' +
        wrongItems.map(s => `<li>${s.sentence_es} → <strong>${s.conjugated_form}</strong></li>`).join('') +
        '</ul>';
    } else {
      errorListEl.innerHTML = '';
    }
  }

  restartBtn.addEventListener('click', () => {
    summaryEl.style.display = 'none';
    controlsEl.style.display = 'block';
  });
}
