const { MessageFlags } = require('discord.js');
const { buildErrorEmbed } = require('../utils/embeds');
const { handleReportComponent, handleReportModal } = require('../components/reportComponentHandler');

/**
 * Route an incoming Discord interaction to the appropriate handler.
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleInteraction(interaction, client) {
  // ── Slash commands ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: 'This bot only works inside a server, not in DMs.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`Unknown command: ${interaction.commandName}`);
      return interaction.reply({
        embeds: [buildErrorEmbed('Unknown command.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing /${interaction.commandName}:`, err);
      const errorEmbed = buildErrorEmbed('An unexpected error occurred. Please try again.');
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
    return;
  }

  // ── Buttons and select menus ────────────────────────────────────────────────
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const id = interaction.customId;
    if (id.startsWith('rpt:') || id.startsWith('report:')) {
      try {
        await handleReportComponent(interaction);
      } catch (err) {
        console.error('Error handling report component:', err);
        const errorEmbed = buildErrorEmbed('An unexpected error occurred.');
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    }
    return;
  }

  // ── Modal submissions ───────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    if (id.startsWith('rpt:') || id.startsWith('report:')) {
      try {
        await handleReportModal(interaction);
      } catch (err) {
        console.error('Error handling report modal:', err);
        if (!interaction.replied) {
          await interaction.reply({
            content: 'An unexpected error occurred.',
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        }
      }
    }
    return;
  }
}

module.exports = { handleInteraction };
