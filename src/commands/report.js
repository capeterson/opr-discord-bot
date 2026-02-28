const { SlashCommandBuilder } = require('discord.js');
const supabase = require('../database/supabase');
const { buildReportEmbed, buildErrorEmbed, GAME_SYSTEMS } = require('../utils/embeds');
const { getNextMatchup } = require('../utils/rotation');

const SYSTEMS = Object.keys(GAME_SYSTEMS).map(name => ({ name, value: name }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report the result of a One Page Rules game')
    // ── 1v1 ──────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('1v1')
      .setDescription('Report a 1v1 game result')
      .addStringOption(o => o.setName('system').setDescription('Game system').setRequired(true).addChoices(...SYSTEMS))
      .addIntegerOption(o => o.setName('points').setDescription('Army points per player').setRequired(true).setMinValue(1))
      .addUserOption(o => o.setName('winner').setDescription('The winning player').setRequired(true))
      .addStringOption(o => o.setName('winner_faction').setDescription('Winning player\'s faction').setRequired(true))
      .addUserOption(o => o.setName('loser').setDescription('The losing player').setRequired(true))
      .addStringOption(o => o.setName('loser_faction').setDescription('Losing player\'s faction').setRequired(true))
    )
    // ── 2v2 ──────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('2v2')
      .setDescription('Report a 2v2 co-op game result')
      .addStringOption(o => o.setName('system').setDescription('Game system').setRequired(true).addChoices(...SYSTEMS))
      .addIntegerOption(o => o.setName('points').setDescription('Army points per player').setRequired(true).setMinValue(1))
      .addUserOption(o => o.setName('winner1').setDescription('Winning team — player 1').setRequired(true))
      .addStringOption(o => o.setName('winner1_faction').setDescription('Winner 1\'s faction').setRequired(true))
      .addUserOption(o => o.setName('winner2').setDescription('Winning team — player 2').setRequired(true))
      .addStringOption(o => o.setName('winner2_faction').setDescription('Winner 2\'s faction').setRequired(true))
      .addUserOption(o => o.setName('loser1').setDescription('Losing team — player 1').setRequired(true))
      .addStringOption(o => o.setName('loser1_faction').setDescription('Loser 1\'s faction').setRequired(true))
      .addUserOption(o => o.setName('loser2').setDescription('Losing team — player 2').setRequired(true))
      .addStringOption(o => o.setName('loser2_faction').setDescription('Loser 2\'s faction').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId    = interaction.guildId;

    await interaction.deferReply();

    const system = interaction.options.getString('system');
    const points = interaction.options.getInteger('points');

    let participants = [];
    let gameType;

    if (subcommand === '1v1') {
      gameType = '1v1';
      const winner = interaction.options.getUser('winner');
      const loser  = interaction.options.getUser('loser');

      if (winner.id === loser.id) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Winner and loser must be different players.')] });
      }

      participants = [
        { discord_id: winner.id, discord_name: winner.displayName || winner.username, team: 1, faction: interaction.options.getString('winner_faction'), won: true },
        { discord_id: loser.id,  discord_name: loser.displayName  || loser.username,  team: 2, faction: interaction.options.getString('loser_faction'),  won: false },
      ];
    } else {
      gameType = '2v2';
      const w1 = interaction.options.getUser('winner1');
      const w2 = interaction.options.getUser('winner2');
      const l1 = interaction.options.getUser('loser1');
      const l2 = interaction.options.getUser('loser2');

      const ids = [w1.id, w2.id, l1.id, l2.id];
      if (new Set(ids).size !== 4) {
        return interaction.editReply({ embeds: [buildErrorEmbed('All four players must be different users.')] });
      }

      participants = [
        { discord_id: w1.id, discord_name: w1.displayName || w1.username, team: 1, faction: interaction.options.getString('winner1_faction'), won: true  },
        { discord_id: w2.id, discord_name: w2.displayName || w2.username, team: 1, faction: interaction.options.getString('winner2_faction'), won: true  },
        { discord_id: l1.id, discord_name: l1.displayName || l1.username, team: 2, faction: interaction.options.getString('loser1_faction'),  won: false },
        { discord_id: l2.id, discord_name: l2.displayName || l2.username, team: 2, faction: interaction.options.getString('loser2_faction'),  won: false },
      ];
    }

    // Insert game record
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .insert({
        guild_id:    guildId,
        game_system: system,
        game_type:   gameType,
        army_points: points,
        reported_by: interaction.user.id,
      })
      .select()
      .single();

    if (gameErr) {
      console.error('Failed to insert game:', gameErr);
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to save the game. Please try again.')] });
    }

    // Insert participants
    const participantRows = participants.map(p => ({ game_id: game.id, ...p }));
    const { error: partErr } = await supabase.from('game_participants').insert(participantRows);

    if (partErr) {
      console.error('Failed to insert participants:', partErr);
      // Roll back the game record
      await supabase.from('games').delete().eq('id', game.id);
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to save participants. Please try again.')] });
    }

    // For 2v2: advance the rotation and get the next matchup
    let nextMatchup = null;
    if (gameType === '2v2') {
      const { data: rotState } = await supabase
        .from('rotation_state')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (rotState && rotState.player_discord_ids.length >= 4) {
        const { generateRotations } = require('../utils/rotation');
        const total    = generateRotations(rotState.player_discord_ids).length;
        const newIndex = (rotState.current_index + 1) % total;

        await supabase
          .from('rotation_state')
          .update({ current_index: newIndex, updated_at: new Date().toISOString() })
          .eq('guild_id', guildId);

        // The new current_index IS the next matchup
        const updatedState = { ...rotState, current_index: newIndex };
        const { getCurrentMatchup } = require('../utils/rotation');
        nextMatchup = getCurrentMatchup(updatedState);
      }
    }

    const embed = buildReportEmbed(game, participants, nextMatchup);
    return interaction.editReply({ embeds: [embed] });
  },
};
