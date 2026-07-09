(function () {
  const { AVATARS, esc, typeLabel } = window.QZ;
  const app = document.getElementById('app');
  const CODE_KEY = 'chnobli:code';
  const PID_KEY = 'chnobli:playerId';

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
        joinError = (res && res.error) || 'Could not join.';
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
      const t = document.getElementById('timeLeftVal');
      if (t) t.textContent = v.timeLeft;
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
    const digits = (code || '').padEnd(4, ' ').split('');
    app.innerHTML = `
      <div class="center-col" style="padding-top:12px">
        <span class="badge-icon" style="width:52px;height:52px;border-radius:16px"><span class="mi" style="font-size:28px">quiz</span></span>
        <div style="font:700 22px 'Source Sans 3';letter-spacing:-.01em">Join a quiz</div>
        <div style="font-size:13px;color:var(--muted)">Enter the code shown on the board</div>
        <input id="codeInput" inputmode="numeric" maxlength="4" value="${esc(code)}" placeholder="0000"
          style="height:64px;text-align:center;font:700 30px var(--font-mono);letter-spacing:.25em;color:var(--accent)" />
        ${joinError ? `<div style="color:var(--bad-ink);font-size:13px">${esc(joinError)}</div>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-block btn-lg" id="joinBtn">Join<span class="mi" style="font-size:20px">arrow_forward</span></button>
      </div>`;
    const input = app.querySelector('#codeInput');
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); });
    function doJoin() {
      const c = input.value.replace(/\D/g, '');
      if (c.length !== 4) { joinError = 'Enter the 4-digit code.'; renderJoin(); return; }
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
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;flex:1">
        <div style="text-align:center"><span class="badge badge-neutral">CODE ${esc(v.code)}</span>
          <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em;margin-top:8px">Make it yours</div></div>
        <div class="eyebrow">Pick an avatar</div>
        <div class="avatar-grid">${AVATARS.map((a) => `<button type="button" class="avatar-pick ${a === picked ? 'on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
        <div><div class="eyebrow" style="margin-bottom:8px">Nickname</div>
          <input id="nameInput" value="${esc(name)}" placeholder="e.g. Robincode" maxlength="24" style="height:48px;padding:0 14px;font-size:15px;font-weight:500" /></div>
        <div style="flex:1"></div>
        <div id="avatarErr" style="color:var(--bad-ink);font-size:13px;display:none"></div>
        <button class="btn btn-primary btn-block btn-lg" id="enterBtn">Enter lobby<span class="mi" style="font-size:20px">arrow_forward</span></button>
      </div>`;
    app.querySelectorAll('.avatar-pick').forEach((btn) => btn.addEventListener('click', () => {
      picked = btn.dataset.a;
      app.querySelectorAll('.avatar-pick').forEach((b) => b.classList.toggle('on', b.dataset.a === picked));
    }));
    app.querySelector('#enterBtn').addEventListener('click', () => {
      name = app.querySelector('#nameInput').value.trim();
      if (!name) {
        const err = app.querySelector('#avatarErr');
        err.textContent = 'Enter a nickname first.';
        err.style.display = 'block';
        return;
      }
      socket.emit('student:setProfile', { code: v.code, playerId, name, avatar: picked }, () => {});
    });
  }

  // ---- WRITE QUESTION --------------------------------------------------------
  const TYPE_DEFS = [['mc', 'list_alt', 'Choice'], ['tf', 'balance', 'T / F'], ['short', 'short_text', 'Short'], ['guess', 'tag', 'Guess']];

  function renderWrite(v) {
    const allowed = v.allowedTypes || ['mc', 'tf', 'short', 'guess'];
    if (!writeDraft || writeDraft._code !== v.code) {
      const d = v.draft;
      writeDraft = d ? {
        _code: v.code, type: d.type, text: d.text || '',
        options: (d.options && d.options.length ? d.options.slice(0, 4) : ['', '', '', '']),
        correctIndex: d.correctIndex || 0, tf: d.tf !== false, answer: d.answer || '', num: d.num != null ? String(d.num) : '', unit: d.unit || '',
      } : {
        _code: v.code, type: allowed[0], text: '', options: ['', '', '', ''], correctIndex: 0, tf: true, answer: '', num: '', unit: '',
      };
    }
    paintWrite(v, allowed);
  }

  function paintWrite(v, allowed) {
    const d = writeDraft;
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;flex:1">
        <div style="font:700 19px 'Source Sans 3';letter-spacing:-.01em">Write a question</div>
        ${v.rejected ? '<div class="badge" style="background:var(--warn-tint);color:var(--warn-ink);width:fit-content"><span class="mi mif" style="font-size:14px">undo</span>Your teacher asked you to revise this</div>' : ''}
        <div class="type-row">${TYPE_DEFS.filter((t) => allowed.includes(t[0])).map(([t, icon, label]) => `
          <button type="button" class="type-chip ${d.type === t ? 'on' : ''}" data-type="${t}"><span class="mi mif" style="font-size:18px">${icon}</span>${label}</button>`).join('')}</div>
        <textarea id="qText" rows="2" placeholder="Type your question…" style="padding:10px 12px;font-size:14px;font-weight:500;resize:none">${esc(d.text)}</textarea>
        <div id="typeFields"></div>
        <div style="flex:1"></div>
        <div id="writeErr" style="color:var(--bad-ink);font-size:13px;display:none"></div>
        <button class="btn btn-primary btn-block btn-lg" id="submitQBtn">Submit for review<span class="mi" style="font-size:20px">arrow_forward</span></button>
      </div>`;
    app.querySelector('#qText').addEventListener('input', (e) => { d.text = e.target.value; });
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
              <input value="${esc(val)}" placeholder="Option ${i + 1}" data-opt="${i}" />
              <button type="button" class="pick-correct" data-i="${i}"><span class="mi ${i === d.correctIndex ? 'mif' : ''}" style="font-size:20px;color:${i === d.correctIndex ? 'var(--accent)' : 'var(--faint)'}">${i === d.correctIndex ? 'check_circle' : 'radio_button_unchecked'}</span></button>
            </div>`).join('')}
          <div style="font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:5px"><span class="mi mif" style="font-size:14px;color:var(--accent)">check_circle</span>Tap the circle to mark the correct answer</div>
        </div>`;
        box.querySelectorAll('input[data-opt]').forEach((inp) => inp.addEventListener('input', (e) => { d.options[+inp.dataset.opt] = e.target.value; }));
        box.querySelectorAll('.pick-correct').forEach((btn) => btn.addEventListener('click', () => { d.correctIndex = +btn.dataset.i; paintTypeFields(); }));
      } else if (d.type === 'tf') {
        box.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow">The statement is…</div>
          <div style="display:flex;gap:8px">
            <button type="button" class="type-chip ${d.tf ? 'on' : ''}" id="tfTrue" style="flex:1;height:44px">True</button>
            <button type="button" class="type-chip ${!d.tf ? 'on' : ''}" id="tfFalse" style="flex:1;height:44px">False</button>
          </div></div>`;
        box.querySelector('#tfTrue').addEventListener('click', () => { d.tf = true; paintTypeFields(); });
        box.querySelector('#tfFalse').addEventListener('click', () => { d.tf = false; paintTypeFields(); });
      } else if (d.type === 'short') {
        box.innerHTML = `<div><div class="eyebrow" style="margin-bottom:6px">Accepted answer</div>
          <input id="shortAns" value="${esc(d.answer)}" placeholder="e.g. Mitochondrion" style="height:44px;padding:0 12px;font-size:14px" /></div>`;
        box.querySelector('#shortAns').addEventListener('input', (e) => { d.answer = e.target.value; });
      } else {
        box.innerHTML = `<div style="display:flex;gap:10px">
          <div style="flex:1"><div class="eyebrow" style="margin-bottom:6px">Correct number</div>
            <input id="numAns" inputmode="decimal" value="${esc(d.num)}" placeholder="0" style="height:48px;padding:0 14px;font:600 20px var(--font-mono)" /></div>
          <div style="flex:1"><div class="eyebrow" style="margin-bottom:6px">Unit (optional)</div>
            <input id="unitAns" value="${esc(d.unit)}" placeholder="e.g. bones" style="height:48px;padding:0 14px;font-size:14px" /></div>
        </div>`;
        box.querySelector('#numAns').addEventListener('input', (e) => { d.num = e.target.value; });
        box.querySelector('#unitAns').addEventListener('input', (e) => { d.unit = e.target.value; });
      }
    }
  }

  function submitQuestion() {
    const d = writeDraft;
    const question = { type: d.type, text: d.text };
    if (d.type === 'mc') { question.options = d.options; question.correctIndex = d.correctIndex; }
    else if (d.type === 'tf') { question.tf = d.tf; }
    else if (d.type === 'short') { question.answer = d.answer; }
    else if (d.type === 'guess') { question.num = parseFloat(d.num); question.unit = d.unit; }
    socket.emit('student:submitQuestion', { code, playerId, question }, (res) => {
      if (!res || !res.ok) {
        const err = app.querySelector('#writeErr');
        if (err) { err.textContent = (res && res.error) || 'Could not submit.'; err.style.display = 'block'; }
      }
    });
  }

  // ---- SUBMITTED / WAITING ----------------------------------------------------
  function renderSubmitted() {
    app.innerHTML = `<div class="center-col">
      <span style="width:70px;height:70px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;box-shadow:var(--shadow-lg);animation:pop .4s ease-out"><span class="mi mif" style="font-size:40px">check</span></span>
      <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em">Question submitted!</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;max-width:230px">Waiting for your teacher to review and start the quiz…</div>
      <span class="badge badge-neutral">YOU'LL PLAY WHEN IT STARTS</span>
    </div>`;
  }

  // ---- LOCKED (own question) --------------------------------------------------
  function renderLocked(v) {
    app.innerHTML = `<div class="center-col">
      <span style="width:74px;height:74px;border-radius:50%;background:var(--accent-tint);color:var(--accent-ink);display:grid;place-items:center;font-size:36px">👀</span>
      <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em">This one's yours!</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;max-width:230px">You wrote this question, so you're sitting it out — no points this round.</div>
      <span class="chip"><span class="mi mif" style="font-size:16px;color:var(--accent)">group</span><span class="mono" style="font:600 12.5px var(--font-mono)"><span id="answeredVal">${v.answered}</span> / <span id="expectedVal">${v.expected}</span> answering…</span></span>
    </div>`;
  }

  // ---- WAITING (answered already) ---------------------------------------------
  function renderWaiting(v) {
    app.innerHTML = `<div class="center-col">
      <span style="width:64px;height:64px;border-radius:50%;background:var(--accent-tint);color:var(--accent-ink);display:grid;place-items:center;animation:pop .4s ease-out"><span class="mi mif" style="font-size:34px">lock</span></span>
      <div style="font:700 18px 'Source Sans 3';letter-spacing:-.01em">Locked in!</div>
      <div style="font-size:13px;color:var(--muted)">Waiting for everyone else…</div>
      <span class="badge badge-neutral"><span id="answeredVal">${v.answered}</span> / <span id="expectedVal">${v.expected}</span> ANSWERED</span>
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
      body = `<div style="text-align:center;font-size:12.5px;color:var(--muted);font-weight:500">Read the board · tap your answer</div>
        <div class="tile-grid" style="flex:1">${v.qOptions.map((o, idx) => `
          <button type="button" class="answer-tile" style="background:var(${o.colorVar});animation-delay:${idx * 60}ms" data-i="${o.i}">
            <span class="letter">${o.letter}</span><span>${esc(o.label)}</span>
          </button>`).join('')}</div>`;
    } else if (v.ans_guess) {
      body = `<div style="flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center">
        <div style="text-align:center;font-size:14px;color:var(--muted)">${esc(v.qText)}</div>
        <input id="guessInput" inputmode="decimal" placeholder="0" style="height:64px;text-align:center;font:600 30px var(--font-mono)" />
        <div style="text-align:center;font-size:12px;color:var(--faint)">${esc(v.unit || '')}</div>
        <button class="btn btn-primary btn-block" id="lockBtn">Lock in guess</button>
      </div>`;
    } else {
      body = `<div style="flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center">
        <div style="text-align:center;font-size:14px;color:var(--muted)">${esc(v.qText)}</div>
        <input id="shortInput" placeholder="Type your answer" style="height:52px;text-align:center;font-size:16px;font-weight:500" />
        <button class="btn btn-primary btn-block" id="lockBtn">Submit answer</button>
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
        <div style="font:700 19px 'Source Sans 3';letter-spacing:-.01em;color:var(--muted)">You sat this one out</div>
        <div style="font-size:13px;color:var(--faint)">It was your question — no points, but nice writing!</div>`;
    } else if (v.result === 'correct') {
      inner = `<span style="width:68px;height:68px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;box-shadow:var(--shadow-lg);animation:pop .5s ease-out"><span class="mi mif" style="font-size:38px">check</span></span>
        <div style="font:700 22px 'Source Sans 3';letter-spacing:-.01em;color:var(--ok-ink)">Correct!</div>
        <div style="font:600 44px/1 var(--font-mono)">+${v.points}</div>
        <div style="display:flex;gap:8px">
          ${v.streak > 1 ? `<span class="badge" style="background:var(--warn-tint);color:var(--warn-ink);font-family:'Source Sans 3'"><span style="display:inline-block;animation:flame 1s ease-in-out infinite">🔥</span> ${v.streak} streak</span>` : ''}
          <span class="badge" style="background:var(--accent-tint);color:var(--accent-ink);font-family:'Source Sans 3'">${esc(v.rankText)} place</span>
        </div>`;
    } else {
      const label = v.result === 'missed' ? "Time's up" : 'Not this time';
      inner = `<span style="width:68px;height:68px;border-radius:50%;background:var(--bad);color:#fff;display:grid;place-items:center;animation:pop .5s ease-out"><span class="mi mif" style="font-size:38px">close</span></span>
        <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em;color:var(--bad-ink)">${label}</div>
        <div style="font-size:13px;color:var(--muted)">Answer: <b style="color:var(--ink)">${esc(v.correctText)}</b></div>
        <div style="font-size:12.5px;color:var(--faint)">Streak reset · still ${esc(v.rankText)} place</div>`;
    }
    app.innerHTML = `<div class="center-col">${inner}</div>`;
  }

  // ---- SCORES ------------------------------------------------------------------
  function renderScores(v) {
    app.innerHTML = `<div class="center-col">
      <div class="eyebrow">Your standing</div>
      <div style="font:700 52px/1 var(--font-mono);color:var(--accent-ink)">${esc(v.rankText)}</div>
      <div style="font-size:14px;color:var(--muted)"><b class="mono" style="color:var(--ink)">${v.score}</b> points</div>
      <div style="font-size:12.5px;color:var(--faint);display:flex;align-items:center;gap:5px"><span class="mi" style="font-size:16px">tv</span>Watch the board for the standings</div>
    </div>`;
  }

  // ---- PODIUM ------------------------------------------------------------------
  function renderPodium(v) {
    const emoji = v.rank === 1 ? '🏆' : (v.rank <= 3 ? '🥳' : '👏');
    const note = v.rank === 1 ? 'you won!' : (v.rank <= 3 ? 'on the podium!' : 'good game!');
    app.innerHTML = `<div class="center-col">
      <span style="font-size:44px">${emoji}</span>
      <div style="font:700 22px 'Source Sans 3';letter-spacing:-.01em">You finished ${esc(v.rankText)}!</div>
      <div style="font-size:14px;color:var(--muted)"><b class="mono" style="color:var(--ink)">${v.score}</b> points · ${note}</div>
      <button class="btn btn-secondary" id="doneBtn" style="margin-top:8px">Back to join screen</button>
    </div>`;
    app.querySelector('#doneBtn').addEventListener('click', () => { localStorage.removeItem(CODE_KEY); location.href = '/play'; });
  }

  // ---- ENDED ------------------------------------------------------------------
  function renderEnded() {
    app.innerHTML = `<div class="center-col">
      <span class="mi" style="font-size:44px;color:var(--muted)">event_busy</span>
      <div style="font:700 20px 'Source Sans 3';letter-spacing:-.01em">This quiz has ended</div>
      <div style="font-size:13px;color:var(--muted)">Ask your teacher for a new code to join the next one.</div>
      <button class="btn btn-primary" id="backBtn">Join another quiz</button>
    </div>`;
    app.querySelector('#backBtn').addEventListener('click', () => { localStorage.removeItem(CODE_KEY); location.href = '/play'; });
  }

  if (!code) renderJoin();
})();
