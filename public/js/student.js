(function () {
  const { AVATARS, AVATAR_PAGES, esc } = window.QZ;
  const I18N = window.I18N;
  const app = document.getElementById('app');
  const pageTitleEl = document.getElementById('pageTitle');
  const CODE_KEY = 'chnobli:code';
  const PID_KEY = 'chnobli:playerId';

  // German is the default until we know which quiz (and therefore which
  // language, chosen by the teacher at setup) we've joined.
  let currentLang = 'de';
  function t(key, vars) { return I18N.t(currentLang, key, vars); }

  function applyStaticText() {
    document.documentElement.lang = currentLang;
    pageTitleEl.textContent = t('pageTitlePlay');
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  let playerId = localStorage.getItem(PID_KEY);
  if (!playerId) { playerId = uuid(); localStorage.setItem(PID_KEY, playerId); }

  const qsCode = window.QZ.qs('code');
  let code = (qsCode || localStorage.getItem(CODE_KEY) || '').replace(/\D/g, '').slice(0, 4);

  const socket = io();
  let lastKey = null;
  let writeDraft = null; // local, unbound to server pushes while on the write screen
  let joinError = '';

  socket.on('connect', () => {
    if (code && code.length === 4) attemptJoin(code);
    else renderJoin();
  });

  socket.on('student:state', (view) => {
    currentLang = I18N.normLang(view.language);
    applyStaticText();
    const key = computeKey(view);
    if (key !== lastKey) {
      lastKey = key;
      fullRender(view);
    } else {
      lightUpdate(view);
    }
  });

  socket.on('quiz:ended', () => {
    lastKey = 'ended';
    renderEnded();
  });

  function attemptJoin(c) {
    socket.emit('student:join', { code: c, playerId }, (res) => {
      if (!res || !res.ok) {
        joinError = (res && res.error) || t('joinErrorGeneric');
        renderJoin();
        return;
      }
      code = c;
      localStorage.setItem(CODE_KEY, c);
    });
  }

  // ---------------------------------------------------------------------
  function computeKey(v) {
    if (v.step === 'avatar') return 'avatar';
    if (v.step === 'write') return 'write:' + (v.rejected ? 'r' : 'n') + ':' + (v.draft ? v.draft.type : '');
    if (v.step === 'submitted') return 'submitted:' + v.questionStatus;
    if (v.step === 'play') {
      if (v.stage === 'active') return 'active:' + v.isUser + ':' + !!v.hasAnswered;
      if (v.stage === 'reveal') return 'reveal:' + v.result;
      if (v.stage === 'scores') return 'scores';
    }
    if (v.step === 'podium') return 'podium';
    return v.step || 'lobby';
  }

  function lightUpdate(v) {
    if (v.step === 'play' && v.stage === 'active') {
      const time = document.getElementById('timeLeftVal');
      if (time) time.textContent = v.timeLeft;
      const a = document.getElementById('answeredVal');
      if (a) a.textContent = v.answered;
      const e = document.getElementById('expectedVal');
      if (e) e.textContent = v.expected;
    }
  }

  function fullRender(v) {
    if (v.step === 'avatar') return renderAvatar(v);
    if (v.step === 'write') return renderWrite(v);
    if (v.step === 'submitted') return renderSubmitted(v);
    if (v.step === 'declined') return renderDeclined(v);
    if (v.step === 'play') {
      if (v.stage === 'active') return v.isUser ? renderLocked(v) : (v.hasAnswered ? renderWaiting(v) : renderInput(v));
      if (v.stage === 'reveal') return renderReveal(v);
      if (v.stage === 'scores') return renderScores(v);
    }
    if (v.step === 'podium') return renderPodium(v);
    renderJoin();
  }

  // ---- JOIN ---------------------------------------------------------------
  function renderJoin() {
    applyStaticText();
    app.innerHTML = `
      <div class="center-col" style="padding-top:12px">
        <span class="badge-icon" style="width:52px;height:52px;border-radius:16px"><span class="mi" style="font-size:28px">quiz</span></span>
        <div style="font:700 22px 'Source Sans 3';letter-spacing:-.01em">${esc(t('joinTitle'))}</div>
        <div style="font-size:13px;color:var(--muted)">${esc(t('joinSubtitle'))}</div>
        <input id="codeInput" inputmode="numeric" maxlength="4" value="${esc(code)}" placeholder="0000"
          style="height:64px;text-align:center;font:700 30px var(--font-mono);letter-spacing:.25em;color:var(--accent)" />
        ${joinError ? `<div style="color:var(--bad-ink);font-size:13px">${esc(joinError)}</div>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-block btn-lg" id="joinBtn">${esc(t('joinBtn'))}<span class="mi" style="font-size:20px">arrow_forward</span></button>
      </div>`;
    const input = app.querySelector('#codeInput');
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); });
    function doJoin() {
      const c = input.value.replace(/\D/g, '');
      if (c.length !== 4) { joinError = t('joinErrorCode'); renderJoin(); return; }
      joinError = '';
      attemptJoin(c);
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
    app.querySelector('#joinBtn').addEventListener('click', doJoin);
  }

  // ---- AVATAR / NAME --------------------------------------------------------
  function renderAvatar(v) {
    let picked = v.avatar || AVATARS[0];
    let name = v.name || '';
    // Land on whichever page already holds the current pick, so a student
    // revisiting this screen isn't dropped back on page 1.
    let page = Math.max(0, AVATAR_PAGES.findIndex((p) => p.emojis.includes(picked)));

    app.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;flex:1">
        <div style="text-align:center"><span class="badge badge-neutral">${esc(t('codeLabel', { code: v.code }))}</span>
          <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em;margin-top:8px">${esc(t('makeItYours'))}</div></div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="eyebrow" id="avatarCatLabel" style="margin-bottom:0"></div>
          <div style="display:flex;gap:6px">
            <button type="button" id="avatarPrev" class="btn btn-secondary" style="width:30px;height:30px;padding:0;border-radius:9px" aria-label="${esc(t('pickAvatar'))}"><span class="mi" style="font-size:18px">chevron_left</span></button>
            <button type="button" id="avatarNext" class="btn btn-secondary" style="width:30px;height:30px;padding:0;border-radius:9px" aria-label="${esc(t('pickAvatar'))}"><span class="mi" style="font-size:18px">chevron_right</span></button>
          </div>
        </div>
        <div class="avatar-grid" id="avatarGrid" style="touch-action:pan-y"></div>
        <div id="avatarDots" style="display:flex;justify-content:center;gap:6px"></div>
        <div><div class="eyebrow" style="margin-bottom:8px">${esc(t('nicknameLabel'))}</div>
          <input id="nameInput" value="${esc(name)}" placeholder="${esc(t('nicknamePlaceholder'))}" maxlength="24" style="height:48px;padding:0 14px;font-size:15px;font-weight:500" /></div>
        <div style="flex:1"></div>
        <div id="avatarErr" style="color:var(--bad-ink);font-size:13px;display:none"></div>
        <button class="btn btn-primary btn-block btn-lg" id="enterBtn">${esc(t('enterLobbyBtn'))}<span class="mi" style="font-size:20px">arrow_forward</span></button>
      </div>`;

    const grid = app.querySelector('#avatarGrid');
    const catLabel = app.querySelector('#avatarCatLabel');
    const dots = app.querySelector('#avatarDots');

    function paint() {
      const pageDef = AVATAR_PAGES[page];
      catLabel.textContent = t('avatarCat_' + pageDef.key);
      grid.innerHTML = pageDef.emojis.map((a) => `<button type="button" class="avatar-pick ${a === picked ? 'on' : ''}" data-a="${a}">${a}</button>`).join('');
      grid.querySelectorAll('.avatar-pick').forEach((btn) => btn.addEventListener('click', () => {
        picked = btn.dataset.a;
        grid.querySelectorAll('.avatar-pick').forEach((b) => b.classList.toggle('on', b.dataset.a === picked));
      }));
      dots.innerHTML = AVATAR_PAGES.map((_, i) => `<span style="width:6px;height:6px;border-radius:50%;background:${i === page ? 'var(--accent)' : 'var(--line-strong)'}"></span>`).join('');
    }
    function goPage(delta) {
      page = (page + delta + AVATAR_PAGES.length) % AVATAR_PAGES.length;
      paint();
    }
    paint();

    app.querySelector('#avatarPrev').addEventListener('click', () => goPage(-1));
    app.querySelector('#avatarNext').addEventListener('click', () => goPage(1));

    // Swipe left/right on the grid to page through, for mobile.
    let touchX = 0;
    let touchY = 0;
    grid.addEventListener('touchstart', (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });
    grid.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) goPage(dx < 0 ? 1 : -1);
    }, { passive: true });

    app.querySelector('#enterBtn').addEventListener('click', () => {
      name = app.querySelector('#nameInput').value.trim();
      if (!name) {
        const err = app.querySelector('#avatarErr');
        err.textContent = t('enterNicknameFirst');
        err.style.display = 'block';
        return;
      }
      socket.emit('student:setProfile', { code: v.code, playerId, name, avatar: picked }, () => {});
    });
  }

  // ---- WRITE QUESTION --------------------------------------------------------
  const DURATION_OPTIONS = [10, 20, 30, 40];

  function typeDefs() {
    return [
      ['mc', 'list_alt', t('type_mc_short')],
      ['tf', 'balance', t('type_tf_short')],
      ['short', 'short_text', t('type_short_short')],
      ['guess', 'tag', t('type_guess_short')],
    ];
  }

  function renderWrite(v) {
    const allowed = v.allowedTypes || ['mc', 'tf', 'short', 'guess'];
    if (!writeDraft || writeDraft._code !== v.code) {
      const d = v.draft;
      writeDraft = d ? {
        _code: v.code, type: d.type, text: d.text || '', durationSec: DURATION_OPTIONS.includes(d.durationSec) ? d.durationSec : 20,
        options: (d.options && d.options.length ? d.options.slice(0, 4) : ['', '', '', '']),
        correctIndex: d.correctIndex || 0, tf: d.tf !== false, answer: d.answer || '', num: d.num != null ? String(d.num) : '', unit: d.unit || '',
      } : {
        _code: v.code, type: allowed[0], text: '', durationSec: 20, options: ['', '', '', ''], correctIndex: 0, tf: true, answer: '', num: '', unit: '',
      };
    }
    paintWrite(v, allowed);
  }

  function paintWrite(v, allowed) {
    const d = writeDraft;
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;flex:1">
        <div style="font:700 19px 'Source Sans 3';letter-spacing:-.01em">${esc(t('writeQuestionTitle'))}</div>
        ${v.rejected ? `<div class="badge" style="background:var(--warn-tint);color:var(--warn-ink);width:fit-content"><span class="mi mif" style="font-size:14px">undo</span>${esc(t('rejectedBanner'))}</div>` : ''}
        <div class="type-row">${typeDefs().filter((tt) => allowed.includes(tt[0])).map(([type, icon, label]) => `
          <button type="button" class="type-chip ${d.type === type ? 'on' : ''}" data-type="${type}"><span class="mi mif" style="font-size:18px">${icon}</span>${esc(label)}</button>`).join('')}</div>
        <textarea id="qText" rows="2" placeholder="${esc(t('questionPlaceholder'))}" style="padding:10px 12px;font-size:14px;font-weight:500;resize:none">${esc(d.text)}</textarea>
        <div id="typeFields"></div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="eyebrow" style="margin-bottom:0">${esc(t('timeLimitLabel'))}</div>
            <span class="mono" id="durationVal" style="font:600 15px var(--font-mono);color:var(--accent-ink)">${d.durationSec}s</span>
          </div>
          <input type="range" class="slider" id="durationRange" min="10" max="40" step="10" value="${d.durationSec}" />
          <div class="slider-ticks"><span>10s</span><span>20s</span><span>30s</span><span>40s</span></div>
        </div>
        <div style="flex:1"></div>
        <div id="writeErr" style="color:var(--bad-ink);font-size:13px;display:none"></div>
        <button class="btn btn-primary btn-block btn-lg" id="submitQBtn">${esc(t('submitForReviewBtn'))}<span class="mi" style="font-size:20px">arrow_forward</span></button>
      </div>`;
    app.querySelector('#qText').addEventListener('input', (e) => { d.text = e.target.value; });
    app.querySelector('#durationRange').addEventListener('input', (e) => {
      d.durationSec = parseInt(e.target.value, 10);
      app.querySelector('#durationVal').textContent = `${d.durationSec}s`;
    });
    app.querySelectorAll('.type-chip').forEach((btn) => btn.addEventListener('click', () => {
      d.type = btn.dataset.type;
      app.querySelectorAll('.type-chip').forEach((b) => b.classList.toggle('on', b.dataset.type === d.type));
      paintTypeFields();
    }));
    paintTypeFields();
    app.querySelector('#submitQBtn').addEventListener('click', submitQuestion);

    function paintTypeFields() {
      const box = app.querySelector('#typeFields');
      if (d.type === 'mc') {
        box.innerHTML = `<div style="display:flex;flex-direction:column;gap:7px">
          ${d.options.map((val, i) => `
            <div class="opt-row ${i === d.correctIndex ? 'correct' : ''}" data-i="${i}">
              <span style="width:13px;height:13px;border-radius:3px;background:var(--accent);flex:none;opacity:${i === d.correctIndex ? 1 : .25}"></span>
              <input value="${esc(val)}" placeholder="${esc(t('optionPlaceholder', { n: i + 1 }))}" data-opt="${i}" />
              <button type="button" class="pick-correct" data-i="${i}"><span class="mi ${i === d.correctIndex ? 'mif' : ''}" style="font-size:20px;color:${i === d.correctIndex ? 'var(--accent)' : 'var(--faint)'}">${i === d.correctIndex ? 'check_circle' : 'radio_button_unchecked'}</span></button>
            </div>`).join('')}
          <div style="font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:5px"><span class="mi mif" style="font-size:14px;color:var(--accent)">check_circle</span>${esc(t('tapCorrectHint'))}</div>
        </div>`;
        box.querySelectorAll('input[data-opt]').forEach((inp) => inp.addEventListener('input', (e) => { d.options[+inp.dataset.opt] = e.target.value; }));
        box.querySelectorAll('.pick-correct').forEach((btn) => btn.addEventListener('click', () => { d.correctIndex = +btn.dataset.i; paintTypeFields(); }));
      } else if (d.type === 'tf') {
        box.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow">${esc(t('statementIs'))}</div>
          <div style="display:flex;gap:8px">
            <button type="button" class="type-chip ${d.tf ? 'on' : ''}" id="tfTrue" style="flex:1;height:44px">${esc(t('trueLabel'))}</button>
            <button type="button" class="type-chip ${!d.tf ? 'on' : ''}" id="tfFalse" style="flex:1;height:44px">${esc(t('falseLabel'))}</button>
          </div></div>`;
        box.querySelector('#tfTrue').addEventListener('click', () => { d.tf = true; paintTypeFields(); });
        box.querySelector('#tfFalse').addEventListener('click', () => { d.tf = false; paintTypeFields(); });
      } else if (d.type === 'short') {
        box.innerHTML = `<div><div class="eyebrow" style="margin-bottom:6px">${esc(t('acceptedAnswerLabel'))}</div>
          <input id="shortAns" value="${esc(d.answer)}" placeholder="${esc(t('acceptedAnswerPlaceholder'))}" style="height:44px;padding:0 12px;font-size:14px" /></div>`;
        box.querySelector('#shortAns').addEventListener('input', (e) => { d.answer = e.target.value; });
      } else {
        box.innerHTML = `<div style="display:flex;gap:10px">
          <div style="flex:1"><div class="eyebrow" style="margin-bottom:6px">${esc(t('correctNumberLabel'))}</div>
            <input id="numAns" inputmode="decimal" value="${esc(d.num)}" placeholder="0" style="height:48px;padding:0 14px;font:600 20px var(--font-mono)" /></div>
          <div style="flex:1"><div class="eyebrow" style="margin-bottom:6px">${esc(t('unitLabel'))}</div>
            <input id="unitAns" value="${esc(d.unit)}" placeholder="${esc(t('unitPlaceholder'))}" style="height:48px;padding:0 14px;font-size:14px" /></div>
        </div>`;
        box.querySelector('#numAns').addEventListener('input', (e) => { d.num = e.target.value; });
        box.querySelector('#unitAns').addEventListener('input', (e) => { d.unit = e.target.value; });
      }
    }
  }

  function submitQuestion() {
    const d = writeDraft;
    const question = { type: d.type, text: d.text, durationSec: d.durationSec };
    if (d.type === 'mc') { question.options = d.options; question.correctIndex = d.correctIndex; }
    else if (d.type === 'tf') { question.tf = d.tf; }
    else if (d.type === 'short') { question.answer = d.answer; }
    else if (d.type === 'guess') { question.num = parseFloat(d.num); question.unit = d.unit; }
    socket.emit('student:submitQuestion', { code, playerId, question }, (res) => {
      if (!res || !res.ok) {
        const err = app.querySelector('#writeErr');
        if (err) { err.textContent = (res && res.error) || t('submitErrorGeneric'); err.style.display = 'block'; }
      }
    });
  }

  // ---- SUBMITTED / WAITING ----------------------------------------------------
  function renderSubmitted() {
    app.innerHTML = `<div class="center-col">
      <span style="width:70px;height:70px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;box-shadow:var(--shadow-lg);animation:pop .4s ease-out"><span class="mi mif" style="font-size:40px">check</span></span>
      <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em">${esc(t('submittedTitle'))}</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;max-width:230px">${esc(t('submittedBody'))}</div>
      <span class="badge badge-neutral">${esc(t('submittedBadge'))}</span>
    </div>`;
  }

  // ---- DECLINED (final — no resubmission) -------------------------------------
  function renderDeclined() {
    app.innerHTML = `<div class="center-col">
      <span style="width:70px;height:70px;border-radius:50%;background:var(--surface-2);color:var(--muted);display:grid;place-items:center"><span class="mi" style="font-size:36px">inbox</span></span>
      <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em">${esc(t('declinedTitle'))}</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;max-width:230px">${esc(t('declinedBody'))}</div>
    </div>`;
  }

  // ---- LOCKED (own question) --------------------------------------------------
  function renderLocked(v) {
    app.innerHTML = `<div class="center-col">
      <span style="width:74px;height:74px;border-radius:50%;background:var(--accent-tint);color:var(--accent-ink);display:grid;place-items:center;font-size:36px">👀</span>
      <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em">${esc(t('lockedTitle'))}</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;max-width:230px">${esc(t('lockedBody'))}</div>
      <span class="chip"><span class="mi mif" style="font-size:16px;color:var(--accent)">group</span><span class="mono" style="font:600 12.5px var(--font-mono)">${t('answeringCount', { n: `<span id="answeredVal">${v.answered}</span>`, m: `<span id="expectedVal">${v.expected}</span>` })}</span></span>
    </div>`;
  }

  // ---- WAITING (answered already) ---------------------------------------------
  function renderWaiting(v) {
    app.innerHTML = `<div class="center-col">
      <span style="width:64px;height:64px;border-radius:50%;background:var(--accent-tint);color:var(--accent-ink);display:grid;place-items:center;animation:pop .4s ease-out"><span class="mi mif" style="font-size:34px">lock</span></span>
      <div style="font:700 18px 'Source Sans 3';letter-spacing:-.01em">${esc(t('lockedInTitle'))}</div>
      <div style="font-size:13px;color:var(--muted)">${esc(t('waitingOthers'))}</div>
      <span class="badge badge-neutral">${t('answeredBadge', { n: `<span id="answeredVal">${v.answered}</span>`, m: `<span id="expectedVal">${v.expected}</span>` })}</span>
    </div>`;
  }

  // ---- INPUT ------------------------------------------------------------------
  function renderInput(v) {
    let head = `<div class="top-row">
      <span class="badge badge-neutral">Q${v.qNum} / ${v.qTotal}</span>
      <span style="display:flex;align-items:center;gap:5px" class="mono"><span class="mi" style="font-size:18px;color:var(--accent)">timer</span><b id="timeLeftVal" style="font:600 16px var(--font-mono);color:var(--accent)">${v.timeLeft}</b>s</span>
    </div>`;
    let body;
    if (v.ansChoice) {
      body = `<div style="text-align:center;font-size:12.5px;color:var(--muted);font-weight:500">${esc(t('readBoardHint'))}</div>
        <div class="tile-grid" style="flex:1">${v.qOptions.map((o, idx) => `
          <button type="button" class="answer-tile" style="background:var(${o.colorVar});animation-delay:${idx * 60}ms" data-i="${o.i}">
            <span class="letter">${o.letter}</span><span>${esc(o.label)}</span>
          </button>`).join('')}</div>`;
    } else if (v.ans_guess) {
      body = `<div style="flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center">
        <div style="text-align:center;font-size:14px;color:var(--muted)">${esc(v.qText)}</div>
        <input id="guessInput" inputmode="decimal" placeholder="0" style="height:64px;text-align:center;font:600 30px var(--font-mono)" />
        <div style="text-align:center;font-size:12px;color:var(--faint)">${esc(v.unit || '')}</div>
        <button class="btn btn-primary btn-block" id="lockBtn">${esc(t('lockInGuessBtn'))}</button>
      </div>`;
    } else {
      body = `<div style="flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center">
        <div style="text-align:center;font-size:14px;color:var(--muted)">${esc(v.qText)}</div>
        <input id="shortInput" placeholder="${esc(t('typeYourAnswerPlaceholder'))}" style="height:52px;text-align:center;font-size:16px;font-weight:500" />
        <button class="btn btn-primary btn-block" id="lockBtn">${esc(t('submitAnswerBtn'))}</button>
      </div>`;
    }
    app.innerHTML = `<div style="display:flex;flex-direction:column;gap:13px;flex:1">${head}${body}</div>`;

    let sent = false;
    function sendAnswer(value) {
      if (sent) return;
      sent = true;
      app.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      socket.emit('student:submitAnswer', { code, playerId, value }, (res) => {
        if (res && !res.ok) { sent = false; app.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
      });
    }
    if (v.ansChoice) {
      const isTF = v.type === 'tf';
      app.querySelectorAll('.answer-tile').forEach((btn) => btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        sendAnswer(isTF ? i === 0 : i);
      }));
    } else if (v.ans_guess) {
      const gi = app.querySelector('#guessInput');
      app.querySelector('#lockBtn').addEventListener('click', () => sendAnswer(gi.value));
      gi.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAnswer(gi.value); });
      gi.focus();
    } else {
      const si = app.querySelector('#shortInput');
      app.querySelector('#lockBtn').addEventListener('click', () => sendAnswer(si.value));
      si.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAnswer(si.value); });
      si.focus();
    }
  }

  // ---- REVEAL ------------------------------------------------------------------
  function renderReveal(v) {
    let inner = '';
    if (v.result === 'locked') {
      inner = `<span style="width:64px;height:64px;border-radius:50%;background:var(--surface-2);color:var(--muted);display:grid;place-items:center;font-size:32px">👀</span>
        <div style="font:700 19px 'Source Sans 3';letter-spacing:-.01em;color:var(--muted)">${esc(t('satOutTitle'))}</div>
        <div style="font-size:13px;color:var(--faint)">${esc(t('satOutBody'))}</div>`;
    } else if (v.result === 'correct') {
      inner = `<span style="width:68px;height:68px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;box-shadow:var(--shadow-lg);animation:pop .5s ease-out"><span class="mi mif" style="font-size:38px">check</span></span>
        <div style="font:700 22px 'Source Sans 3';letter-spacing:-.01em;color:var(--ok-ink)">${esc(t('correctTitle'))}</div>
        <div style="font:600 44px/1 var(--font-mono)">+${v.points}</div>
        <div style="display:flex;gap:8px">
          ${v.streak > 1 ? `<span class="badge" style="background:var(--warn-tint);color:var(--warn-ink);font-family:'Source Sans 3'"><span style="display:inline-block;animation:flame 1s ease-in-out infinite">🔥</span> ${esc(t('streakBadge', { n: v.streak }))}</span>` : ''}
          <span class="badge" style="background:var(--accent-tint);color:var(--accent-ink);font-family:'Source Sans 3'">${esc(t('placeBadge', { rank: v.rankText }))}</span>
        </div>`;
    } else {
      const label = v.result === 'missed' ? t('timesUpTitle') : t('notThisTimeTitle');
      inner = `<span style="width:68px;height:68px;border-radius:50%;background:var(--bad);color:#fff;display:grid;place-items:center;animation:pop .5s ease-out"><span class="mi mif" style="font-size:38px">close</span></span>
        <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em;color:var(--bad-ink)">${esc(label)}</div>
        <div style="font-size:13px;color:var(--muted)">${esc(t('answerLabel'))}: <b style="color:var(--ink)">${esc(v.correctText)}</b></div>
        <div style="font-size:12.5px;color:var(--faint)">${esc(t('streakResetStill', { rank: v.rankText }))}</div>`;
    }
    app.innerHTML = `<div class="center-col">${inner}</div>`;
  }

  // ---- SCORES ------------------------------------------------------------------
  function renderScores(v) {
    app.innerHTML = `<div class="center-col">
      <div class="eyebrow">${esc(t('yourStanding'))}</div>
      <div style="font:700 52px/1 var(--font-mono);color:var(--accent-ink)">${esc(v.rankText)}</div>
      <div style="font-size:14px;color:var(--muted)"><b class="mono" style="color:var(--ink)">${v.score}</b> ${esc(t('pointsLabel'))}</div>
      <div style="font-size:12.5px;color:var(--faint);display:flex;align-items:center;gap:5px"><span class="mi" style="font-size:16px">tv</span>${esc(t('watchBoardHint'))}</div>
    </div>`;
  }

  // ---- PODIUM ------------------------------------------------------------------
  function renderPodium(v) {
    const emoji = v.rank === 1 ? '🏆' : (v.rank <= 3 ? '🥳' : '👏');
    const note = v.rank === 1 ? t('youWon') : (v.rank <= 3 ? t('onPodium') : t('goodGame'));
    app.innerHTML = `<div class="center-col">
      <span style="font-size:44px">${emoji}</span>
      <div style="font:700 22px 'Source Sans 3';letter-spacing:-.01em">${esc(t('finishedRank', { rank: v.rankText }))}</div>
      <div style="font-size:14px;color:var(--muted)"><b class="mono" style="color:var(--ink)">${v.score}</b> ${esc(t('pointsLabel'))} · ${esc(note)}</div>
      <button class="btn btn-secondary" id="doneBtn" style="margin-top:8px">${esc(t('backToJoinBtn'))}</button>
    </div>`;
    app.querySelector('#doneBtn').addEventListener('click', () => { localStorage.removeItem(CODE_KEY); location.href = '/play'; });
  }

  // ---- ENDED ------------------------------------------------------------------
  function renderEnded() {
    app.innerHTML = `<div class="center-col">
      <span class="mi" style="font-size:44px;color:var(--muted)">event_busy</span>
      <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em">${esc(t('quizEndedTitle'))}</div>
      <div style="font-size:13px;color:var(--muted)">${esc(t('quizEndedBody'))}</div>
      <button class="btn btn-primary" id="backBtn">${esc(t('joinAnotherBtn'))}</button>
    </div>`;
    app.querySelector('#backBtn').addEventListener('click', () => { localStorage.removeItem(CODE_KEY); location.href = '/play'; });
  }

  applyStaticText();
  if (!code) renderJoin();
})();
