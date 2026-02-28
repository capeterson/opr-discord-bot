const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database/supabase');
const { buildInfoEmbed, buildErrorEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register yourself as a player for game tracking and 2v2 rotation'),

  async execute(interaction) {
    const discordId   = interaction.user.id;
    const discordName = interaction.user.displayName || interaction.user.username;
    const guildId     = interaction.guildId;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
