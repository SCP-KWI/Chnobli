'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { RoomManager } = require('./rooms');
const {
  AVATARS, DEFAULT_DURATION_SEC, newId, ordinal,
  sanitizeQuestion, checkAnswer, pointsFor, rankMap,
} = require('./game');
const I18N = require('../public/js/i18n.js');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/teacher', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'teacher.html')));
app.get('/play', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'play.html')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const manager = new RoomManager();

// ---------------------------------------------------------------------------
// Answer-tile palette: the four Chalk sibling-app hues double as the four
// multiple-choice colors, paired with plain letter badges (no Kahoot-style
// triangle/diamond/circle/square iconography).
const OPTION_STYLES = [
  { letter: 'A', var: '--quizzes' },
  { letter: 'B', var: '--names' },
  { letter: 'C', var: '--grades' },
  { letter: 'D', var: '--observations' },
];
const TF_STYLES = [
  { letter: 'T', var: '--quizzes' },
  { letter: 'F', var: '--names' },
];
const TYPE_LABEL_KEY = { mc: 'type_mc', tf: 'type_tf', short: 'type_short', guess: 'type_guess' };

function typeLabel(t, lang) {
  return I18N.t(lang, TYPE_LABEL_KEY[t] || 'type_mc');
}

function getQuestion(room, id) {
  return room.questions.find((q) => q.id === id) || null;
}
function currentQuestion(room) {
  if (!room.current) return null;
  return getQuestion(room, room.current.questionId);
}
function connectedPlayers(room) {
  return [...room.players.values()].filter((p) => p.connected);
}
function expectedAnswerers(room) {
  const q = currentQuestion(room);
  if (!q) return 0;
  return connectedPlayers(room).filter((p) => p.id !== q.authorId).length;
}

// ---------------------------------------------------------------------------
// Timers / play loop

function clearRoomTimer(room) {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
  if (room.revealTimeout) { clearTimeout(room.revealTimeout); room.revealTimeout = null; }
}

function startQuestion(room) {
  clearRoomTimer(room);
  const scoreSnapshot = {};
  room.players.forEach((p) => { scoreSnapshot[p.id] = p.score; });
  const questionId = room.playOrder[room.currentIndex];
  const q = getQuestion(room, questionId);
  const durationSec = (q && q.durationSec) || DEFAULT_DURATION_SEC;
  room.current = {
    questionId,
    stage: 'active',
    startedAt: Date.now(),
    durationMs: durationSec * 1000,
    answers: new Map(),
    prevRank: rankMap(scoreSnapshot),
  };
  room.timer = setInterval(() => tick(room), 1000);
  broadcastAll(room);
  maybeAutoReveal(room);
}

function tick(room) {
  if (!room.current || room.current.stage !== 'active') return;
  const elapsed = Date.now() - room.current.startedAt;
  if (elapsed >= room.current.durationMs) {
    revealQuestion(room);
  } else {
    broadcastAll(room);
  }
}

function maybeAutoReveal(room) {
  if (!room.current || room.current.stage !== 'active') return;
  const expected = expectedAnswerers(room);
  if (expected === 0) {
    clearTimeout(room.revealTimeout);
    room.revealTimeout = setTimeout(() => revealQuestion(room), 1200);
  } else if (room.current.answers.size >= expected) {
    revealQuestion(room);
  }
}

function revealQuestion(room) {
  if (!room.current || room.current.stage !== 'active') return;
  clearRoomTimer(room);
  room.current.stage = 'reveal';
  broadcastAll(room);
}

// ---------------------------------------------------------------------------
// View models

function reviewRows(room) {
  return room.questions.map((q) => ({
    id: q.id,
    typeLabel: typeLabel(q.type, room.language).toUpperCase(),
    type: q.type,
    text: q.text,
    author: q.authorName,
    avatar: q.authorAvatar,
    status: q.status,
    durationSec: q.durationSec || DEFAULT_DURATION_SEC,
  }));
}

function scoreBoard(room, prevRank) {
  const players = [...room.players.values()];
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((p, i) => {
    const prev = (prevRank && prevRank[p.id]) || i + 1;
    const delta = prev - (i + 1);
    return {
      id: p.id, rank: i + 1, name: p.name || I18N.t(room.language, 'playerFallback'), avatar: p.avatar || '🙂', score: p.score,
      delta, deltaIcon: delta > 0 ? 'arrow_upward' : (delta < 0 ? 'arrow_downward' : 'remove'),
    };
  });
}

function questionPlayData(room, q) {
  const lang = room.language;
  const tfLabels = [I18N.t(lang, 'trueLabel'), I18N.t(lang, 'falseLabel')];
  const ansChoice = q.type === 'mc' || q.type === 'tf';
  let qOptions = [];
  if (q.type === 'mc') {
    qOptions = q.options
      .map((label, i) => ({ label, i }))
      .filter((o) => o.label)
      .map((o, idx) => ({ label: o.label, i: o.i, letter: OPTION_STYLES[idx].letter, colorVar: OPTION_STYLES[idx].var }));
  } else if (q.type === 'tf') {
    qOptions = TF_STYLES.map((s, i) => ({ label: tfLabels[i], i, letter: s.letter, colorVar: s.var }));
  }
  let correctText = '';
  let dist = [];
  if (q.type === 'mc') {
    correctText = q.options[q.correctIndex];
  } else if (q.type === 'tf') {
    correctText = q.tf ? tfLabels[0] : tfLabels[1];
  } else if (q.type === 'guess') {
    correctText = String(q.num) + (q.unit ? ` ${q.unit}` : '');
  } else {
    correctText = q.answer;
  }
  return { type: q.type, ansChoice, ans_guess: q.type === 'guess', ans_short: q.type === 'short', qOptions, correctText, unit: q.unit || '' };
}

function distribution(room, q) {
  const lang = room.language;
  const tfLabels = [I18N.t(lang, 'trueLabel'), I18N.t(lang, 'falseLabel')];
  const answers = [...(room.current ? room.current.answers.values() : [])];
  const exp = Math.max(1, expectedAnswerers(room));
  if (q.type === 'mc') {
    return q.options.map((label, i) => {
      if (!label) return null;
      const count = answers.filter((a) => a.rawValue === i).length;
      const isCorrect = i === q.correctIndex;
      return { label, count, isCorrect, pct: Math.round((100 * count) / exp) };
    }).filter(Boolean);
  }
  if (q.type === 'tf') {
    return TF_STYLES.map((s, i) => {
      const boolVal = i === 0;
      const count = answers.filter((a) => a.rawValue === boolVal).length;
      const isCorrect = boolVal === q.tf;
      return { label: tfLabels[i], count, isCorrect, pct: Math.round((100 * count) / exp) };
    });
  }
  return [];
}

function teacherView(room) {
  const base = {
    code: room.code,
    title: room.title,
    language: room.language,
    allowedTypes: room.allowedTypes,
    phase: room.phase,
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, connected: p.connected,
      wrote: !!p.submittedQuestionId, score: p.score,
    })),
  };
  base.joinedCount = base.players.filter((p) => p.name).length;
  base.wroteCount = base.players.filter((p) => p.wrote).length;

  if (room.phase === 'lobby' || room.phase === 'review') {
    base.reviewRows = reviewRows(room);
    base.pendingCount = base.reviewRows.filter((r) => r.status === 'pending').length;
    base.approvedCount = base.reviewRows.filter((r) => r.status === 'approved').length;
    base.canStart = base.approvedCount >= 1;
  }

  if (room.phase === 'play' && room.current) {
    const q = currentQuestion(room);
    const stage = room.current.stage;
    const elapsed = Date.now() - room.current.startedAt;
    const timeLeft = Math.max(0, Math.ceil((room.current.durationMs - elapsed) / 1000));
    const expected = expectedAnswerers(room);
    const answered = room.current.answers.size;
    Object.assign(base, {
      stage,
      qNum: room.currentIndex + 1,
      qTotal: room.playOrder.length,
      qText: q.text,
      qAuthor: q.authorName,
      qAvatar: q.authorAvatar,
      timeLeft,
      durationSec: Math.round(room.current.durationMs / 1000),
      expected,
      answered,
      ansPct: expected ? Math.round((100 * answered) / expected) : 100,
      ...questionPlayData(room, q),
    });
    if (stage === 'reveal') {
      base.dist = distribution(room, q);
    }
    if (stage === 'reveal' || stage === 'scores') {
      base.board = scoreBoard(room, room.current.prevRank);
      base.nextLabel = I18N.t(room.language, room.currentIndex + 1 < room.playOrder.length ? 'nextQuestionBtn' : 'finalResultsBtn');
    }
  }

  if (room.phase === 'podium') {
    const board = scoreBoard(room, {});
    base.podium = { first: board[0] || null, second: board[1] || null, third: board[2] || null };
    base.board = board;
  }

  return base;
}

function studentView(room, player) {
  const base = {
    code: room.code, title: room.title, language: room.language,
    playerId: player.id, name: player.name, avatar: player.avatar, score: player.score, streak: player.streak,
    allowedTypes: room.allowedTypes,
  };

  if (room.phase === 'lobby' || room.phase === 'review') {
    if (!player.name || !player.avatar) {
      base.step = 'avatar';
      return base;
    }
    const q = player.submittedQuestionId ? getQuestion(room, player.submittedQuestionId) : null;
    if (!q || q.status === 'rejected') {
      base.step = 'write';
      base.rejected = !!(q && q.status === 'rejected');
      base.draft = q ? { type: q.type, text: q.text, durationSec: q.durationSec, options: q.options, correctIndex: q.correctIndex, tf: q.tf, answer: q.answer, num: q.num, unit: q.unit } : null;
      return base;
    }
    base.step = 'submitted';
    base.questionStatus = q.status; // pending | approved
    return base;
  }

  if (room.phase === 'play' && room.current) {
    const q = currentQuestion(room);
    const isUser = q.authorId === player.id;
    const stage = room.current.stage;
    const expected = expectedAnswerers(room);
    const answered = room.current.answers.size;
    const elapsed = Date.now() - room.current.startedAt;
    const timeLeft = Math.max(0, Math.ceil((room.current.durationMs - elapsed) / 1000));
    Object.assign(base, {
      step: 'play', stage, isUser, qNum: room.currentIndex + 1, qTotal: room.playOrder.length,
      qText: q.text, timeLeft, expected, answered, ...questionPlayData(room, q),
    });
    const mine = room.current.answers.get(player.id);
    if (stage === 'active') {
      base.hasAnswered = !!mine;
    }
    if (stage === 'reveal' || stage === 'scores') {
      const board = scoreBoard(room, room.current.prevRank);
      const mineRank = board.find((r) => r.id === player.id);
      base.rank = mineRank ? mineRank.rank : board.length;
      base.rankText = ordinal(base.rank, room.language);
    }
    if (stage === 'reveal') {
      if (isUser) {
        base.result = 'locked';
      } else if (mine) {
        base.result = mine.correct ? 'correct' : 'wrong';
        base.points = mine.points;
      } else {
        base.result = 'missed';
      }
      base.correctText = questionPlayData(room, q).correctText;
    }
    return base;
  }

  if (room.phase === 'podium') {
    const board = scoreBoard(room, {});
    const mineRank = board.find((r) => r.id === player.id);
    base.step = 'podium';
    base.rank = mineRank ? mineRank.rank : board.length;
    base.rankText = ordinal(base.rank, room.language);
    return base;
  }

  base.step = 'lobby';
  return base;
}

function broadcastTeacher(room) {
  const payload = teacherView(room);
  room.teacherSocketIds.forEach((sid) => io.to(sid).emit('teacher:state', payload));
}

function broadcastStudents(room) {
  room.players.forEach((p) => {
    if (p.connected && p.socketId) io.to(p.socketId).emit('student:state', studentView(room, p));
  });
}

function broadcastAll(room) {
  broadcastTeacher(room);
  broadcastStudents(room);
}

// ---------------------------------------------------------------------------
// Socket wiring

io.on('connection', (socket) => {
  socket.data.role = null;
  socket.data.code = null;
  socket.data.playerId = null;

  function requireTeacher(code, teacherToken) {
    const room = manager.get(code);
    if (!room) return { error: I18N.t(I18N.DEFAULT_LANG, 'err_quizNotFound') };
    if (room.teacherToken !== teacherToken) return { error: I18N.t(room.language, 'err_notAuthorized') };
    return { room };
  }

  // ---- teacher ----
  socket.on('teacher:create', ({ title, types, language } = {}, cb) => {
    const room = manager.create(title, types, language);
    room.teacherSocketIds.add(socket.id);
    socket.data.role = 'teacher';
    socket.data.code = room.code;
    socket.join(`room:${room.code}`);
    cb && cb({ ok: true, code: room.code, teacherToken: room.teacherToken });
    broadcastTeacher(room);
  });

  socket.on('teacher:rejoin', ({ code, teacherToken } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    room.teacherSocketIds.add(socket.id);
    socket.data.role = 'teacher';
    socket.data.code = code;
    socket.join(`room:${code}`);
    cb && cb({ ok: true });
    io.to(socket.id).emit('teacher:state', teacherView(room));
  });

  socket.on('teacher:openReview', ({ code, teacherToken } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    room.phase = 'review';
    cb && cb({ ok: true });
    broadcastAll(room);
  });

  socket.on('teacher:approve', ({ code, teacherToken, questionId } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    const q = getQuestion(room, questionId);
    if (!q) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_questionNotFound') });
    q.status = 'approved';
    cb && cb({ ok: true });
    broadcastAll(room);
  });

  socket.on('teacher:reject', ({ code, teacherToken, questionId } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    const q = getQuestion(room, questionId);
    if (!q) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_questionNotFound') });
    q.status = 'rejected';
    cb && cb({ ok: true });
    broadcastAll(room);
  });

  socket.on('teacher:start', ({ code, teacherToken } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    const approved = room.questions.filter((q) => q.status === 'approved');
    if (!approved.length) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_approveAtLeastOne') });
    room.playOrder = approved.map((q) => q.id);
    room.currentIndex = 0;
    room.phase = 'play';
    cb && cb({ ok: true });
    startQuestion(room);
  });

  socket.on('teacher:forceReveal', ({ code, teacherToken } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    revealQuestion(room);
    cb && cb({ ok: true });
  });

  socket.on('teacher:showScores', ({ code, teacherToken } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    if (!room.current || room.current.stage !== 'reveal') return cb && cb({ ok: false, error: I18N.t(room.language, 'err_notReady') });
    room.current.stage = 'scores';
    cb && cb({ ok: true });
    broadcastAll(room);
  });

  socket.on('teacher:next', ({ code, teacherToken } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    if (!room.current || room.current.stage !== 'scores') return cb && cb({ ok: false, error: I18N.t(room.language, 'err_notReady') });
    if (room.currentIndex + 1 < room.playOrder.length) {
      room.currentIndex += 1;
      cb && cb({ ok: true });
      startQuestion(room);
    } else {
      clearRoomTimer(room);
      room.phase = 'podium';
      room.current = null;
      cb && cb({ ok: true });
      broadcastAll(room);
    }
  });

  socket.on('teacher:endQuiz', ({ code, teacherToken } = {}, cb) => {
    const { room, error } = requireTeacher(code, teacherToken);
    if (error) return cb && cb({ ok: false, error });
    io.to(`room:${code}`).emit('quiz:ended');
    manager.delete(code);
    cb && cb({ ok: true });
  });

  // ---- student ----
  socket.on('student:join', ({ code, playerId } = {}, cb) => {
    const room = manager.get(code);
    if (!room) return cb && cb({ ok: false, error: I18N.t(I18N.DEFAULT_LANG, 'err_noQuizWithCode') });
    if (['play', 'podium'].includes(room.phase) && !room.players.has(playerId)) {
      return cb && cb({ ok: false, error: I18N.t(room.language, 'err_quizAlreadyStartedJoin') });
    }
    const id = playerId || newId('p');
    const player = manager.addOrGetPlayer(room, id);
    player.connected = true;
    player.socketId = socket.id;
    socket.data.role = 'student';
    socket.data.code = code;
    socket.data.playerId = id;
    socket.join(`room:${code}`);
    cb && cb({ ok: true, playerId: id, avatars: AVATARS, title: room.title });
    broadcastTeacher(room);
    io.to(socket.id).emit('student:state', studentView(room, player));
  });

  socket.on('student:setProfile', ({ code, playerId, name, avatar } = {}, cb) => {
    const room = manager.get(code);
    if (!room) return cb && cb({ ok: false, error: I18N.t(I18N.DEFAULT_LANG, 'err_quizNotFound') });
    const player = room.players.get(playerId);
    if (!player) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_rejoinFirst') });
    const cleanName = String(name || '').trim().slice(0, 24);
    if (!cleanName) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_enterNickname') });
    player.name = cleanName;
    player.avatar = AVATARS.includes(avatar) ? avatar : AVATARS[0];
    cb && cb({ ok: true });
    broadcastAll(room);
  });

  socket.on('student:submitQuestion', ({ code, playerId, question } = {}, cb) => {
    const room = manager.get(code);
    if (!room) return cb && cb({ ok: false, error: I18N.t(I18N.DEFAULT_LANG, 'err_quizNotFound') });
    const player = room.players.get(playerId);
    if (!player || !player.name) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_joinLobbyFirst') });
    if (room.phase === 'play' || room.phase === 'podium') {
      return cb && cb({ ok: false, error: I18N.t(room.language, 'err_quizAlreadyStarted') });
    }
    const { ok, question: clean, error } = sanitizeQuestion(question, room.allowedTypes, room.language);
    if (!ok) return cb && cb({ ok: false, error });

    let entry = player.submittedQuestionId ? getQuestion(room, player.submittedQuestionId) : null;
    if (entry && entry.status === 'approved') {
      return cb && cb({ ok: false, error: I18N.t(room.language, 'err_alreadyApproved') });
    }
    if (entry) {
      Object.assign(entry, clean, { status: 'pending' });
    } else {
      entry = { id: newId('q'), ...clean, authorId: player.id, authorName: player.name, authorAvatar: player.avatar, status: 'pending' };
      room.questions.push(entry);
      player.submittedQuestionId = entry.id;
    }
    cb && cb({ ok: true });
    broadcastAll(room);
  });

  socket.on('student:submitAnswer', ({ code, playerId, value } = {}, cb) => {
    const room = manager.get(code);
    if (!room) return cb && cb({ ok: false, error: I18N.t(I18N.DEFAULT_LANG, 'err_quizNotFound') });
    const player = room.players.get(playerId);
    if (!player) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_rejoinFirst') });
    if (room.phase !== 'play' || !room.current || room.current.stage !== 'active') {
      return cb && cb({ ok: false, error: I18N.t(room.language, 'err_noActiveQuestion') });
    }
    const q = currentQuestion(room);
    if (q.authorId === player.id) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_cantAnswerOwn') });
    if (room.current.answers.has(player.id)) return cb && cb({ ok: false, error: I18N.t(room.language, 'err_alreadyAnswered') });

    let rawValue = value;
    if (q.type === 'mc') rawValue = Number.isInteger(value) ? value : parseInt(value, 10);
    if (q.type === 'tf') rawValue = value === true || value === 'true';
    const correct = checkAnswer(q, q.type === 'guess' ? parseFloat(value) : rawValue);
    const elapsedMs = Date.now() - room.current.startedAt;
    const points = pointsFor(correct, elapsedMs, room.current.durationMs);
    player.score += points;
    player.streak = correct ? player.streak + 1 : 0;
    room.current.answers.set(player.id, { rawValue, correct, points, elapsedMs });
    cb && cb({ ok: true, correct, points });
    broadcastAll(room);
    maybeAutoReveal(room);
  });

  socket.on('disconnect', () => {
    const { role, code, playerId } = socket.data;
    const room = manager.get(code);
    if (!room) return;
    if (role === 'teacher') {
      room.teacherSocketIds.delete(socket.id);
    } else if (role === 'student') {
      const player = room.players.get(playerId);
      if (player && player.socketId === socket.id) {
        player.connected = false;
        player.socketId = null;
        broadcastTeacher(room);
        maybeAutoReveal(room);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Chnobli server listening on :${PORT}`);
});
