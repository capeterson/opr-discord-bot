require('dotenv').config();

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId:     process.env.DISCORD_CLIENT_ID,
  guildId:      process.env.DISCORD_GUILD_ID || null,
  supabaseUrl:  process.env.SUPABASE_URL,
  supabaseKey:  process.env.SUPABASE_ANON_KEY,
};
