const opr = require('./opr');

/** All commands exported as an array for easy iteration. */
const commands = [opr];

/**
 * Load all commands into the Discord client's command Collection.
 * @param {import('discord.js').Client} client
 */
function loadCommands(client) {
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
  console.log(`Loaded ${commands.length} commands: ${commands.map(c => c.data.name).join(', ')}`);
}

module.exports = { commands, loadCommands };
