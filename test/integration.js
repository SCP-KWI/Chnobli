'use strict';
// End-to-end simulation of a full Chnobli session: one teacher + four
// students, exercising join, authoring, review, the live play loop
// (including auto-reveal, lockout of question authors, scoring, and
// reconnection), and the podium.
//
// This does NOT spawn the server itself (spawning a nested Node process
// proved unreliable in some sandboxes) — start the server first, e.g.:
//   PORT=3987 node server/index.js &
//   sleep 1 && node test/integration.js
// See test/run.sh for the one-shot version.

const { io } = require('socket.io-client');

const PORT = process.env.TEST_PORT || 3987;
const URL = `http://localhost:${PORT}`;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitUntil(fn, { timeout = 5000, interval = 30, label = '' } = {}) {
  global.__lastStep = `waitUntil: ${label}`;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await fn();
    if (v) return v;
    await wait(interval);
  }
  throw new Error(`waitUntil timed out: ${label}`);
}

// autoConnect:false + an explicit .connect() right before we await it keeps
// connection attempts strictly sequential instead of firing several
// simultaneous websocket handshakes, which proved flaky under load.
function makeClient() {
  const socket = io(URL, { transports: ['websocket'], reconnection: false, autoConnect: false });
  return socket;
}

function emit(socket, event, payload) {
  global.__lastStep = `emit: ${event}`;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timed out for "${event}"`)), 8000);
    socket.emit(event, payload, (res) => { clearTimeout(t); resolve(res); });
  });
}

async function connected(socket) {
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket connect timed out')), 10000);
    socket.on('connect', () => { clearTimeout(t); resolve(); });
    socket.on('connect_error', (err) => { clearTimeout(t); reject(err); });
    socket.connect();
  });
}

function makeStudent(name, avatar) {
  const socket = makeClient();
  const box = { socket, name, avatar, playerId: null, state: null };
  socket.on('student:state', (v) => { box.state = v; });
  return box;
}

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('  ✗ FAIL:', msg); } else { console.log('  ✓', msg); }
}

async function main() {
  const watchdog = setTimeout(() => {
    console.error('\nWATCHDOG: test did not finish within 45s — forcing exit. Last step:', global.__lastStep);
    process.exit(2);
  }, 45000);
  watchdog.unref && watchdog.unref();

  console.log('Connecting to server on port', PORT, '(start it separately first) ...');

  await waitUntil(async () => {
    try {
      const res = await fetch(`${URL}/healthz`);
      return res.ok;
    } catch (e) { return false; }
  }, { timeout: 8000, label: 'server healthz' });

  // ---- Teacher creates a quiz ------------------------------------------
  const teacher = makeClient();
  let teacherState = null;
  teacher.on('teacher:state', (v) => { teacherState = v; });
  await connected(teacher);

  // German is the default language when none is specified at creation.
  const defaultLangQuiz = await emit(teacher, 'teacher:create', { title: 'Default language check' });
  await waitUntil(() => teacherState && teacherState.code === defaultLangQuiz.code && teacherState.language, { label: 'default-language quiz reports its language' });
  check(teacherState.language === 'de', 'quizzes default to German when no language is specified');

  // A student in that German-language quiz should get German validation text.
  const deStudent = makeStudent('Testkind', '🦊');
  await connected(deStudent.socket);
  const deJoin = await emit(deStudent.socket, 'student:join', { code: defaultLangQuiz.code, playerId: null });
  await emit(deStudent.socket, 'student:setProfile', { code: defaultLangQuiz.code, playerId: deJoin.playerId, name: 'Testkind', avatar: '🦊' });
  const deBadQuestion = await emit(deStudent.socket, 'student:submitQuestion', { code: defaultLangQuiz.code, playerId: deJoin.playerId, question: { type: 'mc', text: '' } });
  check(deBadQuestion.ok === false && deBadQuestion.error === 'Schreib zuerst eine Frage.', 'validation errors in a German quiz come back in German');

  // True/False labels and ordinals should render in German too, all the way
  // through a live question (this student is the only player, so the
  // question auto-reveals once nobody else is left to answer it).
  const deTF = await emit(deStudent.socket, 'student:submitQuestion', { code: defaultLangQuiz.code, playerId: deJoin.playerId, question: { type: 'tf', text: 'Wasser kocht bei 100°C.', tf: true } });
  check(deTF.ok, 'German student submits a true/false question');
  await emit(teacher, 'teacher:openReview', { code: defaultLangQuiz.code, teacherToken: defaultLangQuiz.teacherToken });
  await waitUntil(() => teacherState.code === defaultLangQuiz.code && teacherState.reviewRows && teacherState.reviewRows.length === 1, { label: 'German quiz shows the submitted question for review' });
  check(teacherState.reviewRows[0].typeLabel === 'WAHR / FALSCH', 'question type labels are translated in the German review list');
  await emit(teacher, 'teacher:approve', { code: defaultLangQuiz.code, teacherToken: defaultLangQuiz.teacherToken, questionId: teacherState.reviewRows[0].id });
  await emit(teacher, 'teacher:start', { code: defaultLangQuiz.code, teacherToken: defaultLangQuiz.teacherToken });
  await waitUntil(() => teacherState.code === defaultLangQuiz.code && teacherState.phase === 'play', { label: 'German quiz question goes live' });
  check(teacherState.qOptions.map((o) => o.label).join('/') === 'Wahr/Falsch', 'True/False tiles are labeled in German during play');
  await waitUntil(() => teacherState.code === defaultLangQuiz.code && teacherState.stage === 'reveal', { timeout: 3000, label: 'German quiz auto-reveals with a lone player' });
  check(teacherState.correctText === 'Wahr', 'the correct-answer text is translated in German');
  await emit(teacher, 'teacher:endQuiz', { code: defaultLangQuiz.code, teacherToken: defaultLangQuiz.teacherToken });
  deStudent.socket.close();

  // This test drives the rest of the flow in English, purely so its own
  // assertions can check exact server-error text below.
  const created = await emit(teacher, 'teacher:create', { title: 'Integration Test Quiz', types: ['mc', 'tf', 'short', 'guess'], language: 'en' });
  check(created.ok && /^\d{4}$/.test(created.code), 'teacher creates a quiz and gets a 4-digit code');
  const session = { code: created.code, teacherToken: created.teacherToken };
  await waitUntil(() => teacherState && teacherState.code === created.code && teacherState.language === 'en', { label: 'quiz honors the requested English language' });

  // wrong-token control should be rejected
  const bad = await emit(teacher, 'teacher:approve', { code: session.code, teacherToken: 'nope', questionId: 'x' });
  check(bad.ok === false && /authoriz/i.test(bad.error), 'teacher actions reject an incorrect teacherToken');

  // ---- Four students join, pick identity, write questions -------------
  const students = [
    makeStudent('Inkwell', '🐙'),
    makeStudent('NightOwl', '🦉'),
    makeStudent('Mothwing', '🦋'),
    makeStudent('Bumble', '🐝'),
  ];
  for (const s of students) {
    await connected(s.socket);
    const res = await emit(s.socket, 'student:join', { code: session.code, playerId: null });
    check(res.ok, `${s.name} joins the lobby`);
    s.playerId = res.playerId;
    const prof = await emit(s.socket, 'student:setProfile', { code: session.code, playerId: s.playerId, name: s.name, avatar: s.avatar });
    check(prof.ok, `${s.name} sets nickname/avatar`);
  }

  await waitUntil(() => teacherState && teacherState.joinedCount === 4, { label: 'teacher sees 4 joined players' });

  const questions = [
    { type: 'mc', text: 'Closest planet to the sun?', durationSec: 10, options: ['Mercury', 'Venus', 'Earth', 'Mars'], correctIndex: 0 },
    { type: 'tf', text: 'Chlorophyll makes plants look green.', durationSec: 20, tf: true },
    { type: 'guess', text: 'Bones in an adult human body?', durationSec: 30, num: 206, unit: 'bones' },
    { type: 'short', text: 'Powerhouse of the cell?', durationSec: 40, answer: 'Mitochondrion' },
  ];
  for (let i = 0; i < students.length; i++) {
    const res = await emit(students[i].socket, 'student:submitQuestion', { code: session.code, playerId: students[i].playerId, question: questions[i] });
    check(res.ok, `${students[i].name} submits a ${questions[i].type} question`);
  }

  await waitUntil(() => teacherState && teacherState.wroteCount === 4, { label: 'teacher sees 4 submitted questions' });
  check(teacherState.reviewRows.every((r) => questions.some((q) => q.durationSec === r.durationSec)), 'each question shows the duration its author chose');

  // A bogus duration should silently fall back to the 20s default rather
  // than being rejected outright. Use a disposable 5th student, whose
  // question we then decline for good, so it can't disturb the play order
  // below — this also exercises the new permanent "decline" path.
  const spareStudent = makeStudent('Sparrow', '🐬');
  await connected(spareStudent.socket);
  const spareJoin = await emit(spareStudent.socket, 'student:join', { code: session.code, playerId: null });
  await emit(spareStudent.socket, 'student:setProfile', { code: session.code, playerId: spareJoin.playerId, name: 'Sparrow', avatar: '🐬' });
  const bogusDurationRes = await emit(spareStudent.socket, 'student:submitQuestion', {
    code: session.code, playerId: spareJoin.playerId,
    question: { type: 'tf', text: 'Filler question, never approved.', tf: true, durationSec: 17 },
  });
  check(bogusDurationRes.ok, 'a non-standard duration is accepted (and normalized) rather than rejected');
  await waitUntil(() => teacherState.reviewRows && teacherState.reviewRows.some((r) => r.author === 'Sparrow' && r.durationSec === 20), { label: 'the normalized duration falls back to 20s' });
  const spareRow = teacherState.reviewRows.find((r) => r.author === 'Sparrow');
  const declineRes = await emit(teacher, 'teacher:decline', { ...session, questionId: spareRow.id });
  check(declineRes.ok, 'teacher declines the filler question');
  await waitUntil(() => teacherState.reviewRows.find((r) => r.author === 'Sparrow').status === 'declined', { label: 'the filler question shows as declined to the teacher' });
  await waitUntil(() => spareStudent.state && spareStudent.state.step === 'declined', { label: 'Sparrow sees the declined screen' });
  const resubmitAfterDecline = await emit(spareStudent.socket, 'student:submitQuestion', {
    code: session.code, playerId: spareJoin.playerId, question: { type: 'tf', text: 'Trying again?', tf: true },
  });
  check(resubmitAfterDecline.ok === false, 'a declined question cannot be resubmitted');
  spareStudent.socket.close();

  // ---- Reject-then-resubmit flow ---------------------------------------
  teacher.emit('teacher:openReview', session, () => {});
  await waitUntil(() => teacherState && teacherState.phase === 'review', { label: 'teacher opens review' });
  const firstQid = teacherState.reviewRows[0].id;
  await emit(teacher, 'teacher:reject', { ...session, questionId: firstQid });
  await waitUntil(() => students[0].state && students[0].state.step === 'write' && students[0].state.rejected, { label: 'rejected author is sent back to the write screen' });
  const resubmit = await emit(students[0].socket, 'student:submitQuestion', { code: session.code, playerId: students[0].playerId, question: questions[0] });
  check(resubmit.ok, 'author edits and resubmits the rejected question');

  const studentNames = students.map((s) => s.name);
  const realRows = () => teacherState.reviewRows.filter((r) => studentNames.includes(r.author));
  for (const row of (await waitUntil(() => realRows().every((r) => r.status !== 'rejected') && realRows(), { label: 'no rejected rows remain among the real questions' }))) {
    await emit(teacher, 'teacher:approve', { ...session, questionId: row.id });
  }
  await waitUntil(() => teacherState.approvedCount === 4, { label: 'all 4 questions approved' });

  const cantStartTwice = await emit(teacher, 'teacher:start', { code: session.code, teacherToken: 'wrong' });
  check(cantStartTwice.ok === false, 'starting with a bad token is rejected');

  // ---- Start the quiz and play through every question -------------------
  const startRes = await emit(teacher, 'teacher:start', session);
  check(startRes.ok, 'teacher starts the quiz');
  await waitUntil(() => teacherState.phase === 'play' && teacherState.stage === 'active', { label: 'first question goes live' });

  for (let qi = 0; qi < 4; qi++) {
    await waitUntil(() => teacherState.phase === 'play' && teacherState.stage === 'active' && teacherState.qNum === qi + 1, { label: `question ${qi + 1} active` });
    const authorName = teacherState.qAuthor;
    const author = students.find((s) => s.name === authorName);
    check(author.state.step === 'play' && author.state.isUser === true, `author (${authorName}) is locked out of their own question`);
    check(teacherState.durationSec === questions[qi].durationSec, `question ${qi + 1} runs for the ${questions[qi].durationSec}s its author chose`);

    const lockedAttempt = await emit(author.socket, 'student:submitAnswer', { code: session.code, playerId: author.playerId, value: 0 });
    check(lockedAttempt.ok === false, `${authorName} cannot answer their own question`);

    const others = students.filter((s) => s !== author);
    // answer with a deliberate mix of right/wrong so we can sanity-check scoring
    for (let i = 0; i < others.length; i++) {
      const s = others[i];
      const st = s.state;
      let value;
      const wantCorrect = i !== 0; // first "other" answers wrong on purpose
      if (st.type === 'mc') value = wantCorrect ? st.qOptions.find((o) => o.label === questions[qi].options[questions[qi].correctIndex]).i : st.qOptions.find((o) => o.i !== questions[qi].correctIndex).i;
      else if (st.type === 'tf') value = wantCorrect ? questions[qi].tf : !questions[qi].tf;
      else if (st.type === 'guess') value = wantCorrect ? questions[qi].num : questions[qi].num * 3 + 50;
      else value = wantCorrect ? questions[qi].answer : 'nonsense';
      const ans = await emit(s.socket, 'student:submitAnswer', { code: session.code, playerId: s.playerId, value });
      check(ans.ok, `${s.name} answers question ${qi + 1}`);
    }

    // all non-author players answered -> should auto-reveal well before the 4s timer
    await waitUntil(() => teacherState.phase === 'play' && teacherState.stage === 'reveal' && teacherState.qNum === qi + 1, { timeout: 3000, label: `question ${qi + 1} auto-reveals once everyone answered` });

    await emit(teacher, 'teacher:showScores', session);
    await waitUntil(() => teacherState.stage === 'scores', { label: `question ${qi + 1} shows scores` });

    if (qi === 0) {
      // reconnection check: drop and rejoin a student mid-game using the same playerId
      const victim = others[0];
      const priorScore = victim.state.score;
      victim.socket.disconnect();
      await wait(150);
      const fresh = makeClient();
      await connected(fresh);
      const rejoinRes = await emit(fresh, 'student:join', { code: session.code, playerId: victim.playerId });
      check(rejoinRes.ok, 'disconnected student reconnects with the same playerId');
      let rejoinState = null;
      fresh.on('student:state', (v) => { rejoinState = v; });
      await waitUntil(() => rejoinState && rejoinState.score === priorScore, { label: 'reconnected student keeps their score' });
      victim.socket = fresh;
      victim.state = rejoinState;
      fresh.on('student:state', (v) => { victim.state = v; });
    }

    const nextRes = await emit(teacher, 'teacher:next', session);
    check(nextRes.ok, `advance past question ${qi + 1}`);
  }

  await waitUntil(() => teacherState.phase === 'podium', { label: 'quiz reaches the podium after the last question' });
  // Sparrow also joined this room (for the bogus-duration check above), so
  // the board has 5 entries — just confirm the 4 real players are all in it.
  check(Array.isArray(teacherState.board) && studentNames.every((n) => teacherState.board.some((r) => r.name === n)), 'final leaderboard has all 4 real players');
  const sortedDesc = [...teacherState.board].every((r, i, arr) => i === 0 || arr[i - 1].score >= r.score);
  check(sortedDesc, 'final leaderboard is sorted by score descending');
  check(teacherState.podium.first.score >= teacherState.podium.second.score, 'first place score >= second place');

  // late joiner should be rejected once the quiz has started/finished
  const lateSocket = makeClient();
  await connected(lateSocket);
  const lateRes = await emit(lateSocket, 'student:join', { code: session.code, playerId: null });
  check(lateRes.ok === false, 'a brand-new student cannot join once the quiz has started');

  // ---- End quiz notifies remaining students -----------------------------
  let endedSeen = false;
  students[1].socket.on('quiz:ended', () => { endedSeen = true; });
  await emit(teacher, 'teacher:endQuiz', session);
  await waitUntil(() => endedSeen, { label: 'students are notified when the teacher ends the quiz' });

  clearTimeout(watchdog);
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  students.forEach((s) => s.socket.close());
  teacher.close();
  process.exitCode = failures === 0 ? 0 : 1;
  setTimeout(() => process.exit(process.exitCode), 100);
}

main().catch((err) => {
  console.error('Integration test crashed:', err);
  process.exit(1);
});
