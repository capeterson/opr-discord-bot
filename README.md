# OPR Discord Bot

A Discord bot for tracking [One Page Rules](https://onepagerules.com/) game results, managing 2v2 team rotations, scheduling games, and viewing statistics — all within your Discord server.

---

## Table of Contents

- [Overview](#overview)
- [Supported Game Systems](#supported-game-systems)
- [Getting Started (Admins)](#getting-started-admins)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Deploying Commands](#deploying-commands)
  - [Running the Bot](#running-the-bot)
  - [First-Time Server Setup](#first-time-server-setup)
- [Commands — Players](#commands--players)
  - [/opr register](#opr-register)
  - [/opr report](#opr-report)
  - [/opr stats](#opr-stats)
  - [/opr schedule view](#opr-schedule-view)
  - [/opr players list](#opr-players-list)
  - [/opr rotation view](#opr-rotation-view)
  - [/opr rotation preview](#opr-rotation-preview)
  - [/opr setup view](#opr-setup-view)
- [Commands — Guild Admins](#commands--guild-admins)
  - [/opr setup channel](#opr-setup-channel)
  - [/opr setup day](#opr-setup-day)
  - [/opr setup time](#opr-setup-time)
  - [/opr setup clear](#opr-setup-clear)
  - [/opr schedule set](#opr-schedule-set)
  - [/opr schedule clear](#opr-schedule-clear)
  - [/opr players remove](#opr-players-remove)
  - [/opr rotation setup](#opr-rotation-setup)
  - [/opr rotation reset](#opr-rotation-reset)
  - [/opr rotation skip](#opr-rotation-skip)
  - [/opr rotation reorder](#opr-rotation-reorder)
  - [/opr register (guest)](#opr-register-guest)
  - [/opr register (Discord user)](#opr-register-discord-user)
- [Weekly Reminders](#weekly-reminders)
- [2v2 Rotation System](#2v2-rotation-system)
- [Permissions Reference](#permissions-reference)
- [Troubleshooting](#troubleshooting)

---

## Overview

The OPR Discord Bot is designed for tabletop gaming groups who play One Page Rules games. It provides:

- **Game result tracking** — Record 1v1 and 2v2 game outcomes with factions
- **Statistics & leaderboards** — Win rates, faction performance, team records
- **2v2 team rotation** — Auto-generated matchup cycle so everyone plays everyone
- **Game scheduling** — Post upcoming game sessions with date, time, and notes
- **Weekly reminders** — Automated channel posts with stats and next matchup
- **Guest player support** — Register non-Discord players (in-person guests)

---

## Supported Game Systems

| System | Short Name |
|--------|-----------|
| Age of Fantasy | AoF |
| Age of Fantasy: Skirmish | AoF Skirmish |
| Grimdark Future | GDF |
| Grimdark Future: Firefight | GDF Firefight |

---

## Getting Started (Admins)

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Discord Application](https://discord.com/developers/applications) with a bot token
- A [Supabase](https://supabase.com/) project (free tier works fine)

### Installation

```bash
git clone <repository-url>
cd opr-discord-bot
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Your bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Your application's Client ID |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Your Supabase public (anon) API key |
| `DISCORD_GUILD_ID` | No | If set, commands deploy to this guild instantly; if omitted, commands deploy globally (up to 1 hour) |

The bot will exit on startup if any required variable is missing.

### Database Setup

Run the provided schema against your Supabase database. In the Supabase dashboard, open the **SQL Editor** and execute the contents of `schema.sql`.

### Deploying Commands

Register slash commands with Discord (run once, or after adding/changing commands):

```bash
npm run deploy
```

If `DISCORD_GUILD_ID` is set, commands appear in that server instantly. Global deployment can take up to 1 hour to propagate.

### Running the Bot

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

### First-Time Server Setup

Once the bot is in your server and running, follow these steps as a server admin:

1. **Configure a reminder channel:**
   ```
   /opr setup channel channel:#your-channel
   ```

2. **Set the reminder day:**
   ```
   /opr setup day day:Monday
   ```

3. **Set the reminder time (UTC):**
   ```
   /opr setup time hour:18
   ```

4. **Have all players register themselves:**
   ```
   /opr register
   ```

5. **Build the 2v2 rotation** (requires 4+ registered players, even number):
   ```
   /opr rotation setup
   ```

6. **Schedule your first game:**
   ```
   /opr schedule set date:2025-06-01 time:14:00 type:2v2 note:Pizza provided!
   ```

---

## Commands — Players

These commands are available to all server members.

---

### /opr register

Register yourself as a player for game tracking and 2v2 rotation.

```
/opr register
```

**Parameters:** None (for self-registration)

**Behavior:**
- Links your Discord account to the player roster for this server
- If you are already registered, updates your display name to match your current Discord name
- Once registered, you can report games and participate in the 2v2 rotation

**Example output:**
> ✅ You've been registered as **PlayerName**!

> **Admins:** See [/opr register (guest)](#opr-register-guest) and [/opr register (Discord user)](#opr-register-discord-user) to register other players.

---

### /opr report

Report the result of a One Page Rules game using an interactive form.

```
/opr report
```

**Parameters:** None — the command opens an interactive form.

**Form steps:**

1. **Setup** — Select game type (1v1 or 2v2) and game system. The form updates automatically once both are chosen.

2. **1v1 players & factions** — Select winner, loser, and a faction for each player from a dropdown list. Click **Set Army Points** to enter the point size via a small pop-up. Once all fields are filled, click **Submit Report**.

3. **2v2 teams & winner** — The current rotation matchup is pre-filled. Select which team won (or "Tie"), then click **Next: Select Factions**. Use **Override Teams** to select different players instead of the rotation matchup.

4. **2v2 factions** — Select a faction for each of the four players, then click **Submit Report**.

After the report is saved, a public result embed is posted to the channel with two buttons:

- **📝 Add My Details** — Each participant can add their army list name, an [Army Forge](https://army-forge.onepagerules.com/) share URL, personal notes, and how they felt about the game. Faction can also be set here.
- **🔧 Edit Report** — Admins (Manage Server) can correct any field in the report.

**Faction options** are shown as dropdown menus:
- Age of Fantasy / AoF Skirmish: Amazon Sisterhood, Ancestral Dwarves, Beastmen Ambushers, Custodian Brotherhood, Dark Elven Raiders, Disciples of Plague, Dwarven Guilds, Eternal Dynasty, Eternal Void, Goblin Pillagers, Halfling Militia, High Elf Kingdoms, Kingdom of Men, Orc Marauders, Ratmen Clans, Sylvan Elves, Undead Legions, Vampire Covens, Other
- Grimdark Future / GDF Firefight: Battle Brothers, Battle Sisters, Alien Hives, TAO Colony, Robot Legions, Havoc Brothers, Infected, Orc Marauders, Elven Jesters, Sector Rangers, Machine Cult, Dino Warriors, Jackals, Titan Legions, Custodian Brothers, Gene Warriors, Dwarf Guilds, Ratmen Clans, Imperial Guard, Squat Clans, Chaos Daemons, Other

**Notes:**
- The form is ephemeral (only visible to you). The result is posted publicly when you submit.
- Forms expire after 30 minutes of inactivity.
- Up to 25 registered players are shown in player select menus.
- Guest players (registered by name) appear with a "(guest)" label in the dropdowns.

---

### /opr stats

View game statistics and leaderboards for this server.

```
/opr stats [filter:<system>]
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter` | Choice | No | Filter all stats by a specific game system; defaults to all systems |

**Displays:**
- Total games played, broken down by 1v1 / 2v2 and by game system
- **Player leaderboard** — Top 5 players by wins, with losses and win rate
- **Top factions** — Factions ranked by number of wins
- **Top 2v2 teams** — Team pairings ranked by win rate
- **Matchup records** — Head-to-head records between specific team pairings
- **Recent games** — The last 5 reported game results

**Example:**
```
/opr stats
/opr stats filter:Grimdark Future
```

---

### /opr schedule view

View upcoming scheduled game sessions.

```
/opr schedule view
```

**Parameters:** None

**Displays:** Up to 10 upcoming scheduled games with:
- Date and time (UTC)
- Relative time (e.g., "in 3 days")
- Game format (1v1 or 2v2)
- Any notes set by an admin

---

### /opr players list

View all registered players on the server roster.

```
/opr players list
```

**Parameters:** None

**Displays:** All registered players with their names and registration dates.

---

### /opr rotation view

View the 2v2 team rotation — all matchups, the current one, and what's coming next.

```
/opr rotation view
```

**Parameters:** None

**Displays:**
- All players included in the rotation
- A numbered list of all matchup pairings in the current order (current matchup highlighted)
- The upcoming matchup for next week

The rotation advances automatically each time a 2v2 game is reported.

---

### /opr rotation preview

Preview the next 4 upcoming matchups from the current position.

```
/opr rotation preview
```

**Parameters:** None

**Displays:** Four matchup cards showing the current matchup and the next three after it, each labeled with their rotation position number.

Useful for planning ahead without needing to read the full rotation list.

---

### /opr setup view

View the current bot configuration for this server.

```
/opr setup view
```

**Parameters:** None

**Displays:**
- Reminder channel
- Reminder day of the week
- Reminder time (UTC)
- Date the last reminder was sent

---

## Commands — Guild Admins

These commands require the **Manage Server** permission.

---

### /opr setup channel

Set the Discord channel where weekly game reminders will be posted.

```
/opr setup channel channel:<#channel>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | Channel mention | Yes | The channel to post weekly reminders in |

**Example:**
```
/opr setup channel channel:#opr-gaming
```

---

### /opr setup day

Set the day of the week for weekly reminders.

```
/opr setup day day:<day>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `day` | Choice | Yes | Day of the week (Sunday – Saturday) |

**Example:**
```
/opr setup day day:Friday
```

---

### /opr setup time

Set the UTC hour at which weekly reminders are sent.

```
/opr setup time hour:<0-23>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hour` | Integer (0–23) | Yes | Hour in UTC (24-hour format) |

**Example:**
```
/opr setup time hour:18
```

This sets reminders to go out at 18:00 UTC (6:00 PM UTC). Adjust for your local time zone accordingly.

---

### /opr setup clear

Remove all reminder settings associated with a specific channel. Only clears settings if the channel provided is the currently configured reminder channel.

```
/opr setup clear channel:<#channel>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | Channel mention | Yes | The channel whose reminders should be removed |

**Behavior:**
- If the provided channel matches the server's configured reminder channel, all reminder settings (`channel`, `day`, `time`) are cleared and weekly reminders stop
- If the provided channel is not the current reminder channel, an error is returned — use `/opr setup view` to check which channel is configured

**Example:**
```
/opr setup clear channel:#opr-gaming
```

---

### /opr schedule set

Schedule an upcoming game session.

```
/opr schedule set date:<YYYY-MM-DD> time:<HH:MM> type:<1v1|2v2> [note:<text>]
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | Text (YYYY-MM-DD) | Yes | Date of the game in UTC |
| `time` | Text (HH:MM) | Yes | Time of the game in UTC (24-hour format) |
| `type` | Choice | Yes | Game format: `1v1` or `2v2` |
| `note` | Text | No | Optional note (location, bring snacks, etc.) |

**Validation:** The date must be in the future.

**Example:**
```
/opr schedule set date:2025-07-04 time:19:00 type:2v2 note:Bring pizza!
```

---

### /opr schedule clear

Remove a scheduled game from the list.

```
/opr schedule clear number:<n>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `number` | Integer (≥1) | Yes | The game number shown in `/opr schedule view` |

Run `/opr schedule view` first to see the number of the game you want to remove.

**Example:**
```
/opr schedule clear number:2
```

---

### /opr players remove

Remove a player from the server roster. Use either `player` or `name`, not both.

```
/opr players remove [player:<@user>] [name:<guest name>]
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `player` | User mention | Conditional | Discord user to remove |
| `name` | Text | Conditional | Name of a guest player to remove |

**Examples:**
```
# Remove a Discord user
/opr players remove player:@Alice

# Remove a guest (non-Discord) player
/opr players remove name:GuestPlayer
```

> **Note:** Removing a player does not delete their historical game records. It only removes them from the active roster and future rotation.

---

### /opr rotation setup

Build the 2v2 rotation from all currently registered players.

```
/opr rotation setup
```

**Parameters:** None

**Requirements:**
- At least **4 registered players**
- An **even number** of registered players

**What it does:**
- Generates every unique team pairing from the registered player list
- Saves the full rotation with the first matchup set as current
- Any previous rotation is overwritten

For example, with 4 players A, B, C, D the bot generates 3 matchups:
```
Matchup 1: A & B  vs  C & D
Matchup 2: A & C  vs  B & D
Matchup 3: A & D  vs  B & C
```

After all matchups are played, run `/opr rotation reset` to cycle back to the beginning.

> **Tip:** Run `/opr rotation setup` again any time the player roster changes (someone joins or leaves).

---

### /opr rotation reset

Reset the 2v2 rotation back to the first matchup.

```
/opr rotation reset
```

**Parameters:** None

Use this after all matchups in the current rotation have been played, or any time you want to restart from the beginning.

---

### /opr rotation skip

Skip forward one matchup without requiring a game to be reported.

```
/opr rotation skip
```

**Parameters:** None

**Behavior:**
- Advances `current_index` by one step, wrapping around if at the end of the rotation
- Responds with the new current matchup
- Does **not** record a game result — use `/opr report 2v2` for that

Useful when a scheduled game night is cancelled or a matchup needs to be passed over.

---

### /opr rotation reorder

Move a specific matchup to a different position in the rotation order. The change is persistent and affects all future matchups.

```
/opr rotation reorder from:<position> to:<position>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | Integer (≥1) | Yes | The current position number of the matchup to move (as shown in `/opr rotation view`) |
| `to` | Integer (≥1) | Yes | The new position number to move it to |

**Behavior:**
- The matchup at position `from` is lifted out and inserted at position `to`; all other matchups shift accordingly
- The currently active matchup remains the same — only its position number may change
- The updated order is saved to the database and persists across bot restarts
- Run `/opr rotation setup` to discard all custom ordering and regenerate the natural rotation

**Example:** Move matchup 4 to position 2, pushing the existing matchups 2 and 3 down by one:
```
/opr rotation reorder from:4 to:2
```

---

### /opr register (guest)

Register a non-Discord (guest) player by name. Useful for in-person players who don't have Discord.

```
/opr register name:<guest name>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | Text | Yes | The guest player's name |

**Example:**
```
/opr register name:Uncle Terry
```

Guest players can participate in games and the 2v2 rotation just like Discord users. To remove a guest, use `/opr players remove name:<guest name>`.

---

### /opr register (Discord user)

Register another Discord server member on their behalf. Useful when a player hasn't registered themselves yet.

```
/opr register user:<@user>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user` | User mention | Yes | The Discord member to register |

**Behavior:**
- Registers the mentioned user using their real Discord ID and current display name
- If they are already registered, refreshes their display name to match their current Discord name
- The registered user can immediately participate in games and the 2v2 rotation

**Example:**
```
/opr register user:@Alice
```

> **Note:** Unlike guest registration, this links the player to an actual Discord account so they can self-report games and receive mentions in reminders.

---

## Weekly Reminders

When configured, the bot sends an automated weekly reminder to a designated channel. The reminder includes:

- Upcoming scheduled games
- The current 2v2 rotation matchup
- A summary of recent game statistics

**How it works:**
1. The bot checks once per hour at the top of the hour (UTC)
2. It looks for servers whose configured reminder day and hour match the current UTC time
3. If the reminder hasn't been sent today, it posts to the configured channel and records today's date
4. Reminders are only sent once per day, even if the bot restarts

**Setup checklist:**
- [ ] `/opr setup channel` — Set the reminder channel
- [ ] `/opr setup day` — Set the reminder day
- [ ] `/opr setup time` — Set the reminder hour (UTC)

---

## 2v2 Rotation System

The rotation ensures every registered player partners with every other player exactly once before repeating.

**Algorithm:** One player is fixed on Team 1. The remaining n-1 players are cycled through all unique combinations to form the rest of Team 1 and all of Team 2.

**Example with 6 players (A, B, C, D, E, F):**

The bot generates C(5, 2) = 10 unique matchups:
```
 1: A & B  vs  C & D   (E & F sit out — only if applicable)
 2: A & B  vs  C & E
 ...and so on
```

> **Note:** With more than 4 players, the bot pairs everyone into 2-player teams and generates all unique team vs. team combinations. All registered players participate.

**Rotation lifecycle:**
1. Admin runs `/opr rotation setup` → rotation is built from current roster
2. Each time `/opr report 2v2` is used → rotation advances one step
3. After all matchups are played → admin runs `/opr rotation reset` to restart
4. If the roster changes → admin runs `/opr rotation setup` again to regenerate

---

## Permissions Reference

| Command | Who Can Use |
|---------|-------------|
| `/opr register` (self) | Everyone |
| `/opr register name:` (guest) | Admins (Manage Server) |
| `/opr register user:` (Discord user) | Admins (Manage Server) |
| `/opr report` | Everyone |
| `/opr stats` | Everyone |
| `/opr schedule view` | Everyone |
| `/opr schedule set` | Admins (Manage Server) |
| `/opr schedule clear` | Admins (Manage Server) |
| `/opr players list` | Everyone |
| `/opr players remove` | Admins (Manage Server) |
| `/opr rotation view` | Everyone |
| `/opr rotation preview` | Everyone |
| `/opr rotation setup` | Admins (Manage Server) |
| `/opr rotation reset` | Admins (Manage Server) |
| `/opr rotation skip` | Admins (Manage Server) |
| `/opr rotation reorder` | Admins (Manage Server) |
| `/opr setup view` | Everyone |
| `/opr setup channel` | Admins (Manage Server) |
| `/opr setup day` | Admins (Manage Server) |
| `/opr setup time` | Admins (Manage Server) |
| `/opr setup clear` | Admins (Manage Server) |

---

## Troubleshooting

**Commands don't appear after deploying**
- If `DISCORD_GUILD_ID` is not set, global commands can take up to 1 hour to appear. Set `DISCORD_GUILD_ID` for instant updates during development.
- Ensure the bot has been invited to the server with the `applications.commands` OAuth2 scope.

**Bot is online but doesn't respond**
- Verify the bot has permission to read and send messages in the channel.
- Check the console for error output.

**"Missing required environment variable" on startup**
- Ensure your `.env` file exists and all four required variables are set correctly.

**`/opr rotation setup` fails**
- You need at least 4 registered players and the count must be even. Use `/opr players list` to check the current roster, then have players use `/opr register` or use `/opr register name:` for guests.

**Weekly reminders aren't being sent**
- Confirm all three setup values are configured: `/opr setup view` should show a channel, day, and time.
- The bot checks once per hour at :00. Reminders will go out at the next matching UTC hour.
- Ensure the bot has permission to send messages in the configured channel.

**A player reported a game for the wrong users / with the wrong faction**
- Server admins can click the **🔧 Edit Report** button on the original result embed to correct any game details, including players, factions, and army points.
