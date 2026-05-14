-- ============================================================
-- Chasing 30 — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Stadiums (seeded static data — do not add user data here)
CREATE TABLE IF NOT EXISTS stadiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DECIMAL NOT NULL,
  lng DECIMAL NOT NULL,
  capacity INTEGER,
  opened INTEGER,
  surface TEXT,
  league TEXT NOT NULL CHECK (league IN ('AL', 'NL')),
  division TEXT NOT NULL CHECK (division IN ('East', 'Central', 'West')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stadium visits / GameDay records
CREATE TABLE IF NOT EXISTS stadium_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id UUID REFERENCES stadiums(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  home_team TEXT NOT NULL,
  visiting_team TEXT NOT NULL,
  home_team_record TEXT,
  visiting_team_record TEXT,
  seat_section TEXT,
  seat_row TEXT,
  seat_number TEXT,
  first_pitch_time TEXT,
  game_duration TEXT,
  temperature INTEGER,
  weather TEXT,
  attendance INTEGER,
  home_starter_name TEXT,
  home_starter_wl TEXT,
  home_starter_ip TEXT,
  home_starter_h INTEGER,
  home_starter_er INTEGER,
  home_starter_bb INTEGER,
  home_starter_k INTEGER,
  away_starter_name TEXT,
  away_starter_wl TEXT,
  away_starter_ip TEXT,
  away_starter_h INTEGER,
  away_starter_er INTEGER,
  away_starter_bb INTEGER,
  away_starter_k INTEGER,
  inning_scores JSONB DEFAULT '[]',
  home_runs INTEGER,
  home_hits INTEGER,
  home_errors INTEGER,
  home_lob INTEGER,
  away_runs INTEGER,
  away_hits INTEGER,
  away_errors INTEGER,
  away_lob INTEGER,
  winning_pitcher TEXT,
  losing_pitcher TEXT,
  save_pitcher TEXT,
  hp_umpire TEXT,
  first_base_umpire TEXT,
  second_base_umpire TEXT,
  third_base_umpire TEXT,
  photo_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip planning
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id UUID REFERENCES stadiums(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trip_date DATE,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  est_tickets DECIMAL(10,2) DEFAULT 0,
  est_travel DECIMAL(10,2) DEFAULT 0,
  est_hotel DECIMAL(10,2) DEFAULT 0,
  est_food DECIMAL(10,2) DEFAULT 0,
  est_parking DECIMAL(10,2) DEFAULT 0,
  actual_tickets DECIMAL(10,2) DEFAULT 0,
  actual_travel DECIMAL(10,2) DEFAULT 0,
  actual_hotel DECIMAL(10,2) DEFAULT 0,
  actual_food DECIMAL(10,2) DEFAULT 0,
  actual_parking DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE stadiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE stadium_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Stadiums: anyone authenticated can read (it's static seed data)
CREATE POLICY "Authenticated users can read stadiums"
  ON stadiums FOR SELECT TO authenticated USING (true);

-- Visits: all authenticated users share all visit data
CREATE POLICY "Authenticated users can read visits"
  ON stadium_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert visits"
  ON stadium_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update visits"
  ON stadium_visits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete visits"
  ON stadium_visits FOR DELETE TO authenticated USING (true);

-- Trips: all authenticated users share all trip data
CREATE POLICY "Authenticated users can read trips"
  ON trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert trips"
  ON trips FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update trips"
  ON trips FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete trips"
  ON trips FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Seed: All 30 MLB Stadiums
-- ============================================================

INSERT INTO stadiums (name, team, abbreviation, city, state, lat, lng, capacity, opened, surface, league, division) VALUES
  -- AL East
  ('Fenway Park', 'Boston Red Sox', 'BOS', 'Boston', 'MA', 42.3467, -71.0972, 37755, 1912, 'Grass', 'AL', 'East'),
  ('Yankee Stadium', 'New York Yankees', 'NYY', 'Bronx', 'NY', 40.8296, -73.9262, 47309, 2009, 'Grass', 'AL', 'East'),
  ('Camden Yards', 'Baltimore Orioles', 'BAL', 'Baltimore', 'MD', 39.2838, -76.6218, 44970, 1992, 'Grass', 'AL', 'East'),
  ('Tropicana Field', 'Tampa Bay Rays', 'TB', 'St. Petersburg', 'FL', 27.7682, -82.6534, 25000, 1990, 'AstroTurf', 'AL', 'East'),
  ('Rogers Centre', 'Toronto Blue Jays', 'TOR', 'Toronto', 'ON', 43.6414, -79.3894, 49286, 1989, 'AstroTurf', 'AL', 'East'),
  -- AL Central
  ('Guaranteed Rate Field', 'Chicago White Sox', 'CWS', 'Chicago', 'IL', 41.8299, -87.6338, 40615, 1991, 'Grass', 'AL', 'Central'),
  ('Progressive Field', 'Cleveland Guardians', 'CLE', 'Cleveland', 'OH', 41.4962, -81.6852, 34830, 1994, 'Grass', 'AL', 'Central'),
  ('Comerica Park', 'Detroit Tigers', 'DET', 'Detroit', 'MI', 42.3390, -83.0485, 41083, 2000, 'Grass', 'AL', 'Central'),
  ('Kauffman Stadium', 'Kansas City Royals', 'KC', 'Kansas City', 'MO', 39.0517, -94.4803, 37903, 1973, 'Grass', 'AL', 'Central'),
  ('Target Field', 'Minnesota Twins', 'MIN', 'Minneapolis', 'MN', 44.9817, -93.2776, 38544, 2010, 'Grass', 'AL', 'Central'),
  -- AL West
  ('Minute Maid Park', 'Houston Astros', 'HOU', 'Houston', 'TX', 29.7572, -95.3555, 41168, 2000, 'Grass', 'AL', 'West'),
  ('Angel Stadium', 'Los Angeles Angels', 'LAA', 'Anaheim', 'CA', 33.8003, -117.8827, 45517, 1966, 'Grass', 'AL', 'West'),
  ('Sutter Health Park', 'Oakland Athletics', 'OAK', 'Sacramento', 'CA', 38.5802, -121.5088, 14014, 2000, 'Grass', 'AL', 'West'),
  ('T-Mobile Park', 'Seattle Mariners', 'SEA', 'Seattle', 'WA', 47.5914, -122.3325, 47929, 1999, 'Grass', 'AL', 'West'),
  ('Globe Life Field', 'Texas Rangers', 'TEX', 'Arlington', 'TX', 32.7473, -97.0823, 40518, 2020, 'Grass', 'AL', 'West'),
  -- NL East
  ('Truist Park', 'Atlanta Braves', 'ATL', 'Cumberland', 'GA', 33.8908, -84.4678, 41084, 2017, 'Grass', 'NL', 'East'),
  ('loanDepot park', 'Miami Marlins', 'MIA', 'Miami', 'FL', 25.7781, -80.2197, 36742, 2012, 'Grass', 'NL', 'East'),
  ('Citi Field', 'New York Mets', 'NYM', 'Flushing', 'NY', 40.7571, -73.8458, 41922, 2009, 'Grass', 'NL', 'East'),
  ('Citizens Bank Park', 'Philadelphia Phillies', 'PHI', 'Philadelphia', 'PA', 39.9061, -75.1665, 42901, 2004, 'Grass', 'NL', 'East'),
  ('Nationals Park', 'Washington Nationals', 'WSH', 'Washington', 'DC', 38.8730, -77.0074, 41313, 2008, 'Grass', 'NL', 'East'),
  -- NL Central
  ('Wrigley Field', 'Chicago Cubs', 'CHC', 'Chicago', 'IL', 41.9484, -87.6553, 41649, 1914, 'Grass', 'NL', 'Central'),
  ('Great American Ball Park', 'Cincinnati Reds', 'CIN', 'Cincinnati', 'OH', 39.0979, -84.5082, 42319, 2003, 'Grass', 'NL', 'Central'),
  ('American Family Field', 'Milwaukee Brewers', 'MIL', 'Milwaukee', 'WI', 43.0280, -87.9712, 41900, 2001, 'Grass', 'NL', 'Central'),
  ('Busch Stadium', 'St. Louis Cardinals', 'STL', 'St. Louis', 'MO', 38.6226, -90.1928, 44494, 2006, 'Grass', 'NL', 'Central'),
  ('PNC Park', 'Pittsburgh Pirates', 'PIT', 'Pittsburgh', 'PA', 40.4469, -80.0057, 38362, 2001, 'Grass', 'NL', 'Central'),
  -- NL West
  ('Chase Field', 'Arizona Diamondbacks', 'ARI', 'Phoenix', 'AZ', 33.4453, -112.0667, 48519, 1998, 'Grass', 'NL', 'West'),
  ('Coors Field', 'Colorado Rockies', 'COL', 'Denver', 'CO', 39.7559, -104.9942, 50398, 1995, 'Grass', 'NL', 'West'),
  ('Dodger Stadium', 'Los Angeles Dodgers', 'LAD', 'Los Angeles', 'CA', 34.0739, -118.2400, 56000, 1962, 'Grass', 'NL', 'West'),
  ('Petco Park', 'San Diego Padres', 'SD', 'San Diego', 'CA', 32.7076, -117.1570, 40162, 2004, 'Grass', 'NL', 'West'),
  ('Oracle Park', 'San Francisco Giants', 'SF', 'San Francisco', 'CA', 37.7786, -122.3893, 41915, 2000, 'Grass', 'NL', 'West')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Stadium notes (pre-visit wishlist / notes per stadium)
-- Run these additions in the Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS stadium_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id UUID REFERENCES stadiums(id) ON DELETE CASCADE UNIQUE,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stadium_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stadium notes"
  ON stadium_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stadium notes"
  ON stadium_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stadium notes"
  ON stadium_notes FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- Special Events (non-regular-season baseball experiences)
-- ============================================================

CREATE TABLE IF NOT EXISTS special_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'world_series', 'all_star_game', 'postseason',
    'spring_training', 'minor_league', 'historic_ballpark',
    'international', 'other'
  )),
  event_date DATE NOT NULL,
  seat_section TEXT,
  seat_row TEXT,
  seat_number TEXT,
  weather TEXT,
  temperature INTEGER,
  attendance INTEGER,
  notes TEXT,
  photo_url TEXT,
  home_team TEXT,
  visiting_team TEXT,
  event_year INTEGER,
  game_number INTEGER,
  series_round TEXT,
  stadium_name TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  ml_level TEXT,
  venue_name TEXT,
  series_name TEXT,
  custom_title TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read special events"
  ON special_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert special events"
  ON special_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update special events"
  ON special_events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete special events"
  ON special_events FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Share tokens (public read-only progress link)
-- ============================================================

CREATE TABLE IF NOT EXISTS share_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read share tokens"
  ON share_tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can manage share tokens"
  ON share_tokens FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Public progress function (SECURITY DEFINER — no auth needed)
-- Called by the /share/[token] page using anon key
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_progress(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM share_tokens WHERE token::TEXT = p_token) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'stadiums_visited', (SELECT COUNT(DISTINCT stadium_id)::INT FROM stadium_visits),
    'games_attended', (SELECT COUNT(*)::INT FROM stadium_visits),
    'special_events_count', (SELECT COUNT(*)::INT FROM special_events),
    'all_stadiums', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'name', s.name, 'team', s.team,
          'abbreviation', s.abbreviation, 'city', s.city,
          'state', s.state, 'league', s.league, 'division', s.division
        ) ORDER BY s.name
      ) FROM stadiums s
    ), '[]'::JSONB),
    'visited_ids', COALESCE((
      SELECT jsonb_agg(DISTINCT stadium_id) FROM stadium_visits
    ), '[]'::JSONB),
    'recent_visits', COALESCE((
      SELECT jsonb_agg(row_to_json(v.*)::JSONB)
      FROM (
        SELECT sv.visit_date, sv.home_team, sv.visiting_team,
               sv.home_runs, sv.away_runs, sv.stadium_id
        FROM stadium_visits sv
        ORDER BY sv.visit_date DESC
        LIMIT 6
      ) v
    ), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_progress(TEXT) TO anon;

-- ============================================================
-- Trip Improvements: multi-stop itinerary + date range
-- Run this block in the Supabase SQL Editor
-- ============================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_date DATE;

CREATE TABLE IF NOT EXISTS trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  stadium_id UUID REFERENCES stadiums(id) ON DELETE CASCADE NOT NULL,
  game_date DATE,
  sort_order INTEGER DEFAULT 0,
  est_tickets DECIMAL(10,2) DEFAULT 0,
  est_food DECIMAL(10,2) DEFAULT 0,
  est_parking DECIMAL(10,2) DEFAULT 0,
  actual_tickets DECIMAL(10,2) DEFAULT 0,
  actual_food DECIMAL(10,2) DEFAULT 0,
  actual_parking DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read trip_stops"
  ON trip_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert trip_stops"
  ON trip_stops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update trip_stops"
  ON trip_stops FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete trip_stops"
  ON trip_stops FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Game-day enhancements: additional seats, MLB auto-stats
-- Run this block in the Supabase SQL Editor
-- ============================================================

ALTER TABLE stadium_visits ADD COLUMN IF NOT EXISTS additional_seats JSONB DEFAULT '[]';
ALTER TABLE stadium_visits ADD COLUMN IF NOT EXISTS mlb_game_pk INTEGER;
ALTER TABLE stadium_visits ADD COLUMN IF NOT EXISTS stats_auto_populated BOOLEAN DEFAULT FALSE;

-- Trip stop: optimizer-written game details
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS game_time TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS opponent TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS opponent_team_id INTEGER;
