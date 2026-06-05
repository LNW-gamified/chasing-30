-- ============================================================
-- baseball_events, baseball_experiences, and Northwest League MiLB teams
-- ============================================================

-- ── baseball_events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS baseball_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'all_star', 'home_run_derby', 'playoffs', 'world_series',
    'field_of_dreams', 'spring_training'
  )),
  description TEXT,
  image_url TEXT,
  is_annual BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE baseball_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read baseball_events"
  ON baseball_events FOR SELECT TO authenticated USING (true);

INSERT INTO baseball_events (name, slug, category, description, sort_order) VALUES
  ('MLB All-Star Game',              'mlb-all-star-game',          'all_star',       'The Midsummer Classic — the best players from both leagues in one spectacular game.',                           1),
  ('Home Run Derby',                 'home-run-derby',             'home_run_derby', 'The night before the All-Star Game — sluggers compete for the most home runs in a bracket-style competition.', 2),
  ('Wild Card Game',                 'wild-card-game',             'playoffs',       'Single-elimination playoff drama — every pitch could be the last.',                                             3),
  ('Division Series — ALDS',         'division-series-alds',       'playoffs',       'Best-of-five October baseball in the American League at its finest.',                                            4),
  ('Division Series — NLDS',         'division-series-nlds',       'playoffs',       'Best-of-five October baseball in the National League at its finest.',                                            5),
  ('Championship Series — ALCS',     'championship-series-alcs',   'playoffs',       'The American League pennant race climax — four wins from the World Series.',                                     6),
  ('Championship Series — NLCS',     'championship-series-nlcs',   'playoffs',       'The National League pennant race climax — four wins from the World Series.',                                     7),
  ('World Series',                   'world-series',               'world_series',   'The Fall Classic — baseball''s ultimate championship.',                                                          8),
  ('Field of Dreams Game',           'field-of-dreams-game',       'field_of_dreams','MLB''s annual game in the Dyersville Iowa cornfields — pure magic.',                                             9),
  ('Spring Training — Cactus League','spring-training-cactus',     'spring_training','Arizona spring training — 15 teams preparing for the season in the desert.',                                   10),
  ('Spring Training — Grapefruit League','spring-training-grapefruit','spring_training','Florida spring training — 15 teams preparing for the season in the sunshine.',                              11)
ON CONFLICT (slug) DO NOTHING;

-- ── baseball_experiences ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS baseball_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'USA',
  lat NUMERIC,
  lng NUMERIC,
  description TEXT,
  highlights TEXT[],
  hours TEXT,
  admission TEXT,
  website_url TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE baseball_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read baseball_experiences"
  ON baseball_experiences FOR SELECT TO authenticated USING (true);

INSERT INTO baseball_experiences (name, slug, city, state, country, lat, lng, description, highlights, admission, website_url, sort_order) VALUES
  (
    'National Baseball Hall of Fame', 'hall-of-fame', 'Cooperstown', 'NY', 'USA',
    42.6998, -74.9237,
    'The shrine of the game — inductees, historic artifacts, and the soul of baseball.',
    ARRAY['See original Babe Ruth artifacts', 'Walk the Hall of Fame gallery', 'Visit the library and research center', 'Browse the gift shop for exclusive items'],
    '$25 adults', 'baseballhall.org', 1
  ),
  (
    'Louisville Slugger Museum & Factory', 'louisville-slugger', 'Louisville', 'KY', 'USA',
    38.2527, -85.7585,
    'Where the world''s most famous bats are made — take the factory tour and swing history.',
    ARRAY['Watch bats being made on the factory floor', 'Hold a bat used by a MLB star', 'See the giant 120-foot bat outside', 'Build your own custom bat'],
    '$16 adults', 'sluggermuseum.com', 2
  ),
  (
    'Rawlings Baseball Factory', 'rawlings-factory', 'Turrialba', NULL, 'Costa Rica',
    9.9008, -83.6816,
    'The source of every official MLB baseball — witness hand-stitching at scale.',
    ARRAY['Watch baseballs being hand-stitched', 'See the quality control process', 'Learn the history of the official MLB baseball'],
    'Tour required', 'rawlings.com', 3
  ),
  (
    'Negro Leagues Baseball Museum', 'negro-leagues-museum', 'Kansas City', 'MO', 'USA',
    39.0997, -94.5786,
    'Honoring the legacy of Black players who shaped the game before integration.',
    ARRAY['The Field of Legends exhibit', 'Original Negro Leagues memorabilia', 'Stories of legends like Satchel Paige and Josh Gibson'],
    '$15 adults', 'nlbm.com', 4
  ),
  (
    'Field of Dreams Movie Site', 'field-of-dreams-site', 'Dyersville', 'IA', 'USA',
    42.4698, -91.2418,
    'The iconic movie site where "if you build it, they will come" became legend.',
    ARRAY['Walk onto the actual field', 'Stand in the corn', 'See the original farmhouse', 'Catch a game during summer'],
    'Free', 'fieldofdreamsmoviesite.com', 5
  ),
  (
    'Doubleday Field', 'doubleday-field', 'Cooperstown', 'NY', 'USA',
    42.7001, -74.9229,
    'Historic ballpark dating to 1920 steps from the Hall of Fame — one of baseball''s most sacred grounds.',
    ARRAY['Watch a game on a historic field', 'Feel the history of early baseball'],
    'Free to walk around', NULL, 6
  ),
  (
    'Fenway Park Tour', 'fenway-tour', 'Boston', 'MA', 'USA',
    42.3467, -71.0972,
    'Walk the warning track at America''s most beloved ballpark — see the Green Monster up close.',
    ARRAY['Walk on the field', 'Sit atop the Green Monster', 'See the press box', 'Visit the visitors clubhouse'],
    '$25 adults', 'redsox.com', 7
  ),
  (
    'Wrigley Field Tour', 'wrigley-tour', 'Chicago', 'IL', 'USA',
    41.9484, -87.6553,
    'Experience the Friendly Confines up close — ivy walls, hand-turned scoreboard, and 100 years of history.',
    ARRAY['Touch the ivy wall', 'See the hand-turned scoreboard', 'Walk the warning track', 'Visit the Cubs clubhouse'],
    '$30 adults', 'cubs.com', 8
  ),
  (
    'Yankee Stadium Tour', 'yankee-stadium-tour', 'Bronx', 'NY', 'USA',
    40.8296, -73.9262,
    'Monument Park, the dugout, and a century of championships.',
    ARRAY['Walk through Monument Park', 'See the Yankees dugout', 'Visit the press box', 'Museum of Yankees history'],
    '$30 adults', 'yankees.com', 9
  ),
  (
    'Dodger Stadium Tour', 'dodger-stadium-tour', 'Los Angeles', 'CA', 'USA',
    34.0739, -118.2400,
    'Hollywood''s ballpark — 60 years of history in the hills of Chavez Ravine.',
    ARRAY['Field level access', 'Press box tour', 'Dodgers clubhouse', 'Top of the stadium views'],
    '$25 adults', 'dodgers.com', 10
  ),
  (
    'Oracle Park Tour', 'oracle-park-tour', 'San Francisco', 'CA', 'USA',
    37.7786, -122.3893,
    'McCovey Cove, the bleachers, and one of baseball''s most scenic settings.',
    ARRAY['McCovey Cove walkway', 'Splash hit landing zone', 'Giants clubhouse', 'Panoramic bay views'],
    '$25 adults', 'sfgiants.com', 11
  )
ON CONFLICT (slug) DO NOTHING;

-- ── minor_league_stadiums: unique constraint + Northwest League seed ───────────

ALTER TABLE minor_league_stadiums
  ADD CONSTRAINT IF NOT EXISTS uq_minor_league_abbreviation UNIQUE (abbreviation);

INSERT INTO minor_league_stadiums
  (name, team, abbreviation, city, state, lat, lng, capacity, opened, surface, level, affiliate, affiliate_full, description, address, website_url)
VALUES
  ('Funko Field',        'Everett AquaSox',       'EVE', 'Everett',   'WA',  47.9790, -122.1815, 4000, 1984, 'Grass', 'High-A', 'SEA', 'Seattle Mariners',        'Home of the Everett AquaSox, High-A affiliate of the Seattle Mariners. Sits along the Snohomish River waterfront with views of the Olympic Mountains on clear days.',         '3802 Broadway, Everett, WA 98201',                   'https://www.milb.com/everett'),
  ('Avista Stadium',     'Spokane Indians',        'SPO', 'Spokane',   'WA',  47.6588, -117.4145, 6803, 1958, 'Grass', 'High-A', 'COL', 'Colorado Rockies',        'One of the oldest minor league stadiums in the Northwest, Avista Stadium has been a Spokane landmark since 1958.',                                                             '602 N Havana St, Spokane, WA 99202',                 'https://www.milb.com/spokane'),
  ('Ron Tonkin Field',   'Hillsboro Hops',         'HBO', 'Hillsboro', 'OR',  45.5220, -122.9898, 4500, 2013, 'Grass', 'High-A', 'ARI', 'Arizona Diamondbacks',    'Modern ballpark in the heart of the Tualatin Valley, home of the Hillsboro Hops — High-A affiliate of the Arizona Diamondbacks.',                                               '4460 NE Century Blvd, Hillsboro, OR 97124',          'https://www.milb.com/hillsboro'),
  ('PK Park',            'Eugene Emeralds',        'EUG', 'Eugene',    'OR',  44.0521, -123.0675, 4000, 2010, 'Grass', 'High-A', 'SF',  'San Francisco Giants',    'Located on the University of Oregon campus, PK Park offers a unique college-town minor league experience.',                                                                           '2760 Martin Luther King Jr Blvd, Eugene, OR 97401',  'https://www.milb.com/eugene'),
  ('Volcanoes Stadium',  'Salem-Keizer Volcanoes', 'SAL', 'Keizer',    'OR',  44.9901, -123.0329, 4500, 1997, 'Grass', 'High-A', 'SF',  'San Francisco Giants',    'Named after the nearby Cascade volcanoes, this stadium offers stunning views of Mount Jefferson on clear days.',                                                                      '6700 Field of Dreams Way NW, Keizer, OR 97303',      'https://www.milb.com/salem-keizer'),
  ('Nat Bailey Stadium', 'Vancouver Canadians',    'VAN', 'Vancouver', 'BC',  49.2488, -123.1104, 6500, 1951, 'Grass', 'High-A', 'TOR', 'Toronto Blue Jays',       'One of the most beloved minor league parks in North America — Nat Bailey Stadium has been a Vancouver institution since 1951 with stunning mountain views.',                       '4601 Ontario St, Vancouver, BC V5V 3H4',             'https://www.milb.com/vancouver'),
  ('Gesa Stadium',       'Tri-City Dust Devils',   'TRI', 'Pasco',     'WA',  46.2254, -119.1073, 6500, 1995, 'Grass', 'High-A', 'LAA', 'Los Angeles Angels',      'Home of the Tri-City Dust Devils serving the Kennewick-Pasco-Richland area in Eastern Washington.',                                                                                  '6200 Burden Blvd, Pasco, WA 99301',                  'https://www.milb.com/tri-city')
ON CONFLICT (abbreviation) DO NOTHING;
