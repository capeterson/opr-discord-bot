'use strict';

const { randomBytes } = require('crypto');

/** @type {Map<string, object>} */
const sessions = new Map();

/** @type {Map<string, object>} Detail sessions for the "Add My Details" post-game flow. */
const detailSessions = new Map();

/** Purge expired sessions every 5 minutes. */
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of sessions) {
    if (state.expiresAt < now) sessions.delete(id);
  }
  for (const [key, state] of detailSessions) {
    if (state.expiresAt < now) detailSessions.delete(key);
  }
}, 5 * 60_000);

/** Generate a random 10-character hex session ID. */
function genId() {
  return randomBytes(5).toString('hex');
}

/**
 * Create a new form session.
 * @param {string}      userId
 * @param {string}      guildId
 * @param {string}      channelId
 * @param {object|null} rotationState - Row from rotation_state table
 * @param {Array}       allPlayers    - [{ discord_id, discord_name }]
 * @param {object}      [overrides]   - Optional fields to override defaults (used for Edit Report)
 * @returns {string} sessionId
 */
function createSession(userId, guildId, channelId, rotationState, allPlayers, overrides = {}) {
  const id = genId();
  sessions.set(id, {
    userId,
    guildId,
    channelId,
    gameType:        null,
    gameSystem:      null,
    armyPoints:      null,
    winner:          null,  // '1', '2', or 'tie'
    advanceRotation: true,
    overrideTeams:   false,
    team1:           [],    // discord_ids / guest UUIDs
    team2:           [],
    factions:        {},    // discord_id → faction string
    rotationState,
    allPlayers,
    step:            'setup',
    editGameId:      null,  // set to game UUID when editing an existing report
    expiresAt:       Date.now() + 30 * 60_000,
    ...overrides,
  });
  return id;
}

/** @returns {object|null} */
function getSession(id) {
  const s = sessions.get(id);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return s;
}

function updateSession(id, patch) {
  const s = sessions.get(id);
  if (!s) return;
  Object.assign(s, patch);
}

function deleteSession(id) {
  sessions.delete(id);
}

// ── Detail session helpers ────────────────────────────────────────────────────

/**
 * Create a temporary session for the "Add My Details" two-step flow.
 * @param {string} gameId
 * @param {string} userId
 * @param {string} gameSystem
 * @param {string|null} armyName
 * @param {string|null} armyForgeUrl
 * @param {string|null} playerNotes
 */
function createDetailSession(gameId, userId, gameSystem, armyName, armyForgeUrl, playerNotes) {
  const key = `${gameId}:${userId}`;
  detailSessions.set(key, {
    gameId, userId, gameSystem,
    armyName, armyForgeUrl, playerNotes,
    faction:     null,
    feeling:     null,
    expiresAt:   Date.now() + 30 * 60_000,
  });
}

/** @returns {object|null} */
function getDetailSession(gameId, userId) {
  const key = `${gameId}:${userId}`;
  const s = detailSessions.get(key);
  if (!s || s.expiresAt < Date.now()) {
    detailSessions.delete(key);
    return null;
  }
  return s;
}

function updateDetailSession(gameId, userId, patch) {
  const key = `${gameId}:${userId}`;
  const s = detailSessions.get(key);
  if (s) Object.assign(s, patch);
}

function deleteDetailSession(gameId, userId) {
  detailSessions.delete(`${gameId}:${userId}`);
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  createDetailSession,
  getDetailSession,
  updateDetailSession,
  deleteDetailSession,
};
