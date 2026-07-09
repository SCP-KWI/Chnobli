// In-memory room store. One process = one classroom's worth of live quizzes.
// Ephemeral by design (like a live game show, not a database app): state lives
// only for the lifetime of the server process.
'use strict';

const { randomCode, randomToken, newId, QUESTION_TYPES } = require('./game');
const I18N = require('../public/js/i18n.js');

const STALE_MS = 1000 * 60 * 60 * 4; // rooms older than 4h auto-swept

class RoomManager {
  constructor() {
    /** @type {Map<string, object>} */
    this.rooms = new Map();
    setInterval(() => this.sweep(), 1000 * 60 * 15).unref();
  }

  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.createdAt > STALE_MS) this.rooms.delete(code);
    }
  }

  create(title, allowedTypes, language) {
    const code = randomCode(this.rooms);
    const lang = I18N.normLang(language);
    const types = (Array.isArray(allowedTypes) ? allowedTypes : QUESTION_TYPES)
      .filter((t) => QUESTION_TYPES.includes(t));
    const defaultTitle = I18N.t(lang, 'defaultQuizTitle');
    const room = {
      code,
      title: String(title || defaultTitle).trim().slice(0, 80) || defaultTitle,
      language: lang,
      allowedTypes: types.length ? types : QUESTION_TYPES.slice(),
      teacherToken: randomToken(),
      teacherSocketIds: new Set(),
      createdAt: Date.now(),
      phase: 'lobby', // lobby -> review -> play -> podium -> ended
      players: new Map(), // playerId -> player
      questions: [], // {id, ...sanitized, authorId, authorName, authorAvatar, status}
      playOrder: [], // question ids, in play order
      currentIndex: -1,
      current: null, // { stage: active|reveal|scores, startedAt, answers: Map<playerId, {value,correct,points,elapsedMs}> , prevRank }
      timer: null,
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(String(code || '').trim());
  }

  delete(code) {
    const room = this.rooms.get(code);
    if (room && room.timer) clearInterval(room.timer);
    this.rooms.delete(code);
  }

  addOrGetPlayer(room, playerId) {
    let player = room.players.get(playerId);
    if (!player) {
      player = {
        id: playerId,
        name: '',
        avatar: '',
        connected: true,
        socketId: null,
        score: 0,
        streak: 0,
        joinedAt: Date.now(),
        submittedQuestionId: null,
      };
      room.players.set(playerId, player);
    }
    return player;
  }
}

module.exports = { RoomManager, newId };
