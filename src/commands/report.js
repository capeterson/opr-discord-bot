'use strict';

const supabase = require('../database/supabase');
const { buildErrorEmbed } = require('../utils/embeds');
const { createSession } = require('../components/reportSession');
const { buildSetupStep } = require('../components/reportFormBuilder');

module.exports = {
  async execute(interaction) {
    const guildId = interaction.guildId;

    await interaction.deferReply({ ephemeral: true });

    // Fetch registered players and rotation state in parallel
    const [playersResult, rotResult] = await Promise.all([
      supabase
        .from('players')
        .select('discord_id, discord_name')
        .eq('guild_id', guildId)
        .order('created_at'),
      supabase
        .from('rotation_state')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle(),
    ]);

    if (playersResult.error) {
      console.error('Failed to fetch players:', playersResult.error);
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to load player list. Please try again.')] });
    }

    const allPlayers   = playersResult.data || [];
    const rotationState = rotResult.data || null;

    if (allPlayers.length === 0) {
      return interaction.editReply({
        embeds: [buildErrorEmbed('No registered players found. Use `/opr register` to register players first.')],
      });
    }

    const sid = createSession(
      interaction.user.id,
      guildId,
      interaction.channelId,
      rotationState,
      allPlayers,
    );

    const formMessage = buildSetupStep({ rotationState, allPlayers, gameType: null, gameSystem: null }, sid);
    return interaction.editReply(formMessage);
  },
};
