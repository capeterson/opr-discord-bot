# CLAUDE.md — OPR Discord Bot Project Overview

This file gives Claude Code a fast, token-efficient orientation to the codebase so it can work without re-examining files on every request.

---

## Mandatory Rules for Claude Code

1. **All new commands MUST be sub-commands of `/opr`.**
   Never create a new top-level slash command. Every feature exposed to Discord users is added as a subcommand (or subcommand group + subcommand) under the existing `/opr` root, defined in `src/commands/opr.js`.

2. **Update both `README.md` and `CLAUDE.md` when adding or changing any command.**
   This is required — not optional. If a command is added, removed, renamed, or its options change, both files must be updated in the same commit as the code change.

---

## Project at a Glance

| Item | Value |
|------|-------|
| Runtime | Node.js ≥ 18 |
| Framework | discord.js ^14 |
| Database | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Scheduling | `node-cron` (hourly tick, weekly reminders) |
| Entry point | `src/index.js` |
| Command deploy | `npm run deploy` → `src/deploy-commands.js` |
| Dev server | `npm run dev` (nodemon) |
| Prod server | `npm start` |

---

## Directory Structure

```
src/
├── index.js                  # Bot entry point; registers events, starts scheduler
├── config.js                 # Loads and validates env vars
├── deploy-commands.js        # Registers slash commands with Discord API
├── commands/
│   ├── index.js              # Exports loadCommands(); imports all command files
│   ├── opr.js                # SlashCommandBuilder for the entire /opr tree
│   ├── register.js           # /opr register logic
│   ├── report.js             # /opr report 1v1 and 2v2 logic
│   ├── stats.js              # /opr stats logic
│   ├── players.js            # /opr players list/remove logic
│   ├── schedule.js           # /opr schedule set/view/clear logic
│   ├── rotation.js           # /opr rotation setup/view/reset logic
│   └── setup.js              # /opr setup channel/day/time/view/clear logic
├── handlers/
│   └── interactionHandler.js # Routes interactions to command handlers; top-level error handling
├── database/
│   └── supabase.js           # Supabase client singleton
├── utils/
│   ├── embeds.js             # Discord embed builders (report, stats, reminder, error, info)
│   ├── stats.js              # computeStats(), topN(), winRate()
│   └── rotation.js           # generateRotations(), getCurrentMatchup(), getNextMatchup()
└── scheduler/
    └── weeklyReminder.js     # Cron job: sends weekly game-night reminder to configured channels
```

Root-level files of note: `schema.sql` (Supabase DDL), `.env.example`, `README.md`.

---

## Command Tree

All commands live under `/opr`. The full tree:

```
/opr
├── register                         # Self-register; or admin registers user/guest
├── stats [system]                   # Leaderboard, faction stats, matchup records
├── report
│   ├── 1v1  <system> <points> <winner> <winner_faction> <loser> <loser_faction>
│   └── 2v2  <system> <points> <w1> <w1f> <w2> <w2f> <l1> <l1f> <l2> <l2f>
├── schedule
│   ├── set   <date> <time> <type> [note]   # Admin
│   ├── view                                # Everyone
│   └── clear <number>                      # Admin
├── players
│   ├── list                                # Everyone
│   └── remove <user|name>                  # Admin
├── rotation
│   ├── setup                               # Admin — generates matchup rotation
│   ├── view                                # Everyone
│   └── reset                               # Admin
└── setup
    ├── view                                # Everyone
    ├── channel <channel>                   # Admin
    ├── day     <day>                       # Admin
    ├── time    <hour>                      # Admin
    └── clear                               # Admin
```

Admin commands require the "Manage Server" Discord permission.

---

## Database Schema (Supabase)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `players` | `discord_id`, `guild_id`, `discord_name` | Registered players (Discord + guests) |
| `games` | `guild_id`, `game_date`, `game_system`, `game_type`, `army_points` | Game records |
| `game_participants` | `game_id`, `discord_id`, `discord_name`, `team`, `faction`, `won` | Per-player game participation |
| `game_schedule` | `guild_id`, `game_date`, `game_type`, `note` | Upcoming scheduled games |
| `server_config` | `guild_id`, `reminder_channel_id`, `reminder_day`, `reminder_hour`, `last_reminder_date` | Per-guild bot settings |
| `rotation_state` | `guild_id`, `player_discord_ids[]`, `current_index` | 2v2 rotation state |

Guest players use a UUID (not a numeric Discord ID) as their `discord_id`.
Discord users are displayed as `<@discord_id>` mentions; guests as bold names.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_CLIENT_ID` | Yes | Application client ID |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `DISCORD_GUILD_ID` | No | Guild ID for instant command deploy (omit for global) |

---

## Key Patterns & Conventions

- **Interaction flow:** `interactionCreate` → `handleInteraction()` → command handler function → Supabase query → embed reply.
- **Embeds:** All user-facing responses are Discord embeds built in `src/utils/embeds.js`. Use `buildErrorEmbed()` for errors and `buildInfoEmbed()` for neutral messages.
- **Error handling:** Command handlers `try/catch` and return ephemeral error embeds. Uncaught errors are caught in `interactionHandler.js`.
- **Ephemerals:** Error replies are ephemeral (only the invoking user sees them). Success replies are visible to the channel.
- **2v2 rotation algorithm:** Fixes the first player on Team 1 and enumerates all C(n-1, n/2-1) partner combinations — guarantees no duplicate matchups. Logic is in `src/utils/rotation.js`.
- **Weekly reminder:** `weeklyReminder.js` runs a cron job at the top of every hour, checks `server_config` for matching day/hour, skips if `last_reminder_date` == today, then sends a stats summary embed.

---

## Supported Game Systems

| Display Name | Short |
|---|---|
| Age of Fantasy | AoF |
| Grimdark Future | GF |
| Age of Fantasy: Skirmish | AoF Skirmish |
| Grimdark Future: Firefight | GF Firefight |

System choices are hardcoded as `addChoices()` in `src/commands/opr.js`.

---

## Adding a New Sub-Command — Checklist

1. Add the subcommand (or subcommand group + subcommand) to the builder in `src/commands/opr.js`.
2. Implement the handler function in the relevant file under `src/commands/` (or create a new file and register it in `src/commands/index.js`).
3. Route the new subcommand in `src/handlers/interactionHandler.js`.
4. **Update `README.md`** with usage docs for the new command.
5. **Update `CLAUDE.md`** — add the command to the command tree above and any relevant sections.
6. Run `npm run deploy` to register the updated command schema with Discord.
