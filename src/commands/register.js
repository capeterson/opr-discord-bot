const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { randomUUID } = require('crypto');
const supabase = require('../database/supabase');
const { buildInfoEmbed, buildErrorEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register yourself as a player for game tracking and 2v2 rotation')
    .addStringOption(o => o
      .setName('name')
      .setDescription('Admin only: register a non-Discord player by name')
      .setRequired(false)
    ),

  async execute(interaction) {
    const guildId   = interaction.guildId;
    const guestName = interaction.options.getString('name');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ── Admin: register a non-Discord guest player ──────────────────────────
    if (guestName) {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply({
          embeds: [buildErrorEmbed('You need the **Manage Server** permission to register players by name.')],
        });
      }

      const trimmed = guestName.trim();
      if (!trimmed) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Player name cannot be empty.')] });
      }

      // Prevent duplicate names in this guild
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('guild_id', guildId)
        .eq('discord_name', trimmed)
        .maybeSingle();

      if (existing) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(`A player named **${trimmed}** is already registered.`)],
        });
      }

      const { error } = await supabase
        .from('players')
        .insert({ discord_id: randomUUID(), guild_id: guildId, discord_name: trimmed });

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to register player. Please try again.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '✅ Player Added',
          `**${trimmed}** has been added to the player roster.\n\nRun \`/rotation setup\` to rebuild the 2v2 rotation.`,
          COLORS.success,
        )],
      });
    }

    // ── Self-register ────────────────────────────────────────────────────────
    const discordId   = interaction.user.id;
    const discordName = interaction.user.displayName || interaction.user.username;

    const { data: existing, error: fetchErr } = await supabase
      .from('players')
      .select('id, discord_name')
      .eq('discord_id', discordId)
      .eq('guild_id', guildId)
      .maybeSingle();

    if (fetchErr) {
      return interaction.editReply({ embeds: [buildErrorEmbed('Database error. Please try again.')] });
    }

    if (existing) {
      // Update name if it changed
      if (existing.discord_name !== discordName) {
        await supabase
          .from('players')
          .update({ discord_name: discordName })
          .eq('id', existing.id);
      }
      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '✅ Already Registered',
          `You're already registered as **${discordName}**.\nYour display name has been refreshed.`,
          COLORS.success,
        )],
      });
    }

    const { error: insertErr } = await supabase
      .from('players')
      .insert({ discord_id: discordId, guild_id: guildId, discord_name: discordName });

    if (insertErr) {
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to register. Please try again.')] });
    }

    return interaction.editReply({
      embeds: [buildInfoEmbed(
        '✅ Registered!',
        `Welcome, **${discordName}**! You've been added to the player roster.\n\nUse \`/rotation setup\` (admin) to rebuild the 2v2 rotation with all registered players.`,
        COLORS.success,
      )],
    });
  },
};
