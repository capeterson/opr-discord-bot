const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database/supabase');
const { generateRotations, getCurrentMatchup, getNextMatchup, formatMatchup, totalMatchups } = require('../utils/rotation');
const { buildErrorEmbed, buildInfoEmbed, COLORS } = require('../utils/embeds');

/** Build a name map for any guest (non-Discord) player IDs in the list. */
async function buildGuestNameMap(ids, guildId) {
  const guestIds = ids.filter(id => !/^\d+$/.test(id));
  if (guestIds.length === 0) return {};
  const { data } = await supabase
    .from('players')
    .select('discord_id, discord_name')
    .in('discord_id', guestIds)
    .eq('guild_id', guildId);
  return Object.fromEntries((data || []).map(p => [p.discord_id, p.discord_name]));
}

/** Format a player ID as a mention for Discord users, or bold name for guests. */
function fmtPlayer(id, nameMap) {
  return /^\d+$/.test(id) ? `<@${id}>` : `**${nameMap[id] || id}**`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rotation')
    .setDescription('Manage the 2v2 team rotation')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Build the rotation from all registered players (admin only)')
    )
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('Show the current and upcoming team matchups')
    )
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('Reset the rotation back to the first matchup (admin only)')
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── setup ──────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [buildErrorEmbed('You need the **Manage Server** permission to set up the rotation.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { data: players, error } = await supabase
        .from('players')
        .select('discord_id, discord_name')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: true });

      if (error || !players) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to fetch players.')] });
      }

      if (players.length < 4) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(
            `You need at least **4 registered players** for 2v2 rotation.\n` +
            `Currently registered: **${players.length}**\n` +
            `Have remaining players use \`/opr register\` first.`,
          )],
        });
      }

      if (players.length % 2 !== 0) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(
            `You need an **even number** of players for 2v2 rotation.\n` +
            `Currently registered: **${players.length}**`,
          )],
        });
      }

      const ids      = players.map(p => p.discord_id);
      const nameMap  = Object.fromEntries(players.map(p => [p.discord_id, p.discord_name]));
      const rotations = generateRotations(ids);

      const { error: upsertErr } = await supabase
        .from('rotation_state')
        .upsert(
          { guild_id: guildId, player_discord_ids: ids, current_index: 0, updated_at: new Date().toISOString() },
          { onConflict: 'guild_id' },
        );

      if (upsertErr) {
        console.error('rotation setup error:', upsertErr);
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to save rotation.')] });
      }

      const [t1, t2] = rotations[0];
      const embed = new EmbedBuilder()
        .setTitle('✅ 2v2 Rotation Set Up')
        .setColor(COLORS.success)
        .setTimestamp()
        .addFields(
          { name: '👥 Players in rotation', value: players.map(p => fmtPlayer(p.discord_id, nameMap)).join(', ') },
          { name: `🔄 ${rotations.length} unique matchup(s) generated`, value: '\u200B' },
          { name: '⚔️ First Matchup (Rotation 1)', value: formatMatchup(t1, t2, nameMap) },
        )
        .setFooter({ text: 'Use /opr rotation view to see all matchups' });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── view ───────────────────────────────────────────────────────────────
    if (sub === 'view') {
      await interaction.deferReply();

      const { data: rotState, error } = await supabase
        .from('rotation_state')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (error) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to fetch rotation.')] });
      }

      if (!rotState || rotState.player_discord_ids.length < 4) {
        return interaction.editReply({
          embeds: [buildInfoEmbed(
            '⚔️ No Rotation Set Up',
            'No 2v2 rotation is configured yet.\nAn admin can run `/opr rotation setup` after all players have `/opr register`\'d.',
          )],
        });
      }

      const ids       = rotState.player_discord_ids;
      const nameMap   = await buildGuestNameMap(ids, guildId);
      const rotations = generateRotations(ids);
      const total     = rotations.length;
      const current   = rotState.current_index % total;

      const embed = new EmbedBuilder()
        .setTitle('⚔️ 2v2 Team Rotation')
        .setColor(COLORS.info)
        .setTimestamp()
        .addFields(
          { name: '👥 Registered Players', value: ids.map(id => fmtPlayer(id, nameMap)).join(', ') },
        );

      // Show all matchups, highlighting the current one
      const lines = rotations.map(([t1, t2], i) => {
        const t1str = t1.map(id => fmtPlayer(id, nameMap)).join(' & ');
        const t2str = t2.map(id => fmtPlayer(id, nameMap)).join(' & ');
        const arrow = i === current ? ' ← **current**' : '';
        return `**${i + 1}.** ${t1str} vs ${t2str}${arrow}`;
      });

      embed.addFields({ name: `🔄 All Matchups (${total} total)`, value: lines.join('\n') });

      // Show next matchup
      const next = getNextMatchup(rotState);
      if (next) {
        const [t1, t2] = next;
        embed.addFields({
          name: `⏭️ Next Week's Matchup (Rotation ${((current + 1) % total) + 1})`,
          value: formatMatchup(t1, t2, nameMap),
        });
      }

      embed.setFooter({ text: 'Rotation advances automatically when a 2v2 game is reported' });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── reset ──────────────────────────────────────────────────────────────
    if (sub === 'reset') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [buildErrorEmbed('You need the **Manage Server** permission to reset the rotation.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { data: rotState, error: fetchErr } = await supabase
        .from('rotation_state')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (fetchErr || !rotState) {
        return interaction.editReply({ embeds: [buildErrorEmbed('No rotation found. Run `/opr rotation setup` first.')] });
      }

      const { error: updateErr } = await supabase
        .from('rotation_state')
        .update({ current_index: 0, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId);

      if (updateErr) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to reset rotation.')] });
      }

      const ids      = rotState.player_discord_ids;
      const nameMap  = await buildGuestNameMap(ids, guildId);
      const rotations = generateRotations(ids);
      const [t1, t2]  = rotations[0];

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '🔄 Rotation Reset',
          `Rotation has been reset to matchup 1 of ${rotations.length}.\n\n${formatMatchup(t1, t2, nameMap)}`,
          COLORS.warning,
        )],
      });
    }
  },
};
