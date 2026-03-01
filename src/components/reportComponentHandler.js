'use strict';

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const supabase = require('../database/supabase');
const { buildErrorEmbed } = require('../utils/embeds');
const { generateRotations, getCurrentMatchup } = require('../utils/rotation');

const {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  createDetailSession,
  getDetailSession,
  updateDetailSession,
  deleteDetailSession,
} = require('./reportSession');

const {
  buildSetupStep,
  build1v1Form,
  build2v2TeamsStep,
  build2v2OverrideStep,
  build2v2FactionStep,
  buildAddDetailsMessage,
  buildPointsModal,
  buildAddDetailsModal,
} = require('./reportFormBuilder');

// ── Routing ───────────────────────────────────────────────────────────────────

/**
 * Route a button or select-menu interaction that starts with 'rpt:' or 'report:'.
 */
async function handleReportComponent(interaction) {
  const id = interaction.customId;

  if (id.startsWith('report:')) {
    return handlePostGameComponent(interaction);
  }

  // rpt:<action>:<sessionId>
  const parts  = id.split(':');
  const action = parts[1];
  const sid    = parts[2];

  const state = getSession(sid);
  if (!state) {
    return interaction.reply({
      content: '⏱️ This form has expired. Run `/opr report` again to start a new one.',
      flags: MessageFlags.Ephemeral,
    });
  }

  switch (action) {
    case 'type':     return handleTypeSelect(interaction, state, sid);
    case 'sys':      return handleSysSelect(interaction, state, sid);
    case 'winner':   return handleWinnerSelect(interaction, state, sid);
    case 'loser':    return handleLoserSelect(interaction, state, sid);
    case 'wfac':     return handleFacUpdate(interaction, state, sid, 'team1', 0);
    case 'lfac':     return handleFacUpdate(interaction, state, sid, 'team2', 0);
    case 'fac1p1':   return handleFacUpdate(interaction, state, sid, 'team1', 0);
    case 'fac1p2':   return handleFacUpdate(interaction, state, sid, 'team1', 1);
    case 'fac2p1':   return handleFacUpdate(interaction, state, sid, 'team2', 0);
    case 'fac2p2':   return handleFacUpdate(interaction, state, sid, 'team2', 1);
    case 't1':       return handleTeamSelect(interaction, state, sid, 'team1');
    case 't2':       return handleTeamSelect(interaction, state, sid, 'team2');
    case 'pts':      return handleSetPointsButton(interaction, sid);
    case 'rot':      return handleRotationToggle(interaction, state, sid);
    case 'ovr':      return handleOverrideButton(interaction, state, sid);
    case 'factions': return handleNextFactions(interaction, state, sid);
    case 'back':     return handleBackButton(interaction, state, sid);
    case 'sub':      return handleSubmitButton(interaction, state, sid);
    default:
      return interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral });
  }
}

/**
 * Route a modal submission that starts with 'rpt:' or 'report:'.
 */
async function handleReportModal(interaction) {
  const id = interaction.customId;

  if (id.startsWith('rpt:pts_mdl:')) {
    const sid = id.split(':')[2];
    return handlePointsModal(interaction, sid);
  }

  if (id.startsWith('report:dtl_mdl:')) {
    // report:dtl_mdl:<gameId>:<userId>
    const parts  = id.split(':');
    const gameId = parts[2];
    const userId = parts[3];
    return handleDetailsModal(interaction, gameId, userId);
  }
}

// ── Auto-transition helper ────────────────────────────────────────────────────

/**
 * Once both gameType and gameSystem are set, transition the form to the
 * appropriate next step. Returns the new form message.
 */
function autoTransitionForm(state, sid) {
  const { gameType, gameSystem, rotationState, allPlayers } = state;
  if (!gameType || !gameSystem) return buildSetupStep(state, sid);

  if (gameType === '1v1') {
    updateSession(sid, { step: '1v1-form' });
    return build1v1Form(getSession(sid), sid);
  }

  // 2v2 — check for valid rotation
  const validRotation =
    rotationState &&
    rotationState.player_discord_ids.length >= 4 &&
    rotationState.player_discord_ids.length % 2 === 0;

  if (validRotation) {
    const matchup = getCurrentMatchup(rotationState);
    if (matchup) {
      updateSession(sid, {
        team1: [...matchup[0]],
        team2: [...matchup[1]],
        step:  '2v2-teams',
      });
      return build2v2TeamsStep(getSession(sid), sid);
    }
  }

  // No usable rotation → go straight to override
  updateSession(sid, { step: '2v2-override', overrideTeams: true });
  return build2v2OverrideStep(getSession(sid), sid);
}

// ── Form interaction handlers ─────────────────────────────────────────────────

async function handleTypeSelect(interaction, state, sid) {
  updateSession(sid, { gameType: interaction.values[0] });
  const newState = getSession(sid);
  const msg = autoTransitionForm(newState, sid);
  return interaction.update(msg);
}

async function handleSysSelect(interaction, state, sid) {
  updateSession(sid, { gameSystem: interaction.values[0] });
  const newState = getSession(sid);
  const msg = autoTransitionForm(newState, sid);
  return interaction.update(msg);
}

async function handleWinnerSelect(interaction, state, sid) {
  // For 1v1: select a player as winner (value = discord_id)
  // For 2v2: select team that won (value = '1', '2', or 'tie')
  if (state.step === '1v1-form') {
    const winnerId = interaction.values[0];
    const newTeam1 = [winnerId];
    updateSession(sid, { team1: newTeam1 });
    return interaction.update(build1v1Form(getSession(sid), sid));
  }
  // 2v2
  updateSession(sid, { winner: interaction.values[0] });
  const newState = getSession(sid);
  const msg = newState.step === '2v2-override'
    ? build2v2OverrideStep(newState, sid)
    : build2v2TeamsStep(newState, sid);
  return interaction.update(msg);
}

async function handleLoserSelect(interaction, state, sid) {
  const loserId = interaction.values[0];
  updateSession(sid, { team2: [loserId] });
  return interaction.update(build1v1Form(getSession(sid), sid));
}

async function handleFacUpdate(interaction, state, sid, teamKey, position) {
  const playerId = state[teamKey][position];
  if (!playerId) return interaction.deferUpdate();

  const faction     = interaction.values[0];
  const newFactions = { ...state.factions, [playerId]: faction };
  updateSession(sid, { factions: newFactions });

  const newState = getSession(sid);
  const msg = newState.step === '1v1-form'
    ? build1v1Form(newState, sid)
    : build2v2FactionStep(newState, sid);
  return interaction.update(msg);
}

async function handleTeamSelect(interaction, state, sid, teamKey) {
  updateSession(sid, { [teamKey]: interaction.values });
  return interaction.update(build2v2OverrideStep(getSession(sid), sid));
}

async function handleSetPointsButton(interaction, sid) {
  // showModal() IS the response to the button interaction — no deferUpdate needed.
  return interaction.showModal(buildPointsModal(sid));
}

async function handleRotationToggle(interaction, state, sid) {
  updateSession(sid, { advanceRotation: !state.advanceRotation });
  const newState = getSession(sid);
  const msg = newState.step === '2v2-override'
    ? build2v2OverrideStep(newState, sid)
    : build2v2TeamsStep(newState, sid);
  return interaction.update(msg);
}

async function handleOverrideButton(interaction, state, sid) {
  updateSession(sid, { step: '2v2-override', overrideTeams: true });
  return interaction.update(build2v2OverrideStep(getSession(sid), sid));
}

async function handleNextFactions(interaction, state, sid) {
  updateSession(sid, { step: '2v2-factions' });
  return interaction.update(build2v2FactionStep(getSession(sid), sid));
}

async function handleBackButton(interaction, state, sid) {
  // Back from factions to the teams/override step
  const newStep = state.overrideTeams ? '2v2-override' : '2v2-teams';
  updateSession(sid, { step: newStep });
  const newState = getSession(sid);
  const msg = newStep === '2v2-override'
    ? build2v2OverrideStep(newState, sid)
    : build2v2TeamsStep(newState, sid);
  return interaction.update(msg);
}

async function handleSubmitButton(interaction, state, sid) {
  const { guildId, gameType, gameSystem, armyPoints, winner, team1, team2, factions, advanceRotation, editGameId, allPlayers } = state;

  if (!armyPoints) {
    return interaction.reply({
      content: '⚠️ Army points are not set — click **Set Army Points** first.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferUpdate();

  // Build participant list
  const isTie = winner === 'tie';
  let participants = [];

  if (gameType === '1v1') {
    const winnerId = team1[0];
    const loserId  = team2[0];

    if (winnerId === loserId) {
      return interaction.editReply({
        content: '⚠️ Winner and loser must be different players.',
        embeds: [], components: [],
      });
    }

    const wp = allPlayers.find(p => p.discord_id === winnerId);
    const lp = allPlayers.find(p => p.discord_id === loserId);
    participants = [
      { discord_id: winnerId, discord_name: wp?.discord_name || winnerId, team: 1, faction: factions[winnerId] || null, won: true  },
      { discord_id: loserId,  discord_name: lp?.discord_name || loserId,  team: 2, faction: factions[loserId]  || null, won: false },
    ];
  } else {
    const allIds = [...team1, ...team2];
    if (new Set(allIds).size !== allIds.length) {
      return interaction.editReply({
        content: '⚠️ Duplicate players detected. Each player may only appear once.',
        embeds: [], components: [],
      });
    }
    for (const id of team1) {
      const p = allPlayers.find(pl => pl.discord_id === id);
      participants.push({ discord_id: id, discord_name: p?.discord_name || id, team: 1, faction: factions[id] || null, won: isTie ? false : (winner === '1') });
    }
    for (const id of team2) {
      const p = allPlayers.find(pl => pl.discord_id === id);
      participants.push({ discord_id: id, discord_name: p?.discord_name || id, team: 2, faction: factions[id] || null, won: isTie ? false : (winner === '2') });
    }
  }

  try {
    let game;

    if (editGameId) {
      // ── Edit existing report ────────────────────────────────────────────────
      const { data: updatedGame, error: gameErr } = await supabase
        .from('games')
        .update({
          game_system: gameSystem,
          game_type:   gameType,
          army_points: armyPoints,
          is_tie:      isTie,
        })
        .eq('id', editGameId)
        .select()
        .single();

      if (gameErr) throw gameErr;
      game = updatedGame;

      // Replace all participants
      await supabase.from('game_participants').delete().eq('game_id', editGameId);
      const { error: partErr } = await supabase.from('game_participants')
        .insert(participants.map(p => ({ game_id: editGameId, ...p })));
      if (partErr) throw partErr;
    } else {
      // ── Insert new report ────────────────────────────────────────────────────
      const { data: newGame, error: gameErr } = await supabase
        .from('games')
        .insert({
          guild_id:    guildId,
          game_system: gameSystem,
          game_type:   gameType,
          army_points: armyPoints,
          reported_by: state.userId,
          is_tie:      isTie,
        })
        .select()
        .single();

      if (gameErr) throw gameErr;
      game = newGame;

      const { error: partErr } = await supabase.from('game_participants')
        .insert(participants.map(p => ({ game_id: game.id, ...p })));

      if (partErr) {
        await supabase.from('games').delete().eq('id', game.id);
        throw partErr;
      }
    }

    // ── Advance rotation (2v2 only) ─────────────────────────────────────────
    let nextMatchup = null;
    if (gameType === '2v2' && advanceRotation && !editGameId) {
      const rotState = state.rotationState;
      if (rotState && rotState.player_discord_ids.length >= 4) {
        const total    = generateRotations(rotState.player_discord_ids).length;
        const newIndex = (rotState.current_index + 1) % total;
        await supabase
          .from('rotation_state')
          .update({ current_index: newIndex, updated_at: new Date().toISOString() })
          .eq('guild_id', guildId);
        nextMatchup = getCurrentMatchup({ ...rotState, current_index: newIndex });
      }
    }

    deleteSession(sid);

    // Build nameMap for next matchup display
    const nameMap = {};
    for (const p of allPlayers) {
      if (!/^\d+$/.test(p.discord_id)) nameMap[p.discord_id] = p.discord_name;
    }

    // Clear the ephemeral form
    await interaction.editReply({ content: '✅ Report saved!', embeds: [], components: [] });

    // Post public result to channel
    const { buildReportEmbed, buildReportActionRow } = require('../utils/embeds');
    await interaction.channel.send({
      embeds:     [buildReportEmbed(game, participants, nextMatchup, nameMap)],
      components: [buildReportActionRow(game.id)],
    });
  } catch (err) {
    console.error('Failed to save game report:', err);
    await interaction.editReply({
      content: '❌ Failed to save the game report. Please try again.',
      embeds: [], components: [],
    });
  }
}

// ── Points modal handler ──────────────────────────────────────────────────────

async function handlePointsModal(interaction, sid) {
  const state = getSession(sid);
  if (!state) {
    return interaction.reply({
      content: '⏱️ Form expired. Run `/opr report` again.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const pointsStr = interaction.fields.getTextInputValue('army_points').trim();
  const points    = parseInt(pointsStr, 10);

  if (isNaN(points) || points <= 0) {
    return interaction.reply({
      content: '⚠️ Please enter a valid positive number for army points.',
      flags: MessageFlags.Ephemeral,
    });
  }

  updateSession(sid, { armyPoints: points });

  // Modal submit can't call update() — reply with the refreshed form instead.
  const newState = getSession(sid);
  let formMsg;
  switch (newState.step) {
    case '1v1-form':      formMsg = build1v1Form(newState, sid);       break;
    case '2v2-teams':     formMsg = build2v2TeamsStep(newState, sid);  break;
    case '2v2-override':  formMsg = build2v2OverrideStep(newState, sid); break;
    case '2v2-factions':  formMsg = build2v2FactionStep(newState, sid); break;
    default:              formMsg = buildSetupStep(newState, sid);
  }

  return interaction.reply({ ...formMsg, flags: MessageFlags.Ephemeral });
}

// ── Post-game component handlers ──────────────────────────────────────────────

async function handlePostGameComponent(interaction) {
  const id    = interaction.customId;
  const parts = id.split(':');
  const action = parts[1];

  if (action === 'add') {
    return handleAddDetailsButton(interaction, parts[2]);
  }
  if (action === 'edit') {
    return handleEditReportButton(interaction, parts[2]);
  }
  if (action === 'fac') {
    return handleDetailFacSelect(interaction, parts[2], parts[3]);
  }
  if (action === 'feel') {
    return handleDetailFeelSelect(interaction, parts[2], parts[3]);
  }
  if (action === 'save') {
    return handleSaveDetails(interaction, parts[2], parts[3]);
  }
}

async function handleAddDetailsButton(interaction, gameId) {
  const userId = interaction.user.id;

  const { data: participant } = await supabase
    .from('game_participants')
    .select('id')
    .eq('game_id', gameId)
    .eq('discord_id', userId)
    .maybeSingle();

  if (!participant) {
    return interaction.reply({
      content: "⚠️ You weren't recorded as a participant in this game.",
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.showModal(buildAddDetailsModal(gameId, userId));
}

async function handleDetailsModal(interaction, gameId, userId) {
  // Verify participant
  const { data: participant } = await supabase
    .from('game_participants')
    .select('id')
    .eq('game_id', gameId)
    .eq('discord_id', userId)
    .maybeSingle();

  if (!participant) {
    return interaction.reply({
      content: "⚠️ You weren't recorded as a participant in this game.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const { data: game } = await supabase
    .from('games')
    .select('game_system')
    .eq('id', gameId)
    .single();

  const armyName    = interaction.fields.getTextInputValue('army_name').trim()      || null;
  const armyForgeUrl = interaction.fields.getTextInputValue('army_forge_url').trim() || null;
  const playerNotes  = interaction.fields.getTextInputValue('player_notes').trim()   || null;

  createDetailSession(gameId, userId, game?.game_system || '', armyName, armyForgeUrl, playerNotes);

  const msg = buildAddDetailsMessage(gameId, userId, game?.game_system || '');
  return interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
}

async function handleDetailFacSelect(interaction, gameId, userId) {
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '⚠️ These details belong to another player.', flags: MessageFlags.Ephemeral });
  }
  updateDetailSession(gameId, userId, { faction: interaction.values[0] });
  return interaction.deferUpdate();
}

async function handleDetailFeelSelect(interaction, gameId, userId) {
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '⚠️ These details belong to another player.', flags: MessageFlags.Ephemeral });
  }
  updateDetailSession(gameId, userId, { feeling: interaction.values[0] });
  return interaction.deferUpdate();
}

async function handleSaveDetails(interaction, gameId, userId) {
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '⚠️ These details belong to another player.', flags: MessageFlags.Ephemeral });
  }

  const ds = getDetailSession(gameId, userId);
  if (!ds) {
    return interaction.reply({
      content: '⏱️ Session expired. Click **Add My Details** again.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferUpdate();

  const updateData = {};
  if (ds.armyName)     updateData.army_name      = ds.armyName;
  if (ds.armyForgeUrl) updateData.army_forge_url  = ds.armyForgeUrl;
  if (ds.playerNotes)  updateData.player_notes    = ds.playerNotes;
  if (ds.faction)      updateData.faction         = ds.faction;
  if (ds.feeling)      updateData.game_feeling     = ds.feeling;

  const { error } = await supabase
    .from('game_participants')
    .update(updateData)
    .eq('game_id', gameId)
    .eq('discord_id', userId);

  if (error) {
    console.error('Failed to save player details:', error);
    return interaction.editReply({ content: '❌ Failed to save details. Please try again.', embeds: [], components: [] });
  }

  deleteDetailSession(gameId, userId);
  return interaction.editReply({ content: '✅ Details saved!', embeds: [], components: [] });
}

async function handleEditReportButton(interaction, gameId) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '⚠️ You need the **Manage Server** permission to edit game reports.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const [gameResult, participantsResult, playersResult, rotResult] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('game_participants').select('*').eq('game_id', gameId),
    supabase.from('players').select('discord_id, discord_name').order('created_at'),
    supabase.from('rotation_state').select('*').maybeSingle(),
  ]);

  if (gameResult.error || !gameResult.data) {
    return interaction.reply({ content: '⚠️ Game not found.', flags: MessageFlags.Ephemeral });
  }

  const game         = gameResult.data;
  const participants = participantsResult.data || [];

  // Filter players to this guild
  const allPlayers   = (playersResult.data || []).filter(p =>
    participants.some(part => part.discord_id === p.discord_id)
  );

  // Reconstruct session state from existing game
  const team1    = participants.filter(p => p.team === 1).map(p => p.discord_id);
  const team2    = participants.filter(p => p.team === 2).map(p => p.discord_id);
  const factions = {};
  for (const p of participants) {
    if (p.faction) factions[p.discord_id] = p.faction;
  }

  let winner = game.is_tie ? 'tie' : null;
  if (!winner) {
    const wonP = participants.find(p => p.won);
    if (wonP) winner = String(wonP.team);
  }

  const rotationState = rotResult.data || null;

  // Fetch all guild players for the form (not just participants)
  const { data: allGuildPlayers } = await supabase
    .from('players')
    .select('discord_id, discord_name')
    .eq('guild_id', game.guild_id)
    .order('created_at');

  const sid = createSession(
    interaction.user.id,
    game.guild_id,
    interaction.channelId,
    rotationState,
    allGuildPlayers || [],
    {
      gameType:    game.game_type,
      gameSystem:  game.game_system,
      armyPoints:  game.army_points,
      winner,
      team1, team2, factions,
      editGameId:  gameId,
      step: game.game_type === '1v1' ? '1v1-form' : '2v2-factions',
    }
  );

  const state = getSession(sid);
  const msg = game.game_type === '1v1'
    ? build1v1Form(state, sid)
    : build2v2FactionStep(state, sid);

  return interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
}

module.exports = {
  handleReportComponent,
  handleReportModal,
};
