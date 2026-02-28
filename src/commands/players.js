const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database/supabase');
const { buildErrorEmbed, buildInfoEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription('Manage the registered player roster')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all registered players')
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a player from the roster (admin only)')
      .addUserOption(o => o.setName('player').setDescription('Player to remove').setRequired(true))
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'list') {
      await interaction.deferReply();

      const { data: players, error } = await supabase
        .from('players')
        .select('discord_id, discord_name, created_at')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: true });

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to fetch player list.')] });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Registered Players')
        .setColor(COLORS.info)
        .setTimestamp()
        .setFooter({ text: `${players?.length || 0} player(s) registered · /register to join` });

      if (!players || players.length === 0) {
        embed.setDescription('No players registered yet.\nUse `/register` to join the roster!');
      } else {
        const lines = players.map((p, i) => {
          const ts = Math.floor(new Date(p.created_at).getTime() / 1000);
          const mention = /^\d+$/.test(p.discord_id) ? `<@${p.discord_id}>` : `**${p.discord_name}**`;
          return `**${i + 1}.** ${mention} — *Registered <t:${ts}:d>*`;
        });
        embed.setDescription(lines.join('\n'));
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [buildErrorEmbed('You need the **Manage Server** permission to remove players.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const target = interaction.options.getUser('player');

      const { error } = await supabase
        .from('players')
        .delete()
        .eq('discord_id', target.id)
        .eq('guild_id', guildId);

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to remove player.')] });
      }

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '🗑️ Player Removed',
          `<@${target.id}> has been removed from the roster.\n\nRun \`/rotation setup\` to rebuild the rotation without them.`,
          COLORS.warning,
        )],
      });
    }
  },
};
