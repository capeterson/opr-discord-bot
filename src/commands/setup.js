const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database/supabase');
const { buildErrorEmbed, buildInfoEmbed, COLORS } = require('../utils/embeds');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

module.exports = {
  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub !== 'view' && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [buildErrorEmbed('You need the **Manage Server** permission to change bot settings.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── view ───────────────────────────────────────────────────────────────
    if (sub === 'view') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { data: config } = await supabase
        .from('server_config')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Bot Configuration')
        .setColor(COLORS.info)
        .setTimestamp();

      if (!config) {
        embed.setDescription('No configuration found. Use `/opr setup channel`, `/opr setup day`, and `/opr setup time` to configure the bot.');
      } else {
        embed.addFields(
          {
            name: '📢 Reminder Channel',
            value: config.reminder_channel_id ? `<#${config.reminder_channel_id}>` : '_Not set_',
            inline: true,
          },
          {
            name: '📅 Reminder Day',
            value: DAY_NAMES[config.reminder_day] || 'Monday',
            inline: true,
          },
          {
            name: '🕐 Reminder Time',
            value: `${String(config.reminder_hour).padStart(2, '0')}:00 UTC`,
            inline: true,
          },
          {
            name: '📬 Last Reminder Sent',
            value: config.last_reminder_date || '_Never_',
            inline: true,
          },
        );
      }

      return interaction.editReply({ embeds: [embed] });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Ensure row exists
    await supabase
      .from('server_config')
      .upsert({ guild_id: guildId, updated_at: new Date().toISOString() }, { onConflict: 'guild_id', ignoreDuplicates: true });

    // ── channel ────────────────────────────────────────────────────────────
    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');

      const { error } = await supabase
        .from('server_config')
        .update({ reminder_channel_id: channel.id, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId);

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to save channel setting.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '✅ Reminder Channel Set',
          `Weekly reminders will now be posted in <#${channel.id}>.`,
          COLORS.success,
        )],
      });
    }

    // ── day ────────────────────────────────────────────────────────────────
    if (sub === 'day') {
      const day = parseInt(interaction.options.getString('day'), 10);

      const { error } = await supabase
        .from('server_config')
        .update({ reminder_day: day, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId);

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to save day setting.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '✅ Reminder Day Set',
          `Weekly reminders will now be sent on **${DAY_NAMES[day]}s**.`,
          COLORS.success,
        )],
      });
    }

    // ── time ───────────────────────────────────────────────────────────────
    if (sub === 'time') {
      const hour = interaction.options.getInteger('hour');

      const { error } = await supabase
        .from('server_config')
        .update({ reminder_hour: hour, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId);

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to save time setting.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '✅ Reminder Time Set',
          `Weekly reminders will now be sent at **${String(hour).padStart(2, '0')}:00 UTC**.`,
          COLORS.success,
        )],
      });
    }

    // ── clear ───────────────────────────────────────────────────────────────
    if (sub === 'clear') {
      const { error } = await supabase
        .from('server_config')
        .update({
          reminder_channel_id: null,
          reminder_day: null,
          reminder_hour: null,
          updated_at: new Date().toISOString(),
        })
        .eq('guild_id', guildId);

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to clear reminder settings.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '✅ Reminder Settings Cleared',
          'All reminder settings have been removed. Weekly reminders will no longer be sent for this server.',
          COLORS.success,
        )],
      });
    }
  },
};
