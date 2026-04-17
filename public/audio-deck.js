// mountAudioDeck(container, sentences)
// sentences: { sentence_es, sentence_en, conjugated_form, infinitive, tense, audio_hash }

function mountAudioDeck(container, allSentences) {
  const withAudio = allSentences.filter(s => s.audio_hash);
  if (!withAudio.length) {
    container.innerHTML = '<p style="color:var(--weak);font-size:14px">No audio available for this set.</p>';
    return;
  }

  container.innerHTML = `
    <div class="fc-modes ad-tense-modes" id="ad-tense-modes">
      <button class="fc-mode-btn" data-tense="present">Present</button>
      <button class="fc-mode-btn" data-tense="preterite">Preterite</button>
      <button class="fc-mode-btn" data-tense="future">Future</button>
      <button class="fc-mode-btn" data-tense="imperfect">Imperfect</button>
      <button class="fc-mode-btn" data-tense="conditional">Conditional</button>
      <button class="fc-mode-btn active" data-tense="all">All tenses</button>
    </div>

    <div class="fc-wrap">
      <div class="fc-stats">
        <span id="ad-correct">Correct: 0</span>
        <span id="ad-errors">Wrong: 0</span>
        <span id="ad-remain">Remaining: 0</span>
      </div>

      <div class="fc-card" id="ad-card">
        <div class="fc-inner">
          <div class="fc-front" id="ad-front"></div>
          <div class="fc-back" id="ad-back"></div>
        </div>
      </div>

      <div class="fc-buttons">
        <button id="ad-wrong" class="btn-wrong">Wrong</button>
        <button id="ad-right" class="btn-right">Right</button>
      </div>

      <div class="fc-options">
        <div class="ad-speed-control">
          <label for="ad-speed">Playback Speed:</label>
          <input type="range" id="ad-speed" min="0.5" max="1.5" step="0.1" value="1">
          <span id="ad-speed-value">1x</span>
        </div>
      </div>

      <p id="ad-empty" class="ad-empty hidden">No audio available for this tense.</p>

      <div id="ad-round-end" class="fc-round-end hidden">
        <p id="ad-round-msg"></p>
        <div id="ad-error-list"></div>
        <div class="round-actions">
          <button id="ad-replay">Play again</button>
          <button id="ad-fix" class="hidden">Review errors</button>
        </div>
      </div>
    </div>
  `;

  const card     = container.querySelector('#ad-card');
  const front    = container.querySelector('#ad-front');
  const back     = container.querySelector('#ad-back');
  const btnRight = container.querySelector('#ad-right');
  const btnWrong = container.querySelector('#ad-wrong');
  const roundEnd = container.querySelector('#ad-round-end');
  const roundMsg = container.querySelector('#ad-round-msg');
  const errorList = container.querySelector('#ad-error-list');
  const replayBtn = container.querySelector('#ad-replay');
  const fixBtn   = container.querySelector('#ad-fix');
  const statCorrect = container.querySelector('#ad-correct');
  const statErrors  = container.querySelector('#ad-errors');
  const statRemain  = container.querySelector('#ad-remain');
  const tenseModes   = container.querySelector('#ad-tense-modes');
  const speedInput   = container.querySelector('#ad-speed');
  const speedValue   = container.querySelector('#ad-speed-value');
  const emptyMsg     = container.querySelector('#ad-empty');

  let activeTense = 'all';
  let deck = [];
  let idx = 0, correct = 0, errors = [];
  let currentAudio = null;

  function playAudio(hash) {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    currentAudio = new Audio(`/mp3s/${hash}.mp3`);
    currentAudio.playbackRate = parseFloat(speedInput.value) || 1;
    currentAudio.play().catch(() => {});
  }

  function filteredSentences() {
    if (activeTense === 'all') return withAudio;
    return withAudio.filter(s => s.tense === activeTense);
  }

  function resetRound(sentences = filteredSentences()) {
    deck = shuffle([...sentences]);
    idx = 0;
    correct = 0;
    errors = [];
    errorList.innerHTML = '';
    roundEnd.classList.add('hidden');

    const hasCards = deck.length > 0;
    card.classList.toggle('hidden', !hasCards);
    btnRight.classList.toggle('hidden', !hasCards);
    btnWrong.classList.toggle('hidden', !hasCards);
    emptyMsg.classList.toggle('hidden', hasCards);

    updateStats();
    if (hasCards) showCard();
  }

  function updateStats() {
    statCorrect.textContent = `Correct: ${correct}`;
    statErrors.textContent  = `Wrong: ${errors.length}`;
    statRemain.textContent  = `Remaining: ${Math.max(0, deck.length - idx)}`;
  }

  function showCard() {
    if (!deck.length) return;
    const inner = card.querySelector('.fc-inner');
    inner.style.transition = 'none';
    card.classList.remove('flipped');
    void inner.offsetWidth;
    inner.style.transition = '';

    const s = deck[idx];
    const highlighted = s.sentence_es.replace(
      new RegExp(`\\b${s.conjugated_form}\\b`, 'i'),
      `<strong class="ad-highlight">${s.conjugated_form}</strong>`
    );

    front.innerHTML = `
      <button class="ad-speaker-btn" id="ad-play" aria-label="Play audio">🔈</button>
      <span class="fc-tense" style="margin-top:8px">${s.tense} · ${s.infinitive}</span>
      <span class="fc-hint">tap speaker to play, card to flip</span>
    `;
    back.innerHTML = `
      <span class="ad-sentence">${highlighted}</span>
      <span class="ad-translation">${s.sentence_en}</span>
      <button class="ad-play-back-btn" id="ad-play-back">🔈 Play again</button>
    `;

    container.querySelector('#ad-play').addEventListener('click', e => {
      e.stopPropagation();
      playAudio(s.audio_hash);
    });
    back.querySelector('#ad-play-back')?.addEventListener('click', e => {
      e.stopPropagation();
      playAudio(s.audio_hash);
    });

    updateStats();
  }

  function advance(wasRight) {
    if (!wasRight) errors.push(deck[idx]);
    else correct++;
    idx++;
    if (idx >= deck.length) { endRound(); return; }
    showCard();
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
      errorList.innerHTML = '<ul>' + errors.map(s =>
        `<li>${s.sentence_es} → <strong>${s.conjugated_form}</strong></li>`
      ).join('') + '</ul>';
      fixBtn.classList.remove('hidden');
    }
  }

  card.addEventListener('click', () => card.classList.toggle('flipped'));
  btnRight.addEventListener('click', () => advance(true));
  btnWrong.addEventListener('click', () => advance(false));
  speedInput.addEventListener('input', () => {
    const speed = parseFloat(speedInput.value) || 1;
    speedValue.textContent = `${speed.toFixed(1).replace(/\.0$/, '')}x`;
    if (currentAudio) currentAudio.playbackRate = speed;
  });
  tenseModes.querySelectorAll('[data-tense]').forEach(btn => {
    btn.addEventListener('click', () => {
      tenseModes.querySelectorAll('[data-tense]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTense = btn.dataset.tense;
      resetRound();
    });
  });

  replayBtn.addEventListener('click', () => {
    resetRound();
  });

  fixBtn.addEventListener('click', () => {
    resetRound(errors);
  });

  resetRound();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
