-- ============================================================
-- Minor League detail page support tables
-- Adds: minor_league_food, minor_league_notes, minor_league_weather
-- Also ensures image_url column exists on minor_league_stadiums
-- and populates milb_team_id for the seeded Northwest League teams
-- ============================================================

-- Ensure image_url exists on minor_league_stadiums
ALTER TABLE minor_league_stadiums ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ── minor_league_food ─────────────────────────────────────────────────────────
-- Mirrors stadium_trending_food but keyed to minor_league_stadiums

CREATE TABLE IF NOT EXISTS minor_league_food (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id   UUID NOT NULL REFERENCES minor_league_stadiums(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  description  TEXT,
  is_classic   BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  season_year  INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE minor_league_food ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read minor_league_food"
  ON minor_league_food FOR SELECT TO authenticated USING (true);

-- ── minor_league_notes ────────────────────────────────────────────────────────
-- One note record per stadium (upserted by stadium_id)

CREATE TABLE IF NOT EXISTS minor_league_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id   UUID NOT NULL REFERENCES minor_league_stadiums(id) ON DELETE CASCADE,
  notes        TEXT,
  updated_by   UUID REFERENCES auth.users(id),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stadium_id)
);

ALTER TABLE minor_league_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage minor_league_notes"
  ON minor_league_notes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── minor_league_weather ──────────────────────────────────────────────────────
-- Monthly weather averages — same structure as stadium_weather but for MiLB

CREATE TABLE IF NOT EXISTS minor_league_weather (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id      UUID NOT NULL REFERENCES minor_league_stadiums(id) ON DELETE CASCADE,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  avg_high_temp   DECIMAL(5,1) NOT NULL,
  avg_precip_days DECIMAL(4,1) NOT NULL,
  avg_wind_speed  DECIMAL(4,1) NOT NULL,
  rating          TEXT NOT NULL CHECK (rating IN ('great', 'good', 'fair', 'avoid')),
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stadium_id, month)
);

ALTER TABLE minor_league_weather ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read minor_league_weather"
  ON minor_league_weather FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert minor_league_weather"
  ON minor_league_weather FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update minor_league_weather"
  ON minor_league_weather FOR UPDATE TO authenticated USING (true);

-- ── milb_team_id seed for Northwest League teams ──────────────────────────────

UPDATE minor_league_stadiums SET milb_team_id = 572 WHERE abbreviation = 'EVE' AND (milb_team_id IS NULL OR milb_team_id = 0);
UPDATE minor_league_stadiums SET milb_team_id = 527 WHERE abbreviation = 'SPO' AND (milb_team_id IS NULL OR milb_team_id = 0);
UPDATE minor_league_stadiums SET milb_team_id = 559 WHERE abbreviation = 'HBO' AND (milb_team_id IS NULL OR milb_team_id = 0);
UPDATE minor_league_stadiums SET milb_team_id = 562 WHERE abbreviation = 'EUG' AND (milb_team_id IS NULL OR milb_team_id = 0);
UPDATE minor_league_stadiums SET milb_team_id = 554 WHERE abbreviation = 'SAL' AND (milb_team_id IS NULL OR milb_team_id = 0);
UPDATE minor_league_stadiums SET milb_team_id = 584 WHERE abbreviation = 'VAN' AND (milb_team_id IS NULL OR milb_team_id = 0);
UPDATE minor_league_stadiums SET milb_team_id = 547 WHERE abbreviation = 'TRI' AND (milb_team_id IS NULL OR milb_team_id = 0);
