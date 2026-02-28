require('dotenv').config();
const { REST, Routes } = require('discord.js');
const config   = require('./config');
const { commands } = require('./commands');

const rest = new REST({ version: '10' }).setToken(config.discordToken);

async function deploy() {
  const body = commands.map(c => c.data.toJSON());

  try {
    if (config.guildId) {
      console.log(`Deploying ${body.length} commands to guild ${config.guildId}…`);
      const data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body },
      );
      console.log(`✅ Successfully deployed ${data.length} guild commands.`);
    } else {
      console.log(`Deploying ${body.length} commands globally…`);
      const data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body },
      );
      console.log(`✅ Successfully deployed ${data.length} global commands (may take up to 1 hour to propagate).`);
    }
  } catch (err) {
    console.error('❌ Deployment failed:', err);
    process.exit(1);
  }
}

deploy();
