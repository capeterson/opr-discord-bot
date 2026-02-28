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
  - [/register](#register)
  - [/report](#report)
  - [/stats](#stats)
  - [/schedule view](#schedule-view)
  - [/players list](#players-list)
  - [/rotation view](#rotation-view)
  - [/setup view](#setup-view)
- [Commands — Guild Admins](#commands--guild-admins)
  - [/setup channel](#setup-channel)
  - [/setup day](#setup-day)
  - [/setup time](#setup-time)
  - [/schedule set](#schedule-set)
  - [/schedule clear](#schedule-clear)
  - [/players remove](#players-remove)
  - [/rotation setup](#rotation-setup)
  - [/rotation reset](#rotation-reset)
  - [/register (guest)](#register-guest)
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
   /setup channel channel:#your-channel
   ```

2. **Set the reminder day:**
   ```
   /setup day day:Monday
   ```

3. **Set the reminder time (UTC):**
   ```
   /setup time hour:18
   ```

4. **Have all players register themselves:**
   ```
   /register
   ```

5. **Build the 2v2 rotation** (requires 4+ registered players, even number):
   ```
   /rotation setup
   ```

6. **Schedule your first game:**
   ```
   /schedule set date:2025-06-01 time:14:00 type:2v2 note:Pizza provided!
   ```

---

## Commands — Players

These commands are available to all server members.

---

### /register

Register yourself as a player for game tracking and 2v2 rotation.

```
/register
```

**Parameters:** None (for self-registration)

**Behavior:**
- Links your Discord account to the player roster for this server
- If you are already registered, updates your display name to match your current Discord name
- Once registered, you can report games and participate in the 2v2 rotation

**Example output:**
> ✅ You've been registered as **PlayerName**!

---

### /report

Report the result of a One Page Rules game.

#### /report 1v1

Report a one-versus-one game result.

```
/report 1v1 system:<system> points:<points> winner:<@user> winner_faction:<faction> loser:<@user> loser_faction:<faction>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `system` | Choice | Yes | Game system (see [Supported Game Systems](#supported-game-systems)) |
| `points` | Integer (≥1) | Yes | Army points per player |
| `winner` | User mention | Yes | The player who won |
| `winner_faction` | Text | Yes | The winning player's army faction |
| `loser` | User mention | Yes | The player who lost |
| `loser_faction` | Text | Yes | The losing player's army faction |

**Example:**
```
/report 1v1 system:Grimdark Future points:1000 winner:@Alice winner_faction:Alien Hives loser:@Bob loser_faction:Humans
```

#### /report 2v2

Report a two-versus-two co-op game result. Automatically advances the 2v2 rotation to the next matchup.

```
/report 2v2 system:<system> points:<points> winner1:<@user> winner1_faction:<faction> winner2:<@user> winner2_faction:<faction> loser1:<@user> loser1_faction:<faction> loser2:<@user> loser2_faction:<faction>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `system` | Choice | Yes | Game system |
| `points` | Integer (≥1) | Yes | Army points per player |
| `winner1` | User mention | Yes | Winning team — player 1 |
| `winner1_faction` | Text | Yes | Winner 1's army faction |
| `winner2` | User mention | Yes | Winning team — player 2 |
| `winner2_faction` | Text | Yes | Winner 2's army faction |
| `loser1` | User mention | Yes | Losing team — player 1 |
| `loser1_faction` | Text | Yes | Loser 1's army faction |
| `loser2` | User mention | Yes | Losing team — player 2 |
| `loser2_faction` | Text | Yes | Loser 2's army faction |

**Example:**
```
/report 2v2 system:Age of Fantasy points:2000 winner1:@Alice winner1_faction:Elves winner2:@Bob winner2_faction:Dwarves loser1:@Carol loser1_faction:Orcs loser2:@Dave loser2_faction:Undead
```

**After reporting a 2v2 game**, the bot will confirm the result and display the next scheduled matchup from the rotation.

---

### /stats

View game statistics and leaderboards for this server.

```
/stats [filter:<system>]
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
/stats
/stats filter:Grimdark Future
```

---

### /schedule view

View upcoming scheduled game sessions.

```
/schedule view
```

**Parameters:** None

**Displays:** Up to 10 upcoming scheduled games with:
- Date and time (UTC)
- Relative time (e.g., "in 3 days")
- Game format (1v1 or 2v2)
- Any notes set by an admin

---

### /players list

View all registered players on the server roster.

```
/players list
```

**Parameters:** None

**Displays:** All registered players with their names and registration dates.

---

### /rotation view

View the 2v2 team rotation — all matchups, the current one, and what's coming next.

```
/rotation view
```

**Parameters:** None

**Displays:**
- All players included in the rotation
- A numbered list of all matchup pairings (current matchup highlighted)
- The upcoming matchup for next week

The rotation advances automatically each time a 2v2 game is reported.

---

### /setup view

View the current bot configuration for this server.

```
/setup view
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

### /setup channel

Set the Discord channel where weekly game reminders will be posted.

```
/setup channel channel:<#channel>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | Channel mention | Yes | The channel to post weekly reminders in |

**Example:**
```
/setup channel channel:#opr-gaming
```

---

### /setup day

Set the day of the week for weekly reminders.

```
/setup day day:<day>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `day` | Choice | Yes | Day of the week (Sunday – Saturday) |

**Example:**
```
/setup day day:Friday
```

---

### /setup time

Set the UTC hour at which weekly reminders are sent.

```
/setup time hour:<0-23>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hour` | Integer (0–23) | Yes | Hour in UTC (24-hour format) |

**Example:**
```
/setup time hour:18
```

This sets reminders to go out at 18:00 UTC (6:00 PM UTC). Adjust for your local time zone accordingly.

---

### /schedule set

Schedule an upcoming game session.

```
/schedule set date:<YYYY-MM-DD> time:<HH:MM> type:<1v1|2v2> [note:<text>]
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
/schedule set date:2025-07-04 time:19:00 type:2v2 note:Bring pizza!
```

---

### /schedule clear

Remove a scheduled game from the list.

```
/schedule clear number:<n>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `number` | Integer (≥1) | Yes | The game number shown in `/schedule view` |

Run `/schedule view` first to see the number of the game you want to remove.

**Example:**
```
/schedule clear number:2
```

---

### /players remove

Remove a player from the server roster. Use either `player` or `name`, not both.

```
/players remove [player:<@user>] [name:<guest name>]
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `player` | User mention | Conditional | Discord user to remove |
| `name` | Text | Conditional | Name of a guest player to remove |

**Examples:**
```
# Remove a Discord user
/players remove player:@Alice

# Remove a guest (non-Discord) player
/players remove name:GuestPlayer
```

> **Note:** Removing a player does not delete their historical game records. It only removes them from the active roster and future rotation.

---

### /rotation setup

Build the 2v2 rotation from all currently registered players.

```
/rotation setup
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

After all matchups are played, run `/rotation reset` to cycle back to the beginning.

> **Tip:** Run `/rotation setup` again any time the player roster changes (someone joins or leaves).

---

### /rotation reset

Reset the 2v2 rotation back to the first matchup.

```
/rotation reset
```

**Parameters:** None

Use this after all matchups in the current rotation have been played, or any time you want to restart from the beginning.

---

### /register (guest)

Register a non-Discord (guest) player by name. Useful for in-person players who don't have Discord.

```
/register name:<guest name>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | Text | Yes | The guest player's name |

**Example:**
```
/register name:Uncle Terry
```

Guest players can participate in games and the 2v2 rotation just like Discord users. To remove a guest, use `/players remove name:<guest name>`.

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
- [ ] `/setup channel` — Set the reminder channel
- [ ] `/setup day` — Set the reminder day
- [ ] `/setup time` — Set the reminder hour (UTC)

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
1. Admin runs `/rotation setup` → rotation is built from current roster
2. Each time `/report 2v2` is used → rotation advances one step
3. After all matchups are played → admin runs `/rotation reset` to restart
4. If the roster changes → admin runs `/rotation setup` again to regenerate

---

## Permissions Reference

| Command | Who Can Use |
|---------|-------------|
| `/register` (self) | Everyone |
| `/register name:` (guest) | Admins (Manage Server) |
| `/report 1v1` | Everyone |
| `/report 2v2` | Everyone |
| `/stats` | Everyone |
| `/schedule view` | Everyone |
| `/schedule set` | Admins (Manage Server) |
| `/schedule clear` | Admins (Manage Server) |
| `/players list` | Everyone |
| `/players remove` | Admins (Manage Server) |
| `/rotation view` | Everyone |
| `/rotation setup` | Admins (Manage Server) |
| `/rotation reset` | Admins (Manage Server) |
| `/setup view` | Everyone |
| `/setup channel` | Admins (Manage Server) |
| `/setup day` | Admins (Manage Server) |
| `/setup time` | Admins (Manage Server) |

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

**`/rotation setup` fails**
- You need at least 4 registered players and the count must be even. Use `/players list` to check the current roster, then have players use `/register` or use `/register name:` for guests.

**Weekly reminders aren't being sent**
- Confirm all three setup values are configured: `/setup view` should show a channel, day, and time.
- The bot checks once per hour at :00. Reminders will go out at the next matching UTC hour.
- Ensure the bot has permission to send messages in the configured channel.

**A player reported a game for the wrong users / with the wrong faction**
- Contact your server admin. There is no undo command; incorrect records must be removed directly from the database.
