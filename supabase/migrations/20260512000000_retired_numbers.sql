-- ============================================================
-- Migration: Retired Numbers
-- Creates table, RLS policies, and seeds all 30 MLB teams
-- ============================================================

CREATE TABLE IF NOT EXISTS retired_numbers (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID    NOT NULL REFERENCES stadiums(id) ON DELETE CASCADE,
  number       TEXT    NOT NULL,
  player_name  TEXT    NOT NULL,
  year_retired INTEGER NOT NULL,
  UNIQUE (team_id, number, player_name)
);

ALTER TABLE retired_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read retired numbers"
  ON retired_numbers FOR SELECT TO authenticated USING (true);

-- ── Seed ─────────────────────────────────────────────────────
-- number '42*' denotes Jackie Robinson's universal retirement.
-- Each team block is a single INSERT for idempotency.

-- Arizona Diamondbacks
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('42*', 'Jackie Robinson', 1997),
  ('51',  'Randy Johnson',   2022)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'ARI'
ON CONFLICT DO NOTHING;

-- Atlanta Braves
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('3',   'Dale Murphy',     1994),
  ('10',  'Chipper Jones',   2013),
  ('21',  'Warren Spahn',    1965),
  ('35',  'Phil Niekro',     1984),
  ('41',  'Eddie Mathews',   1969),
  ('42*', 'Jackie Robinson', 1997),
  ('44',  'Hank Aaron',      1977),
  ('47',  'Tom Glavine',     2010)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'ATL'
ON CONFLICT DO NOTHING;

-- Baltimore Orioles
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('4',   'Earl Weaver',     1982),
  ('5',   'Brooks Robinson', 1977),
  ('8',   'Cal Ripken Jr.',  2001),
  ('20',  'Frank Robinson',  1972),
  ('22',  'Jim Palmer',      1985),
  ('33',  'Eddie Murray',    1997),
  ('42*', 'Jackie Robinson', 1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'BAL'
ON CONFLICT DO NOTHING;

-- Boston Red Sox
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('1',   'Bobby Doerr',        1988),
  ('4',   'Joe Cronin',         1984),
  ('8',   'Carl Yastrzemski',   1989),
  ('9',   'Ted Williams',       1984),
  ('14',  'Jim Rice',           2009),
  ('27',  'Carlton Fisk',       2000),
  ('42*', 'Jackie Robinson',    1997),
  ('45',  'Pedro Martinez',     2015)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'BOS'
ON CONFLICT DO NOTHING;

-- Chicago Cubs
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('10',  'Ron Santo',          2003),
  ('14',  'Ernie Banks',        1982),
  ('23',  'Ryne Sandberg',      2005),
  ('26',  'Billy Williams',     1987),
  ('31',  'Ferguson Jenkins',   1982),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'CHC'
ON CONFLICT DO NOTHING;

-- Chicago White Sox
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('2',   'Nellie Fox',         1976),
  ('4',   'Luke Appling',       1975),
  ('9',   'Minnie Miñoso',      1983),
  ('11',  'Luis Aparicio',      1984),
  ('16',  'Ted Lyons',          1987),
  ('19',  'Billy Pierce',       1987),
  ('35',  'Frank Thomas',       2014),
  ('42*', 'Jackie Robinson',    1997),
  ('72',  'Carlton Fisk',       1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'CWS'
ON CONFLICT DO NOTHING;

-- Cincinnati Reds
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('1',   'Fred Hutchinson',    1965),
  ('5',   'Johnny Bench',       1984),
  ('8',   'Joe Morgan',         1998),
  ('11',  'Barry Larkin',       2014),
  ('18',  'Ted Kluszewski',     1998),
  ('24',  'Tony Perez',         2000),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'CIN'
ON CONFLICT DO NOTHING;

-- Cleveland Guardians
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('3',   'Earl Averill',       1975),
  ('5',   'Lou Boudreau',       1970),
  ('14',  'Larry Doby',         1994),
  ('18',  'Mel Harder',         1990),
  ('19',  'Bob Feller',         1957),
  ('21',  'Bob Lemon',          1998),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'CLE'
ON CONFLICT DO NOTHING;

-- Colorado Rockies
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('17',  'Todd Helton',        2014),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'COL'
ON CONFLICT DO NOTHING;

-- Detroit Tigers
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('2',   'Charlie Gehringer',  1983),
  ('5',   'Hank Greenberg',     1983),
  ('6',   'Al Kaline',          1980),
  ('16',  'Hal Newhouser',      1997),
  ('23',  'Willie Horton',      2000),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'DET'
ON CONFLICT DO NOTHING;

-- Houston Astros
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('5',   'Jeff Bagwell',       2022),
  ('7',   'Craig Biggio',       2022),
  ('32',  'Jim Umbricht',       1964),
  ('34',  'Nolan Ryan',         1996),
  ('40',  'Don Wilson',         1975),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'HOU'
ON CONFLICT DO NOTHING;

-- Kansas City Royals
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('5',   'George Brett',       1994),
  ('10',  'Dick Howser',        1987),
  ('20',  'Frank White',        1995),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'KC'
ON CONFLICT DO NOTHING;

-- Los Angeles Angels
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('11',  'Jim Fregosi',        1998),
  ('26',  'Gene Autry',         1998),
  ('29',  'Rod Carew',          1991),
  ('30',  'Nolan Ryan',         1992),
  ('42*', 'Jackie Robinson',    1997),
  ('50',  'Jimmie Reese',       1994)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'LAA'
ON CONFLICT DO NOTHING;

-- Los Angeles Dodgers
-- (#42 retired by the Dodgers in 1972, before the 1997 universal retirement)
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('1',   'Pee Wee Reese',      1984),
  ('2',   'Tommy Lasorda',      1997),
  ('4',   'Duke Snider',        1980),
  ('19',  'Jim Gilliam',        1978),
  ('20',  'Don Sutton',         1998),
  ('24',  'Walter Alston',      1977),
  ('32',  'Sandy Koufax',       1972),
  ('39',  'Roy Campanella',     1972),
  ('42*', 'Jackie Robinson',    1972),
  ('53',  'Don Drysdale',       1984)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'LAD'
ON CONFLICT DO NOTHING;

-- Miami Marlins
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('5',   'Carl Barger',        1993),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'MIA'
ON CONFLICT DO NOTHING;

-- Milwaukee Brewers
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('4',   'Paul Molitor',       1999),
  ('19',  'Robin Yount',        1994),
  ('42*', 'Jackie Robinson',    1997),
  ('44',  'Hank Aaron',         1976)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'MIL'
ON CONFLICT DO NOTHING;

-- Minnesota Twins
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('3',   'Harmon Killebrew',   1974),
  ('6',   'Tony Oliva',         1991),
  ('14',  'Kent Hrbek',         1995),
  ('29',  'Rod Carew',          1987),
  ('34',  'Kirby Puckett',      1997),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'MIN'
ON CONFLICT DO NOTHING;

-- New York Mets
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('14',  'Gil Hodges',         1973),
  ('31',  'Mike Piazza',        2016),
  ('37',  'Casey Stengel',      1965),
  ('41',  'Tom Seaver',         1988),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'NYM'
ON CONFLICT DO NOTHING;

-- New York Yankees
-- (#8 retired jointly for Bill Dickey and Yogi Berra in 1972)
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('1',   'Billy Martin',       1986),
  ('2',   'Derek Jeter',        2017),
  ('3',   'Babe Ruth',          1948),
  ('4',   'Lou Gehrig',         1939),
  ('5',   'Joe DiMaggio',       1952),
  ('7',   'Mickey Mantle',      1969),
  ('8',   'Bill Dickey',        1972),
  ('8',   'Yogi Berra',         1972),
  ('9',   'Roger Maris',        1984),
  ('10',  'Phil Rizzuto',       1985),
  ('15',  'Thurman Munson',     1979),
  ('16',  'Whitey Ford',        1974),
  ('23',  'Don Mattingly',      1997),
  ('32',  'Elston Howard',      1984),
  ('37',  'Casey Stengel',      1970),
  ('42*', 'Jackie Robinson',    1997),
  ('44',  'Reggie Jackson',     1993),
  ('46',  'Andy Pettitte',      2015),
  ('49',  'Ron Guidry',         2003),
  ('51',  'Bernie Williams',    2015)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'NYY'
ON CONFLICT DO NOTHING;

-- Oakland Athletics
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('27',  'Catfish Hunter',     1991),
  ('34',  'Rollie Fingers',     1993),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'OAK'
ON CONFLICT DO NOTHING;

-- Philadelphia Phillies
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('1',   'Richie Ashburn',     1979),
  ('14',  'Jim Bunning',        2001),
  ('20',  'Mike Schmidt',       1990),
  ('32',  'Steve Carlton',      1989),
  ('36',  'Robin Roberts',      1962),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'PHI'
ON CONFLICT DO NOTHING;

-- Pittsburgh Pirates
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('4',   'Ralph Kiner',        1987),
  ('8',   'Willie Stargell',    1982),
  ('9',   'Bill Mazeroski',     2001),
  ('21',  'Roberto Clemente',   1973),
  ('33',  'Honus Wagner',       1956),
  ('40',  'Danny Murtaugh',     1977),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'PIT'
ON CONFLICT DO NOTHING;

-- San Diego Padres
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('6',   'Steve Garvey',       1988),
  ('19',  'Tony Gwynn',         2001),
  ('31',  'Dave Winfield',      2001),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'SD'
ON CONFLICT DO NOTHING;

-- Seattle Mariners
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('11',  'Edgar Martinez',     2017),
  ('24',  'Ken Griffey Jr.',    2016),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'SEA'
ON CONFLICT DO NOTHING;

-- San Francisco Giants
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('4',   'Mel Ott',            1951),
  ('11',  'Carl Hubbell',       1944),
  ('24',  'Willie Mays',        1972),
  ('27',  'Juan Marichal',      1975),
  ('42*', 'Jackie Robinson',    1997),
  ('44',  'Willie McCovey',     1980)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'SF'
ON CONFLICT DO NOTHING;

-- St. Louis Cardinals
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('1',   'Ozzie Smith',        1996),
  ('2',   'Red Schoendienst',   1996),
  ('6',   'Stan Musial',        1963),
  ('9',   'Enos Slaughter',     1996),
  ('14',  'Ken Boyer',          1984),
  ('17',  'Dizzy Dean',         1974),
  ('20',  'Lou Brock',          1979),
  ('42*', 'Jackie Robinson',    1997),
  ('45',  'Bob Gibson',         1975)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'STL'
ON CONFLICT DO NOTHING;

-- Tampa Bay Rays
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('12',  'Wade Boggs',         2000),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'TB'
ON CONFLICT DO NOTHING;

-- Texas Rangers
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('7',   'Ivan Rodriguez',     2017),
  ('34',  'Nolan Ryan',         1996),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'TEX'
ON CONFLICT DO NOTHING;

-- Toronto Blue Jays
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('12',  'Roberto Alomar',     2011),
  ('32',  'Roy Halladay',       2019),
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'TOR'
ON CONFLICT DO NOTHING;

-- Washington Nationals
INSERT INTO retired_numbers (team_id, number, player_name, year_retired)
SELECT s.id, v.number, v.player_name, v.year_retired
FROM stadiums s, (VALUES
  ('42*', 'Jackie Robinson',    1997)
) AS v(number, player_name, year_retired)
WHERE s.abbreviation = 'WSH'
ON CONFLICT DO NOTHING;
