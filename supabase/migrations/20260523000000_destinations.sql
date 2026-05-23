-- ============================================================
-- Baseball Destinations: destinations, destination_visits,
-- and trip_type / destination_id columns on trips
-- ============================================================

-- ── destinations ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS destinations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  city        TEXT NOT NULL,
  state       TEXT,
  country     TEXT NOT NULL DEFAULT 'USA',
  type        TEXT NOT NULL CHECK (type IN ('hall_of_fame','special_event','historic_stadium','amateur','factory','other')),
  description TEXT,
  lat         DECIMAL,
  lng         DECIMAL,
  is_mlb_event BOOLEAN NOT NULL DEFAULT false,
  website_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read destinations"
  ON destinations FOR SELECT TO authenticated USING (true);

-- ── Seed curated destinations ──────────────────────────────────────────────────

INSERT INTO destinations (slug, name, city, state, country, type, description, lat, lng, is_mlb_event, website_url) VALUES
  -- Hall of Fame & Historic Sites
  ('hall_of_fame',      'National Baseball Hall of Fame',    'Cooperstown',   'NY', 'USA', 'hall_of_fame',     'The shrine of the game — inductees, historic artifacts, and the soul of baseball.',       42.6998, -74.9237, false, 'https://baseballhall.org'),
  ('field_of_dreams',   'Field of Dreams',                   'Dyersville',    'IA', 'USA', 'hall_of_fame',     'The iconic movie site where ''if you build it, they will come'' became legend.',             42.4698, -91.2418, false, 'https://fieldofdreamsmoviesite.com'),
  ('doubleday_field',   'Doubleday Field',                   'Cooperstown',   'NY', 'USA', 'hall_of_fame',     'Historic ballpark dating to 1920 steps from the Hall of Fame.',                            42.7001, -74.9229, false, null),
  ('negro_leagues',     'Negro Leagues Baseball Museum',     'Kansas City',   'MO', 'USA', 'hall_of_fame',     'Honoring the legacy of Black players who shaped the game before integration.',               39.0997, -94.5786, false, 'https://nlbm.com'),
  ('louisville_slugger','Louisville Slugger Museum & Factory','Louisville',   'KY', 'USA', 'factory',          'Where the world''s most famous bats are made — take the factory tour and swing history.',   38.2527, -85.7585, false, 'https://www.sluggermuseum.com'),
  ('baseball_reliquary','Baseball Reliquary',                'Monrovia',      'CA', 'USA', 'hall_of_fame',     'Alternative hall of fame celebrating the game''s rebels, mavericks, and outsiders.',         34.1478,-117.9998, false, 'https://baseballreliquary.org'),
  ('rawlings_factory',  'Rawlings Baseball Factory',         'Turrialba',      null, 'Costa Rica', 'factory',  'The source of every official MLB baseball — witness hand-stitching at scale.',                9.9008, -83.6816, false, null),

  -- MLB Special Events (location varies)
  ('all_star_game',     'MLB All-Star Game',                 'Various',        null, 'USA', 'special_event',   'The Midsummer Classic — the best from both leagues in one spectacular game.',                 null,   null,   true, 'https://mlb.com'),
  ('world_series',      'World Series',                      'Various',        null, 'USA', 'special_event',   'The Fall Classic — baseball''s ultimate championship.',                                      null,   null,   true, 'https://mlb.com'),
  ('wild_card_game',    'Wild Card Games',                   'Various',        null, 'USA', 'special_event',   'Single-elimination playoff drama — every pitch could be the last.',                          null,   null,   true, 'https://mlb.com'),
  ('division_series',   'Division Series (ALDS/NLDS)',       'Various',        null, 'USA', 'special_event',   'Best-of-five October baseball at its finest.',                                               null,   null,   true, 'https://mlb.com'),
  ('championship_series','Championship Series (ALCS/NLCS)', 'Various',        null, 'USA', 'special_event',   'The pennant race climax — two wins away from the World Series.',                             null,   null,   true, 'https://mlb.com'),
  ('opening_day',       'Opening Day',                       'Various',        null, 'USA', 'special_event',   'Baseball''s annual rebirth — hope springs eternal on Opening Day.',                          null,   null,   true, 'https://mlb.com'),
  ('dreams_game',       'Field of Dreams Game',              'Dyersville',    'IA', 'USA', 'special_event',   'MLB''s annual game in the Dyersville cornfields — pure magic.',                               42.4698, -91.2418, true, 'https://mlb.com'),
  ('llws',              'Little League World Series',        'Williamsport',  'PA', 'USA', 'special_event',   'Where young players from around the world chase their baseball dreams.',                      41.2412, -77.0011, false, 'https://llbws.org'),

  -- Iconic Historic Stadiums (tour visits)
  ('fenway_tour',       'Fenway Park Tour',                  'Boston',        'MA', 'USA', 'historic_stadium','Walk the warning track at America''s most beloved ballpark.',                                  42.3467, -71.0972, false, 'https://redsox.com'),
  ('wrigley_tour',      'Wrigley Field Tour',                'Chicago',       'IL', 'USA', 'historic_stadium','Experience the Friendly Confines up close — ivy walls, hand-turned scoreboard.',             41.9484, -87.6553, false, 'https://cubs.com'),
  ('yankee_tour',       'Yankee Stadium Tour',               'Bronx',         'NY', 'USA', 'historic_stadium','Monument Park, the dugout, and a century of championships.',                                  40.8296, -73.9262, false, 'https://yankees.com'),
  ('dodger_tour',       'Dodger Stadium Tour',               'Los Angeles',   'CA', 'USA', 'historic_stadium','Hollywood''s ballpark — 60+ years of history in the hills of Chavez Ravine.',                34.0739,-118.2400, false, 'https://dodgers.com'),
  ('oracle_tour',       'Oracle Park Tour',                  'San Francisco', 'CA', 'USA', 'historic_stadium','McCovey Cove, the bleachers, and one of baseball''s most scenic settings.',                   37.7786,-122.3893, false, 'https://sfgiants.com'),

  -- Amateur & Other
  ('college_ws',        'College World Series',              'Omaha',         'NE', 'USA', 'amateur',         'Eight college teams battle for the national championship at Charles Schwab Field.',           41.2565, -95.9345, false, 'https://ncaa.com'),
  ('cape_cod_league',   'Cape Cod Baseball League',          'Hyannis',       'MA', 'USA', 'amateur',         'Summer collegiate baseball at its best — tomorrow''s stars playing on Cape Cod.',             41.6528, -70.2845, false, 'https://capecodbaseball.org'),
  ('arizona_fall',      'Arizona Fall League',               'Scottsdale',    'AZ', 'USA', 'amateur',         'Top prospects from all 30 organizations play in the desert each fall.',                       33.4942,-111.9261, false, 'https://mlb.com/arizona-fall-league')
ON CONFLICT (slug) DO NOTHING;

-- ── destination_visits ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS destination_visits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  trip_id        UUID REFERENCES trips(id) ON DELETE SET NULL,
  visit_date     DATE NOT NULL,
  experience_type TEXT DEFAULT 'other' CHECK (experience_type IN ('tour','game','festival','pilgrimage','other')),
  notes          TEXT,
  moments        TEXT[],
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE destination_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read destination_visits"
  ON destination_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert destination_visits"
  ON destination_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update destination_visits"
  ON destination_visits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete destination_visits"
  ON destination_visits FOR DELETE TO authenticated USING (true);

-- ── Extend trips table ────────────────────────────────────────────────────────

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS trip_type       TEXT NOT NULL DEFAULT 'stadium' CHECK (trip_type IN ('stadium','destination')),
  ADD COLUMN IF NOT EXISTS destination_id  UUID REFERENCES destinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS experience_type TEXT DEFAULT 'other' CHECK (experience_type IN ('tour','game','festival','pilgrimage','other'));

-- start_date is used for ordering; add it if missing (may already exist)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_date   DATE;
