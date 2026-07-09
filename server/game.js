// Pure game-logic helpers: no socket/IO awareness, easy to unit test.
'use strict';

const crypto = require('crypto');
const I18N = require('../public/js/i18n.js');
const { AVATARS } = require('../public/js/avatars.js');

const QUESTION_TYPES = ['mc', 'tf', 'short', 'guess'];
// Authors pick their question's time limit from exactly these four stops.
const DURATION_OPTIONS_SEC = [10, 20, 30, 40];
const DEFAULT_DURATION_SEC = 20;
const BASE_POINTS = 700;
const SPEED_BONUS = 300;

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function randomCode(existingCodes) {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (existingCodes.has(code));
  return code;
}

function randomToken() {
  return crypto.randomBytes(16).toString('hex');
}

/** German just uses "1.", "2.", …; English keeps the st/nd/rd/th suffixes. */
function ordinal(n, lang) {
  if (I18N.normLang(lang) === 'de') return `${n}.`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Validate + normalize a student-authored question. Returns {ok, question, error}. */
function sanitizeQuestion(raw, allowedTypes, lang) {
  const err = (key) => ({ ok: false, error: I18N.t(lang, key) });
  if (!raw || typeof raw !== 'object') return err('err_noQuestionData');
  const type = raw.type;
  if (!QUESTION_TYPES.includes(type)) return err('err_unknownType');
  if (allowedTypes && !allowedTypes.includes(type)) return err('err_typeNotEnabled');
  const text = String(raw.text || '').trim().slice(0, 240);
  if (!text) return err('err_writeQuestionFirst');
  const durationSec = DURATION_OPTIONS_SEC.includes(parseInt(raw.durationSec, 10))
    ? parseInt(raw.durationSec, 10)
    : DEFAULT_DURATION_SEC;

  if (type === 'mc') {
    const options = (Array.isArray(raw.options) ? raw.options : [])
      .map((o) => String(o || '').trim().slice(0, 80))
      .slice(0, 4);
    while (options.length < 4) options.push('');
    const filled = options.filter((o) => o.length > 0);
    if (filled.length < 2) return err('err_needTwoOptions');
    let correctIndex = Number.isInteger(raw.correctIndex) ? raw.correctIndex : 0;
    if (correctIndex < 0 || correctIndex >= options.length || !options[correctIndex]) {
      correctIndex = options.findIndex((o) => o.length > 0);
    }
    return { ok: true, question: { type, text, durationSec, options, correctIndex } };
  }
  if (type === 'tf') {
    const tf = !!raw.tf;
    return { ok: true, question: { type, text, durationSec, tf } };
  }
  if (type === 'short') {
    const answer = String(raw.answer || '').trim().slice(0, 80);
    if (!answer) return err('err_addAcceptedAnswer');
    return { ok: true, question: { type, text, durationSec, answer } };
  }
  if (type === 'guess') {
    const num = parseFloat(raw.num);
    if (!Number.isFinite(num)) return err('err_addCorrectNumber');
    const unit = String(raw.unit || '').trim().slice(0, 24);
    return { ok: true, question: { type, text, durationSec, num, unit } };
  }
  return err('err_unknownType');
}

/** Check whether a submitted answer value is correct for a question. */
function checkAnswer(question, value) {
  switch (question.type) {
    case 'mc':
      return Number.isInteger(value) && value === question.correctIndex;
    case 'tf':
      return typeof value === 'boolean' && value === question.tf;
    case 'guess': {
      const v = parseFloat(value);
      if (!Number.isFinite(v)) return false;
      const tolerance = Math.max(1, Math.abs(question.num) * 0.05);
      return Math.abs(v - question.num) <= tolerance;
    }
    case 'short': {
      const v = String(value || '').trim().toLowerCase();
      return !!v && v === String(question.answer).trim().toLowerCase();
    }
    default:
      return false;
  }
}

/** Points for a correct answer given elapsed time (ms) out of total duration (ms). */
function pointsFor(correct, elapsedMs, durationMs) {
  if (!correct) return 0;
  const clamped = Math.max(0, Math.min(durationMs, elapsedMs));
  const remainingFrac = 1 - clamped / durationMs;
  return Math.round(BASE_POINTS + SPEED_BONUS * remainingFrac);
}

function rankMap(scoresByPlayerId) {
  const ids = Object.keys(scoresByPlayerId).sort((a, b) => scoresByPlayerId[b] - scoresByPlayerId[a]);
  const map = {};
  ids.forEach((id, i) => { map[id] = i + 1; });
  return map;
}

module.exports = {
  QUESTION_TYPES, AVATARS, DURATION_OPTIONS_SEC, DEFAULT_DURATION_SEC, BASE_POINTS, SPEED_BONUS,
  newId, randomCode, randomToken, ordinal, sanitizeQuestion, checkAnswer, pointsFor, rankMap,
};
