'use strict';

const { randomBytes } = require('crypto');

/** @type {Map<string, object>} */
const sessions = new Map();

/** Purge expired sessions every 5 minutes. */
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of sessions) {
    if (state.expiresAt < now) sessions.delete(id);
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

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
};
