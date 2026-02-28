const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database/supabase');
const { buildErrorEmbed, buildInfoEmbed, COLORS, formatDate, formatRelative } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('opr-schedule')
    .setDescription('Manage the upcoming game schedule')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Schedule a game (admin only)')
      .addStringOption(o => o.setName('date').setDescription('Date in YYYY-MM-DD format (UTC)').setRequired(true))
      .addStringOption(o => o.setName('time').setDescription('Time in HH:MM format (UTC), e.g. 14:00').setRequired(true))
      .addStringOption(o => o
        .setName('type')
        .setDescription('Game format')
        .setRequired(true)
        .addChoices(
          { name: '1v1', value: '1v1' },
          { name: '2v2', value: '2v2' },
        ))
      .addStringOption(o => o.setName('note').setDescription('Optional note (location, bring snacks, etc.)').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View upcoming scheduled games')
    )
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Remove a scheduled game by its number in the list (admin only)')
      .addIntegerOption(o => o.setName('number').setDescription('Game number from /schedule view').setRequired(true).setMinValue(1))
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'set') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [buildErrorEmbed('You need the **Manage Server** permission to schedule games.')], flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const dateStr = interaction.options.getString('date');
      const timeStr = interaction.options.getString('time');
      const type    = interaction.options.getString('type');
      const note    = interaction.options.getString('note') || null;

      // Validate and parse
      const isoString = `${dateStr}T${timeStr}:00.000Z`;
      const parsed    = new Date(isoString);
      if (isNaN(parsed.getTime())) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Invalid date or time. Use `YYYY-MM-DD` and `HH:MM` (UTC).')] });
      }
      if (parsed < new Date()) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Scheduled date must be in the future.')] });
      }

      const { error } = await supabase
        .from('game_schedule')
        .insert({ guild_id: guildId, game_date: parsed.toISOString(), game_type: type, note });

      if (error) {
        console.error('schedule set error:', error);
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to save schedule. Please try again.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '📅 Game Scheduled',
          `A **${type}** game has been scheduled for ${formatDate(parsed)}.\n${note ? `📝 ${note}` : ''}`,
          COLORS.success,
        )],
      });
    }

    if (sub === 'view') {
      await interaction.deferReply();

      const { data: events, error } = await supabase
        .from('game_schedule')
        .select('*')
        .eq('guild_id', guildId)
        .gte('game_date', new Date().toISOString())
        .order('game_date', { ascending: true })
        .limit(10);

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to fetch schedule.')] });
      }

      const embed = new EmbedBuilder()
        .setTitle('📅 Upcoming Games')
        .setColor(COLORS.info)
        .setTimestamp();

      if (!events || events.length === 0) {
        embed.setDescription('No upcoming games scheduled.\nUse `/opr-schedule set` to add one!');
      } else {
        const lines = events.map((e, i) => {
          const note = e.note ? ` — ${e.note}` : '';
          return `**${i + 1}.** ${formatDate(e.game_date)} · **${e.game_type}**${note}\n└ ${formatRelative(e.game_date)}`;
        });
        embed.setDescription(lines.join('\n\n'));
        embed.setFooter({ text: 'Remove entries with /opr-schedule clear <number>' });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'clear') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [buildErrorEmbed('You need the **Manage Server** permission to clear scheduled games.')], flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const number = interaction.options.getInteger('number');

      const { data: events, error: fetchErr } = await supabase
        .from('game_schedule')
        .select('id, game_date, game_type')
        .eq('guild_id', guildId)
        .gte('game_date', new Date().toISOString())
        .order('game_date', { ascending: true })
        .limit(10);

      if (fetchErr || !events) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to fetch schedule.')] });
      }

      const target = events[number - 1];
      if (!target) {
        return interaction.editReply({ embeds: [buildErrorEmbed(`No scheduled game at position ${number}. Use \`/opr-schedule view\` to see the list.`)] });
      }

      const { error: delErr } = await supabase.from('game_schedule').delete().eq('id', target.id);
      if (delErr) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to remove the scheduled game.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '🗑️ Schedule Entry Removed',
          `Removed: **${target.game_type}** on ${formatDate(target.game_date)}`,
          COLORS.warning,
        )],
      });
    }
  },
};
