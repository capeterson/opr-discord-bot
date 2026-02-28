/**
 * Statistics computation from raw game data.
 * All functions accept an array of game objects where each game has a
 * nested `game_participants` array (as returned by the Supabase join query).
 */

/**
 * Compute all statistics from a list of games.
 * @param {object[]} games
 * @returns {object} stats object
 */
function computeStats(games) {
  const result = {
    totalGames:   0,
    total1v1:     0,
    total2v2:     0,
    playerWins:   {},  // discord_id -> wins
    playerGames:  {},  // discord_id -> total games
    playerNames:  {},  // discord_id -> display name
    factionWins:  {},  // faction -> wins
    factionGames: {},  // faction -> total appearances
    teamWins:     {},  // 'id1+id2' -> wins
    teamGames:    {},  // 'id1+id2' -> total games
    matchupStats: {},  // normalized matchup key -> { teams, team1Wins, team2Wins, total }
    systemStats:  {},  // game_system -> count
    recentGames:  [],  // last 5 games (newest first)
  };

  if (!games || games.length === 0) return result;

  result.totalGames = games.length;

  // Work newest-first for recentGames but iterate all for stats
  const sorted = [...games].sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
  result.recentGames = sorted.slice(0, 5);

  for (const game of games) {
    const participants = game.game_participants || [];

    // System counts
    result.systemStats[game.game_system] = (result.systemStats[game.game_system] || 0) + 1;

    if (game.game_type === '1v1') result.total1v1++;
    if (game.game_type === '2v2') result.total2v2++;

    const winners = participants.filter(p => p.won);
    const losers  = participants.filter(p => !p.won);

    // Per-player stats
    for (const p of participants) {
      result.playerNames[p.discord_id] = p.discord_name;
      result.playerGames[p.discord_id] = (result.playerGames[p.discord_id] || 0) + 1;
      if (p.won) {
        result.playerWins[p.discord_id] = (result.playerWins[p.discord_id] || 0) + 1;
      }
    }

    // Faction stats (count wins per faction)
    for (const p of participants) {
      result.factionGames[p.faction] = (result.factionGames[p.faction] || 0) + 1;
      if (p.won) {
        result.factionWins[p.faction] = (result.factionWins[p.faction] || 0) + 1;
      }
    }

    // Team & matchup stats — 2v2 only
    if (game.game_type === '2v2' && winners.length === 2 && losers.length === 2) {
      const winnerKey = winners.map(p => p.discord_id).sort().join('+');
      const loserKey  = losers.map(p => p.discord_id).sort().join('+');

      result.teamWins[winnerKey]  = (result.teamWins[winnerKey]  || 0) + 1;
      result.teamGames[winnerKey] = (result.teamGames[winnerKey] || 0) + 1;
      result.teamGames[loserKey]  = (result.teamGames[loserKey]  || 0) + 1;

      // Normalize matchup key so [A,B] vs [C,D] === [C,D] vs [A,B]
      const [normA, normB] = [winnerKey, loserKey].sort();
      const matchupKey = `${normA}|${normB}`;

      if (!result.matchupStats[matchupKey]) {
        result.matchupStats[matchupKey] = {
          teams:      [normA.split('+'), normB.split('+')],
          team1Wins:  0,
          team2Wins:  0,
          total:      0,
        };
      }
      result.matchupStats[matchupKey].total++;
      if (winnerKey === normA) {
        result.matchupStats[matchupKey].team1Wins++;
      } else {
        result.matchupStats[matchupKey].team2Wins++;
      }
    }
  }

  return result;
}

/** Return the top N entries from a { key: count } map, sorted descending. */
function topN(map, n = 3) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/** Win rate as a percentage string. */
function winRate(wins, total) {
  if (total === 0) return '0%';
  return `${Math.round((wins / total) * 100)}%`;
}

module.exports = { computeStats, topN, winRate };
