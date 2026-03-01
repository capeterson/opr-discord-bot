const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const supabase = require('../database/supabase');
const {
  generateRotations,
  getOrderedMatchups,
  getCurrentMatchup,
  getNextMatchup,
  getPreviewMatchups,
  formatMatchup,
} = require('../utils/rotation');
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

/** Fetch and validate rotation state. Returns { rotState, error } where error is an embed or null. */
async function fetchRotationState(guildId) {
  const { data: rotState, error } = await supabase
    .from('rotation_state')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error) return { rotState: null, fetchError: 'Failed to fetch rotation.' };
  if (!rotState || rotState.player_discord_ids.length < 4) {
    return { rotState: null, fetchError: 'No rotation found. Run `/opr rotation setup` first.' };
  }
  return { rotState, fetchError: null };
}

module.exports = {
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
          {
            guild_id: guildId,
            player_discord_ids: ids,
            current_index: 0,
            matchup_order: null,
            updated_at: new Date().toISOString(),
          },
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

      const ids     = rotState.player_discord_ids;
      const nameMap = await buildGuestNameMap(ids, guildId);
      const ordered = getOrderedMatchups(rotState);
      const total   = ordered.length;
      const current = rotState.current_index % total;

      const embed = new EmbedBuilder()
        .setTitle('⚔️ 2v2 Team Rotation')
        .setColor(COLORS.info)
        .setTimestamp()
        .addFields(
          { name: '👥 Registered Players', value: ids.map(id => fmtPlayer(id, nameMap)).join(', ') },
        );

      // Show all matchups in the (possibly custom) order, highlighting current
      const lines = ordered.map(([t1, t2], i) => {
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

      const { rotState, fetchError } = await fetchRotationState(guildId);
      if (fetchError) {
        return interaction.editReply({ embeds: [buildErrorEmbed(fetchError)] });
      }

      const { error: updateErr } = await supabase
        .from('rotation_state')
        .update({ current_index: 0, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId);

      if (updateErr) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to reset rotation.')] });
      }

      const ids     = rotState.player_discord_ids;
      const nameMap = await buildGuestNameMap(ids, guildId);
      const ordered = getOrderedMatchups(rotState);
      const [t1, t2] = ordered[0];

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '🔄 Rotation Reset',
          `Rotation has been reset to matchup 1 of ${ordered.length}.\n\n${formatMatchup(t1, t2, nameMap)}`,
          COLORS.warning,
        )],
      });
    }

    // ── skip ───────────────────────────────────────────────────────────────
    if (sub === 'skip') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [buildErrorEmbed('You need the **Manage Server** permission to skip the rotation.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { rotState, fetchError } = await fetchRotationState(guildId);
      if (fetchError) {
        return interaction.editReply({ embeds: [buildErrorEmbed(fetchError)] });
      }

      const ids     = rotState.player_discord_ids;
      const nameMap = await buildGuestNameMap(ids, guildId);
      const ordered = getOrderedMatchups(rotState);
      const total   = ordered.length;
      const newIndex = (rotState.current_index + 1) % total;

      const { error: updateErr } = await supabase
        .from('rotation_state')
        .update({ current_index: newIndex, updated_at: new Date().toISOString() })
        .eq('guild_id', guildId);

      if (updateErr) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to skip rotation.')] });
      }

      const [t1, t2] = ordered[newIndex];

      return interaction.editReply({
        embeds: [buildInfoEmbed(
          '⏭️ Rotation Skipped',
          `Skipped to matchup **${newIndex + 1}** of ${total}.\n\n${formatMatchup(t1, t2, nameMap)}`,
          COLORS.warning,
        )],
      });
    }

    // ── preview ────────────────────────────────────────────────────────────
    if (sub === 'preview') {
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

      const ids     = rotState.player_discord_ids;
      const nameMap = await buildGuestNameMap(ids, guildId);
      const ordered = getOrderedMatchups(rotState);
      const total   = ordered.length;
      const preview = getPreviewMatchups(rotState, Math.min(4, total));

      const embed = new EmbedBuilder()
        .setTitle('🔮 Upcoming Matchup Preview')
        .setColor(COLORS.info)
        .setTimestamp();

      const labels = ['⚔️ Current Matchup', '⏭️ Next Matchup', '⏭️ Matchup +2', '⏭️ Matchup +3'];
      preview.forEach(({ matchup, position }, i) => {
        const [t1, t2] = matchup;
        embed.addFields({
          name: `${labels[i]} (Rotation ${position})`,
          value: formatMatchup(t1, t2, nameMap),
        });
      });

      embed.setFooter({ text: `${total} total matchups in rotation` });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── reorder ────────────────────────────────────────────────────────────
    if (sub === 'reorder') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [buildErrorEmbed('You need the **Manage Server** permission to reorder the rotation.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const fromPos = interaction.options.getInteger('from'); // 1-indexed
      const toPos   = interaction.options.getInteger('to');   // 1-indexed

      const { rotState, fetchError } = await fetchRotationState(guildId);
      if (fetchError) {
        return interaction.editReply({ embeds: [buildErrorEmbed(fetchError)] });
      }

      const ids     = rotState.player_discord_ids;
      const nameMap = await buildGuestNameMap(ids, guildId);
      const baseRotations = generateRotations(ids);
      const total = baseRotations.length;

      if (fromPos < 1 || fromPos > total) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(`**from** must be between 1 and ${total}.`)],
        });
      }
      if (toPos < 1 || toPos > total) {
        return interaction.editReply({
          embeds: [buildErrorEmbed(`**to** must be between 1 and ${total}.`)],
        });
      }
      if (fromPos === toPos) {
        return interaction.editReply({
          embeds: [buildErrorEmbed('**from** and **to** cannot be the same position.')],
        });
      }

      // Build the current order array (indices into baseRotations)
      const order = rotState.matchup_order && rotState.matchup_order.length === total
        ? [...rotState.matchup_order]
        : Array.from({ length: total }, (_, i) => i);

      // Track which base-rotation index the current matchup corresponds to
      const currentBaseIdx = order[rotState.current_index % total];

      // Move the item from fromPos-1 to toPos-1
      const [moved] = order.splice(fromPos - 1, 1);
      order.splice(toPos - 1, 0, moved);

      // Update current_index so the same matchup remains "current"
      const newCurrentIndex = order.indexOf(currentBaseIdx);

      const { error: updateErr } = await supabase
        .from('rotation_state')
        .update({
          matchup_order: order,
          current_index: newCurrentIndex,
          updated_at: new Date().toISOString(),
        })
        .eq('guild_id', guildId);

      if (updateErr) {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to reorder rotation.')] });
      }

      // Build a preview of the updated sequence
      const lines = order.map((baseIdx, i) => {
        const [t1, t2] = baseRotations[baseIdx];
        const t1str = t1.map(id => fmtPlayer(id, nameMap)).join(' & ');
        const t2str = t2.map(id => fmtPlayer(id, nameMap)).join(' & ');
        const arrow = i === newCurrentIndex ? ' ← **current**' : '';
        return `**${i + 1}.** ${t1str} vs ${t2str}${arrow}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🔀 Rotation Reordered')
        .setColor(COLORS.success)
        .setTimestamp()
        .addFields({
          name: `🔄 Updated Matchup Order (${total} total)`,
          value: lines.join('\n'),
        })
        .setFooter({ text: 'This order will be followed for all future matchups' });

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
