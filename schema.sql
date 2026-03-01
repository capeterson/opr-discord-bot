-- OPR Discord Bot — Supabase Schema
-- Run this in your Supabase SQL Editor to set up all required tables.

-- Players registered in a guild (used for 2v2 rotation)
CREATE TABLE IF NOT EXISTS players (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_id  TEXT        NOT NULL,
  guild_id    TEXT        NOT NULL,
  discord_name TEXT       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(discord_id, guild_id)
);

-- Game records
CREATE TABLE IF NOT EXISTS games (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id    TEXT        NOT NULL,
  game_date   TIMESTAMPTZ DEFAULT NOW(),
  game_system TEXT        NOT NULL,   -- e.g. 'Age of Fantasy', 'Grimdark Future'
  game_type   TEXT        NOT NULL CHECK (game_type IN ('1v1', '2v2')),
  army_points INTEGER     NOT NULL,   -- points per player
  reported_by TEXT        NOT NULL,   -- discord_id of the reporter
  is_tie      BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS games_guild_id_idx ON games(guild_id);
CREATE INDEX IF NOT EXISTS games_game_date_idx ON games(game_date);

-- Participants in each game
CREATE TABLE IF NOT EXISTS game_participants (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id       UUID    REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  discord_id    TEXT    NOT NULL,
  discord_name  TEXT    NOT NULL,
  team          INTEGER NOT NULL CHECK (team IN (1, 2)),
  faction       TEXT,                   -- nullable; captured in form or via "Add My Details"
  won           BOOLEAN NOT NULL,
  army_name     TEXT,                   -- filled in by player via "Add My Details"
  army_forge_url TEXT,                  -- OPR Army Forge share URL
  player_notes  TEXT,
  game_feeling  TEXT,                   -- emoji identifier (e.g. 'amazing', 'fun')
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_participants_game_id_idx ON game_participants(game_id);
CREATE INDEX IF NOT EXISTS game_participants_discord_id_idx ON game_participants(discord_id);

-- ── Migration: component-based report form (run once on existing databases) ──
-- ALTER TABLE game_participants ALTER COLUMN faction DROP NOT NULL;
-- ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS army_name      TEXT;
-- ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS army_forge_url TEXT;
-- ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS player_notes   TEXT;
-- ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS game_feeling   TEXT;
-- ALTER TABLE games ADD COLUMN IF NOT EXISTS is_tie BOOLEAN DEFAULT FALSE;

-- Upcoming game schedule
CREATE TABLE IF NOT EXISTS game_schedule (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id   TEXT        NOT NULL,
  game_date  TIMESTAMPTZ NOT NULL,
  game_type  TEXT        NOT NULL CHECK (game_type IN ('1v1', '2v2')),
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_schedule_guild_id_idx ON game_schedule(guild_id);
CREATE INDEX IF NOT EXISTS game_schedule_game_date_idx ON game_schedule(game_date);

-- Per-server bot configuration
CREATE TABLE IF NOT EXISTS server_config (
  id                  UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id            TEXT  UNIQUE NOT NULL,
  reminder_channel_id TEXT,
  -- Day of week for weekly reminder: 0=Sunday, 1=Monday, ..., 6=Saturday
  reminder_day        INTEGER DEFAULT 1 CHECK (reminder_day BETWEEN 0 AND 6),
  -- UTC hour (0–23) at which to send the reminder
  reminder_hour       INTEGER DEFAULT 9 CHECK (reminder_hour BETWEEN 0 AND 23),
  -- ISO date string (YYYY-MM-DD) of the last day a reminder was sent
  last_reminder_date  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2v2 team rotation state
CREATE TABLE IF NOT EXISTS rotation_state (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id            TEXT    UNIQUE NOT NULL,
  -- Ordered list of player discord_ids used to generate matchups
  player_discord_ids  TEXT[]  NOT NULL DEFAULT '{}',
  -- Index into the generated rotation list (points to the NEXT matchup)
  current_index       INTEGER DEFAULT 0,
  -- Optional custom matchup order: array of original matchup indices (e.g. [0, 2, 1]).
  -- NULL means use the natural order from generateRotations().
  matchup_order       INTEGER[],
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
