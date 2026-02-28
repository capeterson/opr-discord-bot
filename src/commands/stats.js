const supabase = require('../database/supabase');
const { buildStatsEmbed, buildErrorEmbed } = require('../utils/embeds');

module.exports = {
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
