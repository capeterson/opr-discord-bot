/**
 * Team rotation utilities for 2v2 matchup scheduling.
 *
 * Algorithm: fix the first player on Team 1 across all rotations, then
 * enumerate every way to choose (teamSize - 1) additional players from
 * the rest.  This produces exactly C(n-1, n/2-1) unique matchups with
 * no duplicates (e.g. [A,B] vs [C,D] never appears as [C,D] vs [A,B]).
 */

/**
 * Generate all unique 2v2 matchups for the given ordered player list.
 * @param {string[]} players - Discord IDs in rotation order
 * @returns {[string[], string[]][]} Array of [team1Ids, team2Ids]
 */
function generateRotations(players) {
  if (!players || players.length < 4 || players.length % 2 !== 0) {
    return [];
  }

  const teamSize = players.length / 2;
  const rotations = [];
  const rest = players.slice(1);

  function combine(start, current) {
    if (current.length === teamSize - 1) {
      const team1 = [players[0], ...current];
      const team2 = players.filter(p => !team1.includes(p));
      rotations.push([team1, team2]);
      return;
    }
    for (let i = start; i < rest.length; i++) {
      combine(i + 1, [...current, rest[i]]);
    }
  }

  combine(0, []);
  return rotations;
}

/**
 * Return the matchups in the custom order defined by `matchup_order`, or
 * in the natural generated order if no custom order is set.
 * @param {object} rotationState - Row from the rotation_state table
 * @returns {[string[], string[]][]}
 */
function getOrderedMatchups(rotationState) {
  const rotations = generateRotations(rotationState.player_discord_ids);
  const { matchup_order } = rotationState;
  if (!matchup_order || matchup_order.length === 0) return rotations;
  return matchup_order.map(i => rotations[i]);
}

/**
 * Return the [team1, team2] matchup for the current rotation index.
 * @param {object} rotationState - Row from the rotation_state table
 * @returns {[string[], string[]] | null}
 */
function getCurrentMatchup(rotationState) {
  const ordered = getOrderedMatchups(rotationState);
  if (ordered.length === 0) return null;
  return ordered[rotationState.current_index % ordered.length];
}

/**
 * Return the [team1, team2] matchup that will follow the current one.
 * @param {object} rotationState - Row from the rotation_state table
 * @returns {[string[], string[]] | null}
 */
function getNextMatchup(rotationState) {
  const ordered = getOrderedMatchups(rotationState);
  if (ordered.length === 0) return null;
  return ordered[(rotationState.current_index + 1) % ordered.length];
}

/**
 * Return up to `count` upcoming matchups starting from the current position.
 * Each entry includes the matchup and its 1-based position number in the sequence.
 * @param {object} rotationState - Row from the rotation_state table
 * @param {number} count - Number of matchups to return (default 4)
 * @returns {Array<{ matchup: [string[], string[]], position: number }>}
 */
function getPreviewMatchups(rotationState, count = 4) {
  const ordered = getOrderedMatchups(rotationState);
  if (ordered.length === 0) return [];
  const total = ordered.length;
  const result = [];
  for (let i = 0; i < count; i++) {
    const pos = (rotationState.current_index + i) % total;
    result.push({ matchup: ordered[pos], position: pos + 1 });
  }
  return result;
}

/**
 * Return the total number of unique matchups for the current player list.
 */
function totalMatchups(players) {
  return generateRotations(players).length;
}

/**
 * Format a matchup as a readable string.
 * Discord users are shown as mentions; guest players (non-numeric IDs) use nameMap.
 * @param {string[]} team1Ids
 * @param {string[]} team2Ids
 * @param {Object} [nameMap] - Map of guest discord_id -> display name
 */
function formatMatchup(team1Ids, team2Ids, nameMap = {}) {
  const fmt = id => /^\d+$/.test(id) ? `<@${id}>` : (nameMap[id] || id);
  const t1 = team1Ids.map(fmt).join(' & ');
  const t2 = team2Ids.map(fmt).join(' & ');
  return `**Team 1:** ${t1}\n**Team 2:** ${t2}`;
}

module.exports = {
  generateRotations,
  getOrderedMatchups,
  getCurrentMatchup,
  getNextMatchup,
  getPreviewMatchups,
  totalMatchups,
  formatMatchup,
};
