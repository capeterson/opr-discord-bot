'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { GAME_SYSTEMS, COLORS } = require('../utils/embeds');
const { getCurrentMatchup, formatMatchup } = require('../utils/rotation');

// ── Faction lists ─────────────────────────────────────────────────────────────

const FACTIONS_AOF = [
  'Amazon Sisterhood', 'Ancestral Dwarves', 'Beastmen Ambushers', 'Custodian Brotherhood',
  'Dark Elven Raiders', 'Disciples of Plague', 'Dwarven Guilds', 'Eternal Dynasty',
  'Eternal Void', 'Goblin Pillagers', 'Halfling Militia', 'High Elf Kingdoms',
  'Kingdom of Men', 'Orc Marauders', 'Ratmen Clans', 'Sylvan Elves',
  'Undead Legions', 'Vampire Covens', 'Other',
];

const FACTIONS_GDF = [
  'Battle Brothers', 'Battle Sisters', 'Alien Hives', 'TAO Colony',
  'Robot Legions', 'Havoc Brothers', 'Infected', 'Orc Marauders',
  'Elven Jesters', 'Sector Rangers', 'Machine Cult', 'Dino Warriors',
  'Jackals', 'Titan Legions', 'Custodian Brothers', 'Gene Warriors',
  'Dwarf Guilds', 'Ratmen Clans', 'Imperial Guard', 'Squat Clans',
  'Chaos Daemons', 'Other',
];

const GAME_FEELINGS = [
  { label: '🎉 Amazing',      value: 'amazing' },
  { label: '😊 Fun',          value: 'fun' },
  { label: '😐 OK',           value: 'ok' },
  { label: '😤 Frustrating',  value: 'frustrating' },
  { label: '🎲 Lucky',        value: 'lucky' },
  { label: '💥 Intense',      value: 'intense' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFactions(gameSystem) {
  if (gameSystem && (gameSystem.includes('Grimdark') || gameSystem.includes('Firefight'))) {
    return FACTIONS_GDF;
  }
  return FACTIONS_AOF;
}

function factionsToOptions(factions) {
  return factions.map(f => ({ label: f, value: f }));
}

function isDiscordUser(id) {
  return /^\d+$/.test(id);
}

function playerLabel(player) {
  return isDiscordUser(player.discord_id) ? player.discord_name : `${player.discord_name} (guest)`;
}

function playerName(allPlayers, id) {
  const p = allPlayers.find(pl => pl.discord_id === id);
  if (!p) return id;
  return isDiscordUser(id) ? p.discord_name : `${p.discord_name} (guest)`;
}

function ptsButtonLabel(pts) {
  if (pts === null || pts === undefined) return '🎯 Set Army Points';
  return `🎯 ${pts} pts ✓`;
}

function rotButtonLabel(adv) {
  return adv ? '☑️ Advance Rotation' : '⬜ Advance Rotation';
}

/** Truncate allPlayers to 25 (Discord limit) and warn if needed. */
function truncatePlayers(allPlayers) {
  return { players: allPlayers.slice(0, 25), truncated: allPlayers.length > 25 };
}

// ── Readiness checks ──────────────────────────────────────────────────────────

function is1v1Ready(state) {
  const { team1, team2, factions, armyPoints } = state;
  const winnerId = team1[0];
  const loserId  = team2[0];
  if (!winnerId || !loserId || winnerId === loserId) return false;
  if (!armyPoints) return false;
  if (!factions[winnerId] || !factions[loserId]) return false;
  return true;
}

function is2v2Ready(state) {
  const { winner, team1, team2, factions, armyPoints } = state;
  if (team1.length !== 2 || team2.length !== 2) return false;
  if (!winner) return false;
  if (!armyPoints) return false;
  for (const id of [...team1, ...team2]) {
    if (!factions[id]) return false;
  }
  return true;
}

// ── Step builders ─────────────────────────────────────────────────────────────

/**
 * Initial setup step: select game type and system.
 * Auto-transitions to the player/team step once both are chosen.
 */
function buildSetupStep(state, sid) {
  const { rotationState, allPlayers, gameType, gameSystem } = state;

  const embed = new EmbedBuilder()
    .setTitle('📋 Report a Game')
    .setColor(COLORS.info)
    .setDescription('Select the game type and system — the form will update automatically.');

  if (rotationState && rotationState.player_discord_ids.length >= 4) {
    const matchup = getCurrentMatchup(rotationState);
    if (matchup) {
      const nameMap = {};
      for (const p of allPlayers) {
        if (!isDiscordUser(p.discord_id)) nameMap[p.discord_id] = p.discord_name;
      }
      embed.addFields({
        name: '⚔️ Current Rotation Matchup',
        value: formatMatchup(matchup[0], matchup[1], nameMap),
      });
    }
  }

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:type:${sid}`)
    .setPlaceholder('Select game type…')
    .addOptions([
      { label: '1v1', value: '1v1', description: 'One vs One',      default: gameType === '1v1' },
      { label: '2v2', value: '2v2', description: 'Two vs Two co-op', default: gameType === '2v2' },
    ]);

  const sysSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:sys:${sid}`)
    .setPlaceholder('Select game system…')
    .addOptions(
      Object.keys(GAME_SYSTEMS).map(name => ({
        label: name,
        value: name,
        description: GAME_SYSTEMS[name],
        default: gameSystem === name,
      }))
    );

  return {
    embeds:     [embed],
    components: [
      new ActionRowBuilder().addComponents(typeSelect),
      new ActionRowBuilder().addComponents(sysSelect),
    ],
  };
}

/**
 * 1v1 form: winner, loser, their factions, points button, and submit.
 * All in one step (5 action rows).
 */
function build1v1Form(state, sid) {
  const { allPlayers, gameSystem, armyPoints, factions } = state;
  const winnerId = state.team1[0] || null;
  const loserId  = state.team2[0] || null;
  const ready    = is1v1Ready(state);

  const sysName = GAME_SYSTEMS[gameSystem] || gameSystem;
  const embed = new EmbedBuilder()
    .setTitle('📋 Report a 1v1 Game')
    .setColor(COLORS.info)
    .setDescription(`**System:** ${sysName}\nSelect winner, loser, and their factions.`);

  const { players: playerPool, truncated } = truncatePlayers(allPlayers);
  if (truncated) {
    embed.addFields({ name: '⚠️ Note', value: 'Only the 25 most recently registered players are shown.' });
  }

  const makePlayerOpts = (defaultId) =>
    playerPool.map(p => ({
      label:   playerLabel(p),
      value:   p.discord_id,
      description: isDiscordUser(p.discord_id) ? 'Discord user' : 'Guest player',
      default: p.discord_id === defaultId,
    }));

  const factionOptions = factionsToOptions(getFactions(gameSystem));
  const makeFacOpts = (selectedFac) =>
    factionOptions.map(o => ({ ...o, default: o.value === selectedFac }));

  const winnerSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:winner:${sid}`)
    .setPlaceholder('Select winner…')
    .addOptions(makePlayerOpts(winnerId));

  const loserSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:loser:${sid}`)
    .setPlaceholder('Select loser…')
    .addOptions(makePlayerOpts(loserId));

  const wFacLabel = winnerId ? `${playerName(allPlayers, winnerId)} faction` : 'Winner faction';
  const lFacLabel = loserId  ? `${playerName(allPlayers, loserId)} faction`  : 'Loser faction';

  const wFacSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:wfac:${sid}`)
    .setPlaceholder(`${wFacLabel}…`)
    .addOptions(makeFacOpts(winnerId ? factions[winnerId] : null));

  const lFacSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:lfac:${sid}`)
    .setPlaceholder(`${lFacLabel}…`)
    .addOptions(makeFacOpts(loserId ? factions[loserId] : null));

  const ptsBtn = new ButtonBuilder()
    .setCustomId(`rpt:pts:${sid}`)
    .setLabel(ptsButtonLabel(armyPoints))
    .setStyle(armyPoints ? ButtonStyle.Success : ButtonStyle.Secondary);

  const submitBtn = new ButtonBuilder()
    .setCustomId(`rpt:sub:${sid}`)
    .setLabel('Submit Report')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!ready);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(winnerSelect),
      new ActionRowBuilder().addComponents(loserSelect),
      new ActionRowBuilder().addComponents(wFacSelect),
      new ActionRowBuilder().addComponents(lFacSelect),
      new ActionRowBuilder().addComponents(ptsBtn, submitBtn),
    ],
  };
}

/**
 * 2v2 teams step: shows current rotation matchup, winning team select, and action buttons.
 * Displayed when rotation teams are pre-populated from the rotation.
 */
function build2v2TeamsStep(state, sid) {
  const { allPlayers, gameSystem, armyPoints, advanceRotation, winner } = state;
  const t1 = state.team1;
  const t2 = state.team2;

  const sysName = GAME_SYSTEMS[gameSystem] || gameSystem;

  const nameMap = {};
  for (const p of allPlayers) {
    if (!isDiscordUser(p.discord_id)) nameMap[p.discord_id] = p.discord_name;
  }

  const formatTeamMember = id =>
    isDiscordUser(id) ? `<@${id}>` : `**${nameMap[id] || id}**`;

  const t1Display = t1.map(formatTeamMember).join(' & ') || '—';
  const t2Display = t2.map(formatTeamMember).join(' & ') || '—';

  // Plain names for the select option labels
  const t1Names = t1.map(id => playerName(allPlayers, id)).join(' & ') || 'Team 1';
  const t2Names = t2.map(id => playerName(allPlayers, id)).join(' & ') || 'Team 2';

  const embed = new EmbedBuilder()
    .setTitle('📋 Report a 2v2 Game')
    .setColor(COLORS.info)
    .setDescription(`**System:** ${sysName}`)
    .addFields(
      { name: '👥 Team 1', value: t1Display, inline: true },
      { name: '👥 Team 2', value: t2Display, inline: true },
    );

  const winnerSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:winner:${sid}`)
    .setPlaceholder('Select winning team…')
    .addOptions([
      { label: `Team 1 (${t1Names})`, value: '1',   description: 'Team 1 wins', default: winner === '1' },
      { label: `Team 2 (${t2Names})`, value: '2',   description: 'Team 2 wins', default: winner === '2' },
      { label: 'Tie',                  value: 'tie', description: 'It was a tie', default: winner === 'tie' },
    ]);

  const ptsBtn = new ButtonBuilder()
    .setCustomId(`rpt:pts:${sid}`)
    .setLabel(ptsButtonLabel(armyPoints))
    .setStyle(armyPoints ? ButtonStyle.Success : ButtonStyle.Secondary);

  const overrideBtn = new ButtonBuilder()
    .setCustomId(`rpt:ovr:${sid}`)
    .setLabel('🔄 Override Teams')
    .setStyle(ButtonStyle.Secondary);

  const rotBtn = new ButtonBuilder()
    .setCustomId(`rpt:rot:${sid}`)
    .setLabel(rotButtonLabel(advanceRotation))
    .setStyle(advanceRotation ? ButtonStyle.Success : ButtonStyle.Secondary);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`rpt:factions:${sid}`)
    .setLabel('Next: Select Factions →')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!winner);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(winnerSelect),
      new ActionRowBuilder().addComponents(ptsBtn, overrideBtn, rotBtn, nextBtn),
    ],
  };
}

/**
 * 2v2 override step: manually select team compositions and the winning team.
 */
function build2v2OverrideStep(state, sid) {
  const { allPlayers, gameSystem, armyPoints, advanceRotation, winner } = state;
  const t1 = state.team1;
  const t2 = state.team2;

  const sysName = GAME_SYSTEMS[gameSystem] || gameSystem;
  const embed = new EmbedBuilder()
    .setTitle('📋 Report a 2v2 Game — Select Teams')
    .setColor(COLORS.info)
    .setDescription(`**System:** ${sysName}\nSelect exactly 2 players per team.`);

  const { players: playerPool, truncated } = truncatePlayers(allPlayers);
  if (truncated) {
    embed.addFields({ name: '⚠️ Note', value: 'Only the 25 most recently registered players are shown.' });
  }

  const makeTeamOpts = (selected) =>
    playerPool.map(p => ({
      label:       playerLabel(p),
      value:       p.discord_id,
      description: isDiscordUser(p.discord_id) ? 'Discord user' : 'Guest',
      default:     selected.includes(p.discord_id),
    }));

  const t1Select = new StringSelectMenuBuilder()
    .setCustomId(`rpt:t1:${sid}`)
    .setPlaceholder('Team 1 — select 2 players…')
    .setMinValues(2)
    .setMaxValues(2)
    .addOptions(makeTeamOpts(t1));

  const t2Select = new StringSelectMenuBuilder()
    .setCustomId(`rpt:t2:${sid}`)
    .setPlaceholder('Team 2 — select 2 players…')
    .setMinValues(2)
    .setMaxValues(2)
    .addOptions(makeTeamOpts(t2));

  const winnerSelect = new StringSelectMenuBuilder()
    .setCustomId(`rpt:winner:${sid}`)
    .setPlaceholder('Select winning team…')
    .addOptions([
      { label: 'Team 1 wins', value: '1',   default: winner === '1' },
      { label: 'Team 2 wins', value: '2',   default: winner === '2' },
      { label: 'Tie',          value: 'tie', default: winner === 'tie' },
    ]);

  const ptsBtn = new ButtonBuilder()
    .setCustomId(`rpt:pts:${sid}`)
    .setLabel(ptsButtonLabel(armyPoints))
    .setStyle(armyPoints ? ButtonStyle.Success : ButtonStyle.Secondary);

  const rotBtn = new ButtonBuilder()
    .setCustomId(`rpt:rot:${sid}`)
    .setLabel(rotButtonLabel(advanceRotation))
    .setStyle(advanceRotation ? ButtonStyle.Success : ButtonStyle.Secondary);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`rpt:factions:${sid}`)
    .setLabel('Next: Select Factions →')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(t1.length !== 2 || t2.length !== 2 || !winner);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(t1Select),
      new ActionRowBuilder().addComponents(t2Select),
      new ActionRowBuilder().addComponents(winnerSelect),
      new ActionRowBuilder().addComponents(ptsBtn, rotBtn, nextBtn),
    ],
  };
}

/**
 * 2v2 factions step: one faction select per player (4 selects + back/points/submit).
 * Positions are fixed: team1[0], team1[1], team2[0], team2[1].
 */
function build2v2FactionStep(state, sid) {
  const { allPlayers, gameSystem, armyPoints, team1, team2, factions } = state;
  const ready = is2v2Ready(state);

  const sysName = GAME_SYSTEMS[gameSystem] || gameSystem;
  const embed = new EmbedBuilder()
    .setTitle('📋 Report a 2v2 Game — Select Factions')
    .setColor(COLORS.info)
    .setDescription(`**System:** ${sysName}\nSelect each player's faction.`);

  const factionOptions = factionsToOptions(getFactions(gameSystem));
  const makeFacOpts = (selectedFac) =>
    factionOptions.map(o => ({ ...o, default: o.value === selectedFac }));

  // Ordered: [team1[0], team1[1], team2[0], team2[1]]
  const positions = [
    { id: team1[0], team: 'Team 1', key: 'fac1p1' },
    { id: team1[1], team: 'Team 1', key: 'fac1p2' },
    { id: team2[0], team: 'Team 2', key: 'fac2p1' },
    { id: team2[1], team: 'Team 2', key: 'fac2p2' },
  ];

  const rows = [];
  for (const { id, team, key } of positions) {
    const name = playerName(allPlayers, id);
    const selected = id ? factions[id] : null;

    const sel = new StringSelectMenuBuilder()
      .setCustomId(`rpt:${key}:${sid}`)
      .setPlaceholder(`${name} (${team})…`)
      .addOptions(makeFacOpts(selected));

    rows.push(new ActionRowBuilder().addComponents(sel));
  }

  const backBtn = new ButtonBuilder()
    .setCustomId(`rpt:back:${sid}`)
    .setLabel('← Back')
    .setStyle(ButtonStyle.Secondary);

  const ptsBtn = new ButtonBuilder()
    .setCustomId(`rpt:pts:${sid}`)
    .setLabel(ptsButtonLabel(armyPoints))
    .setStyle(armyPoints ? ButtonStyle.Success : ButtonStyle.Secondary);

  const submitBtn = new ButtonBuilder()
    .setCustomId(`rpt:sub:${sid}`)
    .setLabel('Submit Report')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!ready);

  rows.push(new ActionRowBuilder().addComponents(backBtn, ptsBtn, submitBtn));

  return { embeds: [embed], components: rows };
}

// ── Modal builders ────────────────────────────────────────────────────────────

/** Modal for entering army points. */
function buildPointsModal(sid) {
  const modal = new ModalBuilder()
    .setCustomId(`rpt:pts_mdl:${sid}`)
    .setTitle('Set Army Points');

  const input = new TextInputBuilder()
    .setCustomId('army_points')
    .setLabel('Army points per player')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1000')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(6);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

/**
 * Modal shown when the reporter clicks "Submit Report".
 * Collects optional army details for the reporter before saving the game.
 */
function buildSubmitModal(sid) {
  const modal = new ModalBuilder()
    .setCustomId(`rpt:sub_mdl:${sid}`)
    .setTitle('Submit Report — Your Details (Optional)');

  const armyNameInput = new TextInputBuilder()
    .setCustomId('army_name')
    .setLabel('Your army list name (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const urlInput = new TextInputBuilder()
    .setCustomId('army_forge_url')
    .setLabel('Army Forge share URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(500)
    .setPlaceholder('https://army-forge.onepagerules.com/share/…');

  const notesInput = new TextInputBuilder()
    .setCustomId('player_notes')
    .setLabel('Your notes (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  const feelingInput = new TextInputBuilder()
    .setCustomId('game_feeling')
    .setLabel('How was the game for you? (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50)
    .setPlaceholder('amazing / fun / ok / frustrating / lucky / intense');

  modal.addComponents(
    new ActionRowBuilder().addComponents(armyNameInput),
    new ActionRowBuilder().addComponents(urlInput),
    new ActionRowBuilder().addComponents(notesInput),
    new ActionRowBuilder().addComponents(feelingInput),
  );

  return modal;
}

/** Modal for adding post-game army details (all fields in one step). */
function buildAddDetailsModal(gameId, userId) {
  const modal = new ModalBuilder()
    .setCustomId(`report:dtl_mdl:${gameId}:${userId}`)
    .setTitle('Add Your Army Details');

  const armyNameInput = new TextInputBuilder()
    .setCustomId('army_name')
    .setLabel('Army list name (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const urlInput = new TextInputBuilder()
    .setCustomId('army_forge_url')
    .setLabel('Army Forge share URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(500)
    .setPlaceholder('https://army-forge.onepagerules.com/share/…');

  const notesInput = new TextInputBuilder()
    .setCustomId('player_notes')
    .setLabel('Notes (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  const factionInput = new TextInputBuilder()
    .setCustomId('faction')
    .setLabel('Your faction (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100)
    .setPlaceholder('e.g. Battle Brothers, Kingdom of Men…');

  const feelingInput = new TextInputBuilder()
    .setCustomId('game_feeling')
    .setLabel('How was the game for you? (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50)
    .setPlaceholder('amazing / fun / ok / frustrating / lucky / intense');

  modal.addComponents(
    new ActionRowBuilder().addComponents(armyNameInput),
    new ActionRowBuilder().addComponents(urlInput),
    new ActionRowBuilder().addComponents(notesInput),
    new ActionRowBuilder().addComponents(factionInput),
    new ActionRowBuilder().addComponents(feelingInput),
  );

  return modal;
}

module.exports = {
  buildSetupStep,
  build1v1Form,
  build2v2TeamsStep,
  build2v2OverrideStep,
  build2v2FactionStep,
  buildPointsModal,
  buildSubmitModal,
  buildAddDetailsModal,
  getFactions,
  FACTIONS_AOF,
  FACTIONS_GDF,
  is1v1Ready,
  is2v2Ready,
};
