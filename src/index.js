require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config  = require('./config');
const { loadCommands } = require('./commands');
const { handleInteraction } = require('./handlers/interactionHandler');
const { startScheduler } = require('./scheduler/weeklyReminder');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
loadCommands(client);

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);
  startScheduler(client);
});

client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction, client);
});

client.on('error', (err) => {
  console.error('Discord client error:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

client.login(config.discordToken);
