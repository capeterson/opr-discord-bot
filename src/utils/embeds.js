const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { computeStats, topN, winRate } = require('./stats');
const { getCurrentMatchup, formatMatchup, totalMatchups } = require('./rotation');

// Colour palette
const COLORS = {
  info:    0x5865F2,  // Discord blurple
  success: 0x57F287,  // Green
  error:   0xED4245,  // Red
  stats:   0x9B59B6,  // Purple
  gold:    0xF1C40F,  // Gold  (weekly reminder)
  warning: 0xFEE75C,  // Yellow
};

const GAME_SYSTEMS = {
  'Age of Fantasy':            'AoF',
  'Grimdark Future':           'GF',
  'Age of Fantasy: Skirmish':  'AoF Skirmish',
  'Grimdark Future: Firefight':'GF Firefight',
};

/** Format a Date for display (Discord timestamp or human readable). */
function formatDate(date) {
  const d = new Date(date);
  const ts = Math.floor(d.getTime() / 1000);
  return `<t:${ts}:F>`;  // Discord full date+time format
}

/** Format relative time. */
function formatRelative(date) {
  const ts = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${ts}:R>`;
}

/**
 * Format a single participant for display in the result embed.
 * Discord users are shown as mentions; guests as bold names.
 */
function formatParticipant(p) {
  const isDiscord = /^\d+$/.test(p.discord_id);
  const name      = isDiscord ? `<@${p.discord_id}>` : `**${p.discord_name}**`;
  const fac       = p.faction ? ` — ${p.faction}` : '';
  return `${name}${fac}`;
}

/**
 * Build the success embed shown after a game is reported.
 * @param {object}   game         - Row from the games table (may include is_tie)
 * @param {object[]} participants - Rows from game_participants
 * @param {Array|null} nextMatchup - [team1Ids, team2Ids] or null
 * @param {object}   [nameMap]    - Map of guest discord_id → display name for nextMatchup
 */
function buildReportEmbed(game, participants, nextMatchup, nameMap = {}) {
  const isTie  = game.is_tie === true;
  const system = GAME_SYSTEMS[game.game_system] || game.game_system;

  const embed = new EmbedBuilder()
    .setTitle(isTie ? '🤝 Game Result — Tie' : '✅ Game Result Recorded')
    .setColor(isTie ? COLORS.warning : COLORS.success)
    .setTimestamp();

  embed.addFields(
    { name: 'System',          value: system,                          inline: true },
    { name: 'Format',          value: game.game_type,                  inline: true },
    { name: 'Points / player', value: (game.army_points || 0).toString(), inline: true },
  );

  if (isTie) {
    const team1 = participants.filter(p => p.team === 1);
    const team2 = participants.filter(p => p.team === 2);
    if (game.game_type === '1v1') {
      embed.addFields({
        name:  '🤝 Tie',
        value: [...team1, ...team2].map(formatParticipant).join('\n'),
      });
    } else {
      embed.addFields(
        { name: '🤝 Tie — Team 1', value: team1.map(formatParticipant).join('\n') },
        { name: '🤝 Tie — Team 2', value: team2.map(formatParticipant).join('\n') },
      );
    }
  } else {
    const winners = participants.filter(p => p.won);
    const losers  = participants.filter(p => !p.won);

    if (game.game_type === '1v1') {
      const w = winners[0];
      const l = losers[0];
      if (w) embed.addFields({ name: '🏆 Winner', value: formatParticipant(w) });
      if (l) embed.addFields({ name: '💀 Loser',  value: formatParticipant(l) });
    } else {
      embed.addFields(
        { name: '🏆 Winning Team', value: winners.map(formatParticipant).join('\n') || '—' },
        { name: '💀 Losing Team',  value: losers.map(formatParticipant).join('\n')  || '—' },
      );
    }
  }

  if (nextMatchup) {
    const [t1, t2] = nextMatchup;
    embed.addFields({
      name:  "⚔️ Next Week's Matchup",
      value: formatMatchup(t1, t2, nameMap),
    });
  }

  embed.setFooter({ text: 'Use /opr stats to view full statistics • Click "Add My Details" to add army info' });
  return embed;
}

/**
 * Build the persistent action row attached to every public game result embed.
 * @param {string} gameId - UUID of the game
 * @returns {ActionRowBuilder}
 */
function buildReportActionRow(gameId) {
  const addBtn = new ButtonBuilder()
    .setCustomId(`report:add:${gameId}`)
    .setLabel('📝 Add My Details')
    .setStyle(ButtonStyle.Primary);

  const editBtn = new ButtonBuilder()
    .setCustomId(`report:edit:${gameId}`)
    .setLabel('🔧 Edit Report')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(addBtn, editBtn);
}

/** Build the full statistics embed. */
function buildStatsEmbed(games, title = '📊 One Page Rules — Statistics') {
  const stats = computeStats(games);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.stats)
    .setTimestamp()
    .setFooter({ text: 'All-time statistics' });

  if (stats.totalGames === 0) {
    embed.setDescription('No games have been recorded yet.\nUse `/report` after your first game!');
    return embed;
  }

  // Overview
  const systemBreakdown = Object.entries(stats.systemStats)
    .map(([sys, count]) => `${GAME_SYSTEMS[sys] || sys}: ${count}`)
    .join(' · ');
  embed.addFields({
    name: '🎲 Games Played',
    value: `**${stats.totalGames}** total (${systemBreakdown})\n1v1: ${stats.total1v1} · 2v2: ${stats.total2v2}`,
  });

  // Top players
  const topPlayers = topN(stats.playerWins, 5);
  if (topPlayers.length > 0) {
    const lines = topPlayers.map(([id, wins], i) => {
      const games = stats.playerGames[id] || 0;
      const name  = stats.playerNames[id] || `<@${id}>`;
      const wr    = winRate(wins, games);
      const medal = ['🥇','🥈','🥉'][i] || '▪️';
      return `${medal} <@${id}> — **${wins}W** / ${games - wins}L (${wr})`;
    });
    embed.addFields({ name: '🏆 Player Leaderboard', value: lines.join('\n') });
  }

  // Top factions
  const topFactions = topN(stats.factionWins, 5);
  if (topFactions.length > 0) {
    const lines = topFactions.map(([faction, wins]) => {
      const played = stats.factionGames[faction] || 0;
      const wr     = winRate(wins, played);
      return `▪️ **${faction}** — ${wins}W / ${played - wins}L (${wr})`;
    });
    embed.addFields({ name: '🛡️ Top Factions (by wins)', value: lines.join('\n') });
  }

  // Top 2v2 teams
  const topTeams = topN(stats.teamWins, 5);
  if (topTeams.length > 0) {
    const lines = topTeams.map(([key, wins]) => {
      const played = stats.teamGames[key] || 0;
      const ids    = key.split('+');
      const names  = ids.map(id => `<@${id}>`).join(' & ');
      const wr     = winRate(wins, played);
      return `▪️ ${names} — **${wins}W** / ${played - wins}L (${wr})`;
    });
    embed.addFields({ name: '👥 Top 2v2 Teams', value: lines.join('\n') });
  }

  // Matchup win rates
  const matchups = Object.values(stats.matchupStats);
  if (matchups.length > 0) {
    const lines = matchups
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map(m => {
        const [t1Ids, t2Ids] = m.teams;
        const t1 = t1Ids.map(id => `<@${id}>`).join(' & ');
        const t2 = t2Ids.map(id => `<@${id}>`).join(' & ');
        const wr1 = winRate(m.team1Wins, m.total);
        const wr2 = winRate(m.team2Wins, m.total);
        return `▪️ ${t1} vs ${t2}\n  └ ${wr1} / ${wr2} (${m.total} games)`;
      });
    embed.addFields({ name: '📈 Matchup Win Rates', value: lines.join('\n') });
  }

  // Recent games
  if (stats.recentGames.length > 0) {
    const lines = stats.recentGames.map(g => {
      const participants = g.game_participants || [];
      const winners = participants.filter(p => p.won).map(p => `<@${p.discord_id}>`).join(' & ');
      const sys = GAME_SYSTEMS[g.game_system] || g.game_system;
      const ts  = Math.floor(new Date(g.game_date).getTime() / 1000);
      return `▪️ <t:${ts}:d> [${sys} ${g.game_type}] 🏆 ${winners}`;
    });
    embed.addFields({ name: '🕐 Recent Results', value: lines.join('\n') });
  }

  return embed;
}

/** Build the weekly reminder embed. */
function buildWeeklyReminderEmbed(games, nextScheduled, rotationState) {
  const stats = computeStats(games);

  const embed = new EmbedBuilder()
    .setTitle('🎲 One Page Rules — Weekly Reminder')
    .setColor(COLORS.gold)
    .setTimestamp()
    .setFooter({ text: 'Report results with /report · Full stats with /stats' });

  // Next game
  if (nextScheduled) {
    const typeLabel = nextScheduled.game_type === '2v2' ? '2v2 Co-op' : '1v1';
    const note = nextScheduled.note ? `\n📝 ${nextScheduled.note}` : '';
    embed.addFields({
      name: '📅 Next Scheduled Game',
      value: `${formatDate(nextScheduled.game_date)} (${formatRelative(nextScheduled.game_date)})\nFormat: **${typeLabel}**${note}`,
    });
  } else {
    embed.addFields({
      name: '📅 Next Scheduled Game',
      value: '_Not yet scheduled — use `/schedule set` to add one._',
    });
  }

  // Team rotation (only if 2v2 is relevant)
  if (rotationState) {
    const matchup = getCurrentMatchup(rotationState);
    if (matchup) {
      const [t1, t2] = matchup;
      const total = totalMatchups(rotationState.player_discord_ids);
      const idx   = (rotationState.current_index % total) + 1;
      embed.addFields({
        name: `⚔️ This Week's Matchup (Rotation ${idx}/${total})`,
        value: formatMatchup(t1, t2),
      });
    }
  }

  // Stats summary
  if (stats.totalGames === 0) {
    embed.addFields({ name: '📊 Statistics', value: '_No games recorded yet. Get playing!_' });
    return embed;
  }

  embed.addFields({
    name: '📊 Quick Stats',
    value: `**${stats.totalGames}** games recorded · 1v1: ${stats.total1v1} · 2v2: ${stats.total2v2}`,
  });

  // Top player
  const topPlayers = topN(stats.playerWins, 1);
  if (topPlayers.length > 0) {
    const [id, wins] = topPlayers[0];
    const played = stats.playerGames[id] || 0;
    embed.addFields({
      name: '🏆 Most Wins',
      value: `<@${id}> — **${wins}** wins (${winRate(wins, played)} win rate)`,
      inline: true,
    });
  }

  // Top faction
  const topFactions = topN(stats.factionWins, 1);
  if (topFactions.length > 0) {
    const [faction, wins] = topFactions[0];
    embed.addFields({
      name: '🛡️ Dominant Faction',
      value: `**${faction}** — ${wins} wins`,
      inline: true,
    });
  }

  // Top team (2v2)
  const topTeams = topN(stats.teamWins, 1);
  if (topTeams.length > 0) {
    const [key, wins] = topTeams[0];
    const played = stats.teamGames[key] || 0;
    const names  = key.split('+').map(id => `<@${id}>`).join(' & ');
    embed.addFields({
      name: '👥 Best Team',
      value: `${names}\n${wins}W / ${played - wins}L (${winRate(wins, played)})`,
      inline: true,
    });
  }

  // All matchup win rates
  const matchups = Object.values(stats.matchupStats);
  if (matchups.length > 0) {
    const lines = matchups
      .sort((a, b) => b.total - a.total)
      .map(m => {
        const [t1Ids, t2Ids] = m.teams;
        const t1 = t1Ids.map(id => `<@${id}>`).join(' & ');
        const t2 = t2Ids.map(id => `<@${id}>`).join(' & ');
        const wr1 = winRate(m.team1Wins, m.total);
        const wr2 = winRate(m.team2Wins, m.total);
        return `▪️ ${t1} vs ${t2}: **${wr1}** / ${wr2} (${m.total}G)`;
      });
    embed.addFields({ name: '📈 Team Matchup Win Rates', value: lines.join('\n') });
  }

  return embed;
}

/** Simple error embed. */
function buildErrorEmbed(message) {
  return new EmbedBuilder()
    .setTitle('❌ Error')
    .setDescription(message)
    .setColor(COLORS.error);
}

/** Simple info/success embed. */
function buildInfoEmbed(title, description, color = COLORS.info) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

module.exports = {
  COLORS,
  GAME_SYSTEMS,
  buildReportEmbed,
  buildReportActionRow,
  buildStatsEmbed,
  buildWeeklyReminderEmbed,
  buildErrorEmbed,
  buildInfoEmbed,
  formatDate,
  formatRelative,
};
