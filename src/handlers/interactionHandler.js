const { MessageFlags } = require('discord.js');
const { buildErrorEmbed } = require('../utils/embeds');

/**
 * Route an incoming Discord interaction to the appropriate command handler.
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleInteraction(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  // Only respond inside guilds
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
}

module.exports = { handleInteraction };
