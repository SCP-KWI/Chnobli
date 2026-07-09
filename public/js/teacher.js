(function () {
  const { esc, confettiHTML } = window.QZ;
  const I18N = window.I18N;
  const stage = document.getElementById('stage-wrap');
  const stepChip = document.getElementById('stepChip');
  const endBtn = document.getElementById('endBtn');
  const endBtnText = document.getElementById('endBtnText');
  const teacherConsoleLabel = document.getElementById('teacherConsoleLabel');
  const bottomHint = document.getElementById('bottomHint');
  const pageTitle = document.getElementById('pageTitle');
  const SESSION_KEY = 'chnobli:teacher-session';
  const LANG_KEY = 'chnobli:lang';

  const socket = io();
  let session = null; // {code, teacherToken}
  let latestView = null;

  const savedLang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'de';
  let setupDraft = { title: '', types: ['mc', 'tf', 'short', 'guess'], language: savedLang };

  // Once a quiz exists, its language (chosen at setup) is authoritative for
  // everyone in it — teacher and students alike. Before that, we go by
  // whatever the setup screen's toggle is currently set to.
  function lang() { return (latestView && latestView.language) || setupDraft.language; }
  function t(key, vars) { return I18N.t(lang(), key, vars); }

  function applyStaticText() {
    document.documentElement.lang = lang();
    teacherConsoleLabel.textContent = t('teacherConsole');
    endBtnText.textContent = t('endQuizBtn');
    pageTitle.textContent = t('pageTitleTeacher');
    bottomHint.innerHTML = t('bottomHintTeacher', { host: '<b>/play</b>' });
  }

  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { session = null; }

  function saveSession(s) {
    session = s;
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  function setStep(icon, text) {
    stepChip.innerHTML = `<span class="mi mif" style="font-size:16px;color:var(--accent)">${icon}</span>${esc(text)}`;
  }

  socket.on('connect', () => {
    if (session) {
      socket.emit('teacher:rejoin', session, (res) => {
        if (!res || !res.ok) { saveSession(null); renderSetup(); }
      });
    } else {
      renderSetup();
    }
  });

  socket.on('teacher:state', (view) => {
    latestView = view;
    endBtn.style.display = 'inline-flex';
    applyStaticText();
    render(view);
  });

  endBtn.addEventListener('click', () => {
    if (!session) return;
    if (!confirm(t('endQuizConfirm'))) return;
    socket.emit('teacher:endQuiz', session, () => {
      saveSession(null);
      latestView = null;
      endBtn.style.display = 'none';
      renderSetup();
    });
  });

  function render(view) {
    if (view.phase === 'lobby' || view.phase === 'review') renderLobbyOrReview(view);
    else if (view.phase === 'play') renderPlay(view);
    else if (view.phase === 'podium') renderPodium(view);
  }

  // ---- SETUP ------------------------------------------------------------
  function renderSetup() {
    applyStaticText();
    setStep('edit_square', t('stepSetup'));
    endBtn.style.display = 'none';
    const typeDefs = [
      ['mc', 'list_alt', t('type_mc')],
      ['tf', 'balance', t('type_tf')],
      ['short', 'short_text', t('type_short')],
      ['guess', 'tag', t('type_guess')],
    ];
    stage.innerHTML = `
      <div class="card" style="max-width:640px;margin:0 auto">
        <div class="card-head">
          <div style="display:flex;align-items:center;gap:10px"><span class="badge-icon" style="width:30px;height:30px"><span class="mi" style="font-size:18px">quiz</span></span><span style="font-weight:700;font-size:15px">${esc(t('newQuizCardTitle'))}</span></div>
          <div style="display:flex;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:4px;gap:3px" id="langToggle">
            <button type="button" data-lang="de" class="lang-opt" style="padding:6px 12px;border-radius:8px;font-weight:600;font-size:12.5px;${setupDraft.language === 'de' ? 'background:var(--surface);box-shadow:var(--shadow);color:var(--accent-ink)' : 'color:var(--muted)'}">Deutsch</button>
            <button type="button" data-lang="en" class="lang-opt" style="padding:6px 12px;border-radius:8px;font-weight:600;font-size:12.5px;${setupDraft.language === 'en' ? 'background:var(--surface);box-shadow:var(--shadow);color:var(--accent-ink)' : 'color:var(--muted)'}">English</button>
          </div>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:18px">
          <div><div class="eyebrow" style="margin-bottom:8px">${esc(t('quizTitleLabel'))}</div>
            <input id="titleInput" value="${esc(setupDraft.title)}" placeholder="${esc(t('defaultQuizTitle'))}" style="height:48px;padding:0 14px;font-size:16px;font-weight:500" /></div>
          <div><div class="eyebrow" style="margin-bottom:10px">${esc(t('typesLabel'))}</div>
            <div style="display:flex;flex-wrap:wrap;gap:10px" id="typeChips">
              ${typeDefs.map(([t2, icon, label]) => `<button type="button" class="type-chip ${setupDraft.types.includes(t2) ? 'on' : ''}" data-type="${t2}"><span class="mi mif" style="font-size:17px">${icon}</span>${esc(label)}</button>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-lg" id="createBtn">${esc(t('createBtn'))}<span class="mi" style="font-size:20px">arrow_forward</span></button>
          <div id="setupError" style="color:var(--bad-ink);font-size:13px;display:none"></div>
        </div>
      </div>`;
    stage.querySelector('#titleInput').addEventListener('input', (e) => { setupDraft.title = e.target.value; });
    stage.querySelectorAll('.lang-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        setupDraft.language = btn.dataset.lang;
        localStorage.setItem(LANG_KEY, setupDraft.language);
        renderSetup();
      });
    });
    stage.querySelectorAll('.type-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const i = setupDraft.types.indexOf(type);
        if (i >= 0) { if (setupDraft.types.length > 1) setupDraft.types.splice(i, 1); }
        else setupDraft.types.push(type);
        btn.classList.toggle('on', setupDraft.types.includes(type));
      });
    });
    stage.querySelector('#createBtn').addEventListener('click', () => {
      socket.emit('teacher:create', { title: setupDraft.title, types: setupDraft.types, language: setupDraft.language }, (res) => {
        if (!res || !res.ok) {
          const err = stage.querySelector('#setupError');
          err.textContent = (res && res.error) || t('createError');
          err.style.display = 'block';
          return;
        }
        saveSession({ code: res.code, teacherToken: res.teacherToken });
      });
    });
  }

  // ---- LOBBY & REVIEW -----------------------------------------------------
  function renderLobbyOrReview(view) {
    if (view.phase === 'lobby') setStep('login', t('stepLobby', { code: view.code }));
    else setStep('fact_check', t('stepReview'));

    const joinUrl = `${location.origin}/play?code=${view.code}`;
    const avatarsHtml = view.players.filter((p) => p.name).map((p) =>
      `<span class="avatar" style="width:38px;height:38px;font-size:19px;animation:pop .3s ease-out">${esc(p.avatar || '🙂')}</span>`
    ).join('') || `<span style="color:var(--muted);font-size:13px">${esc(t('nobodyYet'))}</span>`;

    let body;
    if (view.phase === 'lobby') {
      body = `
        <div style="display:flex;gap:28px;padding:28px;flex-wrap:wrap">
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px;flex:none">
            <div style="font-size:12px;color:var(--muted)">${t('joinAt', { host: `<b style="color:var(--ink)">${esc(location.host)}</b>` })}</div>
            <div class="mono" style="font:700 54px/1 var(--font-mono);letter-spacing:.14em;color:var(--accent-ink)">${esc(view.code)}</div>
            <div id="qr" style="width:132px;height:132px;border-radius:var(--r);overflow:hidden;background:#fff;display:grid;place-items:center;border:1px solid var(--line)"></div>
          </div>
          <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:12px;min-height:170px">
            <div class="mono" style="font:600 12px var(--font-mono);color:var(--muted)">${esc(t('joinedWrote', { joined: view.joinedCount, wrote: view.wroteCount }))}</div>
            <div class="avatar-row">${avatarsHtml}</div>
            <div style="flex:1"></div>
            <button class="btn btn-primary" id="reviewBtn" style="align-self:flex-end" ${view.wroteCount ? '' : 'disabled'}>${esc(t('reviewQuestionsBtn'))}<span class="mi" style="font-size:19px">arrow_forward</span></button>
          </div>
        </div>`;
    } else {
      const rows = (view.reviewRows || []).map((r) => `
        <div class="review-row" data-qid="${r.id}">
          <span class="avatar" style="width:36px;height:36px;font-size:18px">${esc(r.avatar || '🙂')}</span>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <span class="badge badge-neutral">${esc(t('type_' + r.type).toUpperCase())}</span>
              <span class="badge badge-neutral"><span class="mi mif" style="font-size:12px">timer</span>${r.durationSec}s</span>
              <span style="font-size:12px;color:var(--muted)">${esc(r.author)}</span>
              ${r.status === 'approved' ? `<span class="badge badge-ok"><span class="mi mif" style="font-size:12px">check</span>${esc(t('approvedBadge'))}</span>` : ''}
              ${r.status === 'rejected' ? `<span class="badge" style="background:var(--bad-tint);color:var(--bad-ink)">${esc(t('sentBackBadge'))}</span>` : ''}
            </div>
            <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.text)}</div>
          </div>
          <div style="display:flex;gap:7px;flex:none">
            <button class="btn btn-primary approve-btn" style="height:34px;padding:0 13px;font-size:12px" ${r.status === 'approved' ? 'disabled' : ''}><span class="mi" style="font-size:15px">check</span>${esc(t('approveBtn'))}</button>
            <button class="btn btn-secondary reject-btn" style="height:34px;width:34px;padding:0" ${r.status === 'rejected' ? 'disabled' : ''}><span class="mi" style="font-size:17px">close</span></button>
          </div>
        </div>`).join('') || `<div style="color:var(--muted);font-size:13px;padding:14px 0">${esc(t('noQuestionsYet'))}</div>`;
      body = `
        <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
          ${rows}
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--line);margin-top:4px">
            <span class="mono" style="font:600 12px var(--font-mono);color:var(--muted)">${esc(t('approvedPending', { approved: view.approvedCount, pending: view.pendingCount }))}</span>
            <button class="btn btn-primary" id="startBtn" ${view.canStart ? '' : 'disabled'}><span class="mi mif" style="font-size:20px">play_arrow</span>${esc(t('startQuizBtn'))}</button>
          </div>
        </div>`;
    }

    const headTitle = view.phase === 'lobby'
      ? `<span style="display:flex;align-items:center;gap:10px"><span class="badge-icon" style="width:28px;height:28px"><span class="mi" style="font-size:17px">quiz</span></span><span style="font-weight:700;font-size:15px">${esc(view.title)}</span></span><span class="badge badge-ok"><span style="width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block"></span>${esc(t('lobbyOpenBadge'))}</span>`
      : `<span style="display:flex;align-items:center;gap:10px"><span class="badge-icon" style="width:28px;height:28px"><span class="mi" style="font-size:17px">quiz</span></span><span style="font-weight:700;font-size:15px">${esc(t('reviewQuestionsTitle'))}</span></span>`;

    stage.innerHTML = `<div class="stage" style="margin:0 auto"><div class="card ${view.phase === 'lobby' ? 'dark-card' : ''}" data-theme="${view.phase === 'lobby' ? 'dark' : ''}">
      <div class="card-head">${headTitle}</div>
      ${body}
    </div></div>`;

    if (view.phase === 'lobby') {
      new QRCode(stage.querySelector('#qr'), { text: joinUrl, width: 128, height: 128, colorDark: '#241f18', colorLight: '#ffffff' });
      const reviewBtn = stage.querySelector('#reviewBtn');
      reviewBtn && reviewBtn.addEventListener('click', () => socket.emit('teacher:openReview', session, () => {}));
    } else {
      stage.querySelectorAll('.review-row').forEach((row) => {
        const qid = row.dataset.qid;
        row.querySelector('.approve-btn').addEventListener('click', () => socket.emit('teacher:approve', { ...session, questionId: qid }, () => {}));
        row.querySelector('.reject-btn').addEventListener('click', () => socket.emit('teacher:reject', { ...session, questionId: qid }, () => {}));
      });
      const startBtn = stage.querySelector('#startBtn');
      startBtn && startBtn.addEventListener('click', () => socket.emit('teacher:start', session, (res) => {
        if (res && !res.ok) alert(res.error);
      }));
    }
  }

  // ---- PLAY ---------------------------------------------------------------
  function renderPlay(view) {
    setStep('sports_esports', t('stepPlay', { n: view.qNum, total: view.qTotal }));
    if (view.stage === 'active') renderActive(view);
    else if (view.stage === 'reveal') renderReveal(view);
    else if (view.stage === 'scores') renderScores(view);
  }

  function renderActive(view) {
    const pct = Math.round((100 * view.timeLeft) / view.durationSec);
    const ringColor = view.timeLeft <= 5 ? 'var(--warn)' : 'var(--accent)';
    const ringAnim = view.timeLeft <= 5 ? 'ringPulse 1s ease-in-out infinite' : 'none';
    let answerArea = '';
    if (view.ansChoice) {
      answerArea = `<div class="tile-grid" style="padding:0 28px">${view.qOptions.map((o, idx) => `
        <div class="tile" style="background:var(${o.colorVar});animation-delay:${idx * 60}ms">
          <span class="letter">${o.letter}</span><span>${esc(o.label)}</span>
        </div>`).join('')}</div>`;
    } else {
      answerArea = `<div style="margin:0 28px;padding:22px;border-radius:var(--r-md);background:var(--surface-2);display:flex;align-items:center;justify-content:center;gap:10px;color:var(--muted);font-size:16px">
        <span class="mi mif" style="font-size:24px;color:var(--observations)">edit</span>${esc(t('answerOnPhone'))}</div>`;
    }
    stage.innerHTML = `<div class="stage" style="margin:0 auto"><div class="card dark-card" data-theme="dark">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 26px">
        <span class="badge badge-neutral">Q ${view.qNum} / ${view.qTotal}</span>
        <div style="display:flex;align-items:center;gap:16px">
          <span class="chip"><span class="mi" style="font-size:16px">edit</span>${esc(t('byAuthor', { avatar: view.qAvatar, author: view.qAuthor }))}</span>
          <span class="ring" style="width:64px;height:64px;background:conic-gradient(${ringColor} ${pct}%, var(--surface-2) 0);animation:${ringAnim}">
            <span class="ring-inner" style="width:50px;height:50px">${view.timeLeft}</span>
          </span>
          <button class="btn btn-ghost" id="skipBtn" style="height:34px;padding:0 10px;font-size:12px" title="${esc(t('skipTitle'))}">${esc(t('skipBtn'))}</button>
        </div>
      </div>
      <div class="q-text">${esc(view.qText)}</div>
      ${answerArea}
      <div style="display:flex;align-items:center;gap:14px;padding:24px 26px 26px">
        <span class="chip mono" style="font:600 13px var(--font-mono)"><span class="mi mif" style="font-size:18px;color:var(--accent)">group</span>${esc(t('answeredCount', { n: view.answered, m: view.expected }))}</span>
        <div class="progressbar" style="flex:1"><div style="width:${view.ansPct}%"></div></div>
      </div>
    </div></div>`;
    stage.querySelector('#skipBtn').addEventListener('click', () => socket.emit('teacher:forceReveal', session, () => {}));
  }

  function renderReveal(view) {
    let body = '';
    if (view.ansChoice) {
      const maxCount = Math.max(1, ...view.dist.map((d) => d.count));
      body = `<div style="padding:4px 26px 18px;display:flex;flex-direction:column;gap:10px">${view.dist.map((d) => `
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:${Math.max(10, Math.round((100 * d.count) / maxCount))}%;min-width:52px;height:34px;border-radius:8px;background:${d.isCorrect ? 'var(--ok)' : 'var(--surface-2)'};display:flex;align-items:center;padding:0 12px;color:${d.isCorrect ? '#fff' : 'var(--muted)'};font:600 12px var(--font-mono);transition:width .5s">${esc(d.label)} · ${d.count}${d.isCorrect ? ' ' + esc(t('correctSuffix')) : ''}</div>
        </div>`).join('')}</div>`;
    } else {
      body = `<div style="padding:8px 26px 22px;text-align:center"><div class="eyebrow" style="margin-bottom:6px">${esc(t('correctAnswerLabel'))}</div><div style="font:700 42px var(--font-mono);color:var(--accent-ink)">${esc(view.correctText)}</div></div>`;
    }
    stage.innerHTML = `<div class="stage" style="margin:0 auto"><div class="card dark-card" data-theme="dark">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px">
        <span class="mono" style="font:600 12px var(--font-mono);color:var(--muted)">${esc(t('resultsLabel', { n: view.qNum, total: view.qTotal }))}</span>
        <span class="badge" style="background:var(--ok);color:#fff;font-size:13px"><span class="mi mif" style="font-size:17px">check_circle</span>${esc(view.correctText)}</span>
      </div>
      ${body}
      <div style="display:flex;justify-content:flex-end;padding:0 24px 24px">
        <button class="btn btn-primary" id="scoresBtn">${esc(t('showScoresBtn'))}<span class="mi" style="font-size:19px">arrow_forward</span></button>
      </div>
    </div></div>`;
    stage.querySelector('#scoresBtn').addEventListener('click', () => socket.emit('teacher:showScores', session, () => {}));
  }

  function renderScores(view) {
    const rows = (view.board || []).map((r, i) => `
      <div class="board-row" style="animation-delay:${i * 70}ms">
        <span class="mono" style="font:700 19px var(--font-mono);color:${i === 0 ? 'var(--accent-ink)' : 'var(--muted)'};width:24px">${r.rank}</span>
        <span class="avatar" style="width:34px;height:34px;font-size:17px">${esc(r.avatar)}</span>
        <span style="flex:1;font-weight:600;font-size:15px">${esc(r.name)}</span>
        <span class="mono" style="font:600 15px var(--font-mono)">${r.score}</span>
        <span class="mi" style="font-size:18px;color:${r.delta > 0 ? 'var(--ok)' : (r.delta < 0 ? 'var(--bad)' : 'var(--faint)')}">${r.deltaIcon}</span>
      </div>`).join('');
    stage.innerHTML = `<div class="stage" style="margin:0 auto"><div class="card dark-card" data-theme="dark">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px">
        <span style="font-weight:700;font-size:18px">${esc(t('leaderboardTitle'))}</span>
        <span class="badge badge-neutral">${esc(t('afterQ', { n: view.qNum }))}</span>
      </div>
      <div style="padding:2px 22px 22px;display:flex;flex-direction:column;gap:8px">
        ${rows}
        <button class="btn btn-primary" id="nextBtn" style="margin-top:6px">${esc(view.nextLabel)}<span class="mi" style="font-size:19px">arrow_forward</span></button>
      </div>
    </div></div>`;
    stage.querySelector('#nextBtn').addEventListener('click', () => socket.emit('teacher:next', session, () => {}));
  }

  // ---- PODIUM ---------------------------------------------------------------
  function renderPodium(view) {
    setStep('emoji_events', t('stepPodium'));
    const p = view.podium || {};
    const placeLabel = (place) => t('place' + place);
    const slot = (entry, place, height) => entry ? `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:${place === 1 ? 1.15 : 1}">
        <span class="avatar" style="width:${place === 1 ? 52 : 44}px;height:${place === 1 ? 52 : 44}px;font-size:${place === 1 ? 26 : 22}px">${esc(entry.avatar)}</span>
        <div class="podium-bar" style="width:100%;height:${height}px;background:${place === 1 ? 'var(--accent)' : 'var(--surface-2)'};color:${place === 1 ? '#fff' : 'var(--ink)'}">
          <span style="font-weight:700;font-size:${place === 1 ? 17 : 15}px">${esc(placeLabel(place))}</span>
          <span class="mono" style="font:600 ${place === 1 ? 13 : 12}px var(--font-mono);opacity:.9">${entry.score}</span>
          <span style="font-size:11px;opacity:.85">${esc(entry.name)}</span>
        </div>
      </div>` : '<div style="flex:1"></div>';
    stage.innerHTML = `<div class="stage" style="margin:0 auto"><div class="card dark-card" data-theme="dark">
      <div style="padding:26px;display:flex;flex-direction:column;align-items:center;gap:18px;position:relative">
        <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:var(--r-lg)">${confettiHTML(26)}</div>
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:34px">🏆</span><div style="font-weight:700;font-size:21px">${esc(t('finalResultsTitle'))}</div></div>
        <div style="position:relative;z-index:1;display:flex;align-items:flex-end;gap:14px;width:100%;max-width:440px;justify-content:center">
          ${slot(p.second, 2, 82)}${slot(p.first, 1, 118)}${slot(p.third, 3, 60)}
        </div>
        <button class="btn btn-primary" id="newQuizBtn" style="position:relative;z-index:1"><span class="mi" style="font-size:19px">restart_alt</span>${esc(t('newQuizBtn'))}</button>
      </div>
    </div></div>`;
    stage.querySelector('#newQuizBtn').addEventListener('click', () => {
      socket.emit('teacher:endQuiz', session, () => {
        saveSession(null);
        setupDraft = { title: '', types: ['mc', 'tf', 'short', 'guess'], language: setupDraft.language };
        latestView = null;
        endBtn.style.display = 'none';
        renderSetup();
      });
    });
  }

  applyStaticText();
  if (!session) renderSetup();
})();
