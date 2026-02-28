const { SlashCommandBuilder } = require('discord.js');
const supabase = require('../database/supabase');
const { buildStatsEmbed, buildErrorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('opr-stats')
    .setDescription('View One Page Rules game statistics for this server')
    .addStringOption(o => o
      .setName('filter')
      .setDescription('Filter by game system')
      .setRequired(false)
      .addChoices(
        { name: 'All systems',                   value: 'all' },
        { name: 'Age of Fantasy',                value: 'Age of Fantasy' },
        { name: 'Grimdark Future',               value: 'Grimdark Future' },
        { name: 'Age of Fantasy: Skirmish',      value: 'Age of Fantasy: Skirmish' },
        { name: 'Grimdark Future: Firefight',    value: 'Grimdark Future: Firefight' },
      )
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const filter  = interaction.options.getString('filter') || 'all';

    await interaction.deferReply();

    let query = supabase
      .from('games')
      .select('*, game_participants(*)')
      .eq('guild_id', guildId)
      .order('game_date', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('game_system', filter);
    }

    const { data: games, error } = await query;

    if (error) {
      console.error('stats fetch error:', error);
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to fetch statistics.')] });
    }

    const title = filter === 'all'
      ? '📊 One Page Rules — All-time Statistics'
      : `📊 One Page Rules — ${filter} Statistics`;

    return interaction.editReply({ embeds: [buildStatsEmbed(games || [], title)] });
  },
};
