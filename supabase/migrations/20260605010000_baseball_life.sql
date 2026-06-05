-- ============================================================
-- Baseball Life: unified non-MLB baseball experience tracking
-- Replaces: minor_league_visits, minor_league_food, special_visits
-- Keeps: minor_league_stadiums (good data, referenced by foreign key)
-- ============================================================

-- Drop old fragmented tables
DROP TABLE IF EXISTS minor_league_food CASCADE;
DROP TABLE IF EXISTS minor_league_visits CASCADE;

-- ── Main table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS baseball_life_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Category
  category TEXT NOT NULL CHECK (category IN (
    'minor_league',
    'mlb_special_event',
    'spring_training',
    'pilgrimage'
  )),

  -- Is this an actual game (true) or a place visit (false)
  is_game BOOLEAN NOT NULL DEFAULT TRUE,

  -- Location
  venue TEXT,
  city TEXT,
  state TEXT,
  minor_league_stadium_id UUID REFERENCES minor_league_stadiums(id),
  mlb_stadium_id UUID REFERENCES stadiums(id),

  -- Game details (for is_game = TRUE)
  visit_date DATE NOT NULL,
  opponent TEXT,
  home_team TEXT,
  away_team TEXT,
  final_score_home INTEGER,
  final_score_away INTEGER,
  game_time TEXT,
  game_pk INTEGER,

  -- Event type labels
  event_type TEXT,

  -- Seat info
  ticket_section TEXT,
  ticket_row TEXT,
  ticket_seats TEXT[],
  ticket_confirmation TEXT,

  -- Rich data
  notes TEXT,
  moments TEXT[],
  photos TEXT[],
  game_data JSONB,
  weather_temp TEXT,
  weather_conditions TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE baseball_life_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own baseball life entries"
  ON baseball_life_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- ── Migrate existing special_visits data ──────────────────────────────────────

INSERT INTO baseball_life_entries (
  user_id, category, is_game, venue, city, state,
  visit_date, notes, moments, photos, event_type, game_pk,
  ticket_section, ticket_row, ticket_seats, ticket_confirmation
)
SELECT
  user_id,
  CASE
    WHEN visit_type = 'minor_league'                                            THEN 'minor_league'
    WHEN visit_type IN ('all_star','world_series','playoff','international')    THEN 'mlb_special_event'
    WHEN visit_type = 'spring_training'                                         THEN 'spring_training'
    ELSE 'pilgrimage'
  END,
  CASE
    WHEN visit_type = 'stadium_tour' THEN FALSE
    ELSE TRUE
  END,
  venue, city, state, visit_date, notes, moments, photos, visit_type, game_pk,
  ticket_section, ticket_row, ticket_seats, ticket_confirmation
FROM special_visits
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── Drop special_visits ───────────────────────────────────────────────────────

DROP TABLE IF EXISTS special_visits CASCADE;
