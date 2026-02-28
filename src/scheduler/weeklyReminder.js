const cron = require('node-cron');
const supabase = require('../database/supabase');
const { buildWeeklyReminderEmbed } = require('../utils/embeds');

/**
 * Check every guild's configuration and send a weekly reminder if due.
 * Runs on the :00 of every hour.
 */
async function checkAndSendReminders(client) {
  const now     = new Date();
  const todayUTC = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const dayUTC   = now.getUTCDay();   // 0=Sun … 6=Sat
  const hourUTC  = now.getUTCHours(); // 0–23

  const { data: configs, error } = await supabase
    .from('server_config')
    .select('*')
    .eq('reminder_day', dayUTC)
    .eq('reminder_hour', hourUTC)
    .not('reminder_channel_id', 'is', null);

  if (error) {
    console.error('[scheduler] Failed to fetch server configs:', error);
    return;
  }

  if (!configs || configs.length === 0) return;

  for (const config of configs) {
    // Skip if we already sent a reminder today
    if (config.last_reminder_date === todayUTC) continue;

    try {
      await sendReminder(client, config, todayUTC);
    } catch (err) {
      console.error(`[scheduler] Failed to send reminder for guild ${config.guild_id}:`, err);
    }
  }
}

async function sendReminder(client, config, todayUTC) {
  const guildId   = config.guild_id;
  const channelId = config.reminder_channel_id;

  // Fetch the channel
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`[scheduler] Channel ${channelId} not found or not a text channel (guild ${guildId})`);
    return;
  }

  // Fetch all game data
  const { data: games } = await supabase
    .from('games')
    .select('*, game_participants(*)')
    .eq('guild_id', guildId)
    .order('game_date', { ascending: false });

  // Fetch next scheduled game
  const { data: nextScheduled } = await supabase
    .from('game_schedule')
    .select('*')
    .eq('guild_id', guildId)
    .gte('game_date', new Date().toISOString())
    .order('game_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Fetch rotation state
  const { data: rotationState } = await supabase
    .from('rotation_state')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();

  const embed = buildWeeklyReminderEmbed(games || [], nextScheduled, rotationState);

  await channel.send({ embeds: [embed] });
  console.log(`[scheduler] Sent weekly reminder to guild ${guildId}, channel ${channelId}`);

  // Record that we sent a reminder today
  await supabase
    .from('server_config')
    .update({ last_reminder_date: todayUTC, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId);
}

/**
 * Start the weekly reminder cron job (checks at the top of every hour).
 * @param {import('discord.js').Client} client
 */
function startScheduler(client) {
  // Run at the start of every hour
  cron.schedule('0 * * * *', () => {
    checkAndSendReminders(client).catch(err => {
      console.error('[scheduler] Uncaught error:', err);
    });
  });

  console.log('[scheduler] Weekly reminder scheduler started (checks every hour)');
}

module.exports = { startScheduler };
