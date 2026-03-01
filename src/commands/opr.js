const { SlashCommandBuilder } = require('discord.js');
const { GAME_SYSTEMS } = require('../utils/embeds');

const register = require('./register');
const report   = require('./report');
const stats    = require('./stats');
const schedule = require('./schedule');
const players  = require('./players');
const rotation = require('./rotation');
const setup    = require('./setup');

const SYSTEMS = Object.keys(GAME_SYSTEMS).map(name => ({ name, value: name }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('opr')
    .setDescription('One Page Rules bot commands')

    // ── Direct subcommands ──────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName('register')
      .setDescription('Register yourself as a player for game tracking and 2v2 rotation')
      .addUserOption(o => o
        .setName('user')
        .setDescription('Admin only: register another Discord member by mention')
        .setRequired(false)
      )
      .addStringOption(o => o
        .setName('name')
        .setDescription('Admin only: register a non-Discord player by name')
        .setRequired(false)
      )
    )
    .addSubcommand(sub => sub
      .setName('stats')
      .setDescription('View One Page Rules game statistics for this server')
      .addStringOption(o => o
        .setName('filter')
        .setDescription('Filter by game system')
        .setRequired(false)
        .addChoices(
          { name: 'All systems',                value: 'all' },
          { name: 'Age of Fantasy',             value: 'Age of Fantasy' },
          { name: 'Grimdark Future',            value: 'Grimdark Future' },
          { name: 'Age of Fantasy: Skirmish',   value: 'Age of Fantasy: Skirmish' },
          { name: 'Grimdark Future: Firefight', value: 'Grimdark Future: Firefight' },
        )
      )
    )

    // ── report ──────────────────────────────────────────────────────────────
    .addSubcommandGroup(group => group
      .setName('report')
      .setDescription('Report the result of a One Page Rules game')
      .addSubcommand(sub => sub
        .setName('1v1')
        .setDescription('Report a 1v1 game result')
        .addStringOption(o => o.setName('system').setDescription('Game system').setRequired(true).addChoices(...SYSTEMS))
        .addIntegerOption(o => o.setName('points').setDescription('Army points per player').setRequired(true).setMinValue(1))
        .addUserOption(o => o.setName('winner').setDescription('The winning player').setRequired(true))
        .addStringOption(o => o.setName('winner_faction').setDescription("Winning player's faction").setRequired(true))
        .addUserOption(o => o.setName('loser').setDescription('The losing player').setRequired(true))
        .addStringOption(o => o.setName('loser_faction').setDescription("Losing player's faction").setRequired(true))
      )
      .addSubcommand(sub => sub
        .setName('2v2')
        .setDescription('Report a 2v2 co-op game result')
        .addStringOption(o => o.setName('system').setDescription('Game system').setRequired(true).addChoices(...SYSTEMS))
        .addIntegerOption(o => o.setName('points').setDescription('Army points per player').setRequired(true).setMinValue(1))
        .addUserOption(o => o.setName('winner1').setDescription('Winning team — player 1').setRequired(true))
        .addStringOption(o => o.setName('winner1_faction').setDescription("Winner 1's faction").setRequired(true))
        .addUserOption(o => o.setName('winner2').setDescription('Winning team — player 2').setRequired(true))
        .addStringOption(o => o.setName('winner2_faction').setDescription("Winner 2's faction").setRequired(true))
        .addUserOption(o => o.setName('loser1').setDescription('Losing team — player 1').setRequired(true))
        .addStringOption(o => o.setName('loser1_faction').setDescription("Loser 1's faction").setRequired(true))
        .addUserOption(o => o.setName('loser2').setDescription('Losing team — player 2').setRequired(true))
        .addStringOption(o => o.setName('loser2_faction').setDescription("Loser 2's faction").setRequired(true))
      )
    )

    // ── schedule ────────────────────────────────────────────────────────────
    .addSubcommandGroup(group => group
      .setName('schedule')
      .setDescription('Manage the upcoming game schedule')
      .addSubcommand(sub => sub
        .setName('set')
        .setDescription('Schedule a game (admin only)')
        .addStringOption(o => o.setName('date').setDescription('Date in YYYY-MM-DD format (UTC)').setRequired(true))
        .addStringOption(o => o.setName('time').setDescription('Time in HH:MM format (UTC), e.g. 14:00').setRequired(true))
        .addStringOption(o => o
          .setName('type')
          .setDescription('Game format')
          .setRequired(true)
          .addChoices(
            { name: '1v1', value: '1v1' },
            { name: '2v2', value: '2v2' },
          ))
        .addStringOption(o => o.setName('note').setDescription('Optional note (location, bring snacks, etc.)').setRequired(false))
      )
      .addSubcommand(sub => sub
        .setName('view')
        .setDescription('View upcoming scheduled games')
      )
      .addSubcommand(sub => sub
        .setName('clear')
        .setDescription('Remove a scheduled game by its number in the list (admin only)')
        .addIntegerOption(o => o.setName('number').setDescription('Game number from /opr schedule view').setRequired(true).setMinValue(1))
      )
    )

    // ── players ─────────────────────────────────────────────────────────────
    .addSubcommandGroup(group => group
      .setName('players')
      .setDescription('Manage the registered player roster')
      .addSubcommand(sub => sub
        .setName('list')
        .setDescription('List all registered players')
      )
      .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('Remove a player from the roster (admin only)')
        .addUserOption(o => o.setName('player').setDescription('Discord user to remove').setRequired(false))
        .addStringOption(o => o.setName('name').setDescription('Name of a guest player (added by name) to remove').setRequired(false))
      )
    )

    // ── rotation ────────────────────────────────────────────────────────────
    .addSubcommandGroup(group => group
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
      )
      .addSubcommand(sub => sub
        .setName('skip')
        .setDescription('Skip forward one matchup without reporting a game (admin only)')
      )
      .addSubcommand(sub => sub
        .setName('preview')
        .setDescription('Preview the next 4 upcoming matchups')
      )
      .addSubcommand(sub => sub
        .setName('reorder')
        .setDescription('Move a matchup to a different position in the rotation (admin only)')
        .addIntegerOption(o => o
          .setName('from')
          .setDescription('Current position number of the matchup to move (from /opr rotation view)')
          .setRequired(true)
          .setMinValue(1)
        )
        .addIntegerOption(o => o
          .setName('to')
          .setDescription('New position number to move it to')
          .setRequired(true)
          .setMinValue(1)
        )
      )
    )

    // ── setup ───────────────────────────────────────────────────────────────
    .addSubcommandGroup(group => group
      .setName('setup')
      .setDescription('Configure bot settings for this server (admin only)')
      .addSubcommand(sub => sub
        .setName('channel')
        .setDescription('Set the channel for weekly reminders')
        .addChannelOption(o => o.setName('channel').setDescription('The channel to post weekly reminders in').setRequired(true))
      )
      .addSubcommand(sub => sub
        .setName('day')
        .setDescription('Set the day of week for weekly reminders')
        .addStringOption(o => o
          .setName('day')
          .setDescription('Day of week')
          .setRequired(true)
          .addChoices(
            { name: 'Sunday',    value: '0' },
            { name: 'Monday',    value: '1' },
            { name: 'Tuesday',   value: '2' },
            { name: 'Wednesday', value: '3' },
            { name: 'Thursday',  value: '4' },
            { name: 'Friday',    value: '5' },
            { name: 'Saturday',  value: '6' },
          ))
      )
      .addSubcommand(sub => sub
        .setName('time')
        .setDescription('Set the UTC hour for weekly reminders (0–23)')
        .addIntegerOption(o => o.setName('hour').setDescription('Hour in UTC (0–23)').setRequired(true).setMinValue(0).setMaxValue(23))
      )
      .addSubcommand(sub => sub
        .setName('view')
        .setDescription('View current bot configuration')
      )
      .addSubcommand(sub => sub
        .setName('clear')
        .setDescription('Remove reminder settings for a specific channel (admin only)')
        .addChannelOption(o => o.setName('channel').setDescription('The channel to remove reminders for').setRequired(true))
      )
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    if (group === 'report')   return report.execute(interaction);
    if (group === 'schedule') return schedule.execute(interaction);
    if (group === 'players')  return players.execute(interaction);
    if (group === 'rotation') return rotation.execute(interaction);
    if (group === 'setup')    return setup.execute(interaction);

    if (sub === 'register') return register.execute(interaction);
    if (sub === 'stats')    return stats.execute(interaction);
  },
};
