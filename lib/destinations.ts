export type DestinationType = 'hall_of_fame' | 'special_event' | 'historic_stadium' | 'amateur' | 'factory' | 'other'
export type ExperienceType = 'tour' | 'game' | 'festival' | 'pilgrimage' | 'other'

export interface CuratedDestination {
  slug: string
  name: string
  city: string
  state: string | null
  country: string
  type: DestinationType
  description: string
  lat: number | null
  lng: number | null
  isMlbEvent: boolean
  icon: string
  heroColor: [string, string]
}

export const DESTINATION_GROUPS: { label: string; icon: string; types: DestinationType[] }[] = [
  { label: 'Hall of Fame & Historic Sites', icon: '🏆', types: ['hall_of_fame', 'factory'] },
  { label: 'MLB Special Events',            icon: '🌟', types: ['special_event']           },
  { label: 'Iconic Stadiums',               icon: '⚾', types: ['historic_stadium']         },
  { label: 'Amateur & Other',               icon: '🎓', types: ['amateur', 'other']         },
]

export const EXPERIENCE_TYPES: { value: ExperienceType; label: string; icon: string }[] = [
  { value: 'pilgrimage', label: 'Pilgrimage',  icon: '🙏' },
  { value: 'tour',       label: 'Tour',        icon: '🎟' },
  { value: 'game',       label: 'Game',        icon: '⚾' },
  { value: 'festival',   label: 'Festival',    icon: '🎉' },
  { value: 'other',      label: 'Other',       icon: '📍' },
]

export const DESTINATIONS: CuratedDestination[] = [
  // ── Hall of Fame & Historic ─────────────────────────────────────────────
  {
    slug: 'hall_of_fame',
    name: 'National Baseball Hall of Fame',
    city: 'Cooperstown', state: 'NY', country: 'USA',
    type: 'hall_of_fame',
    description: 'The shrine of the game — inductees, historic artifacts, and the soul of baseball.',
    lat: 42.6998, lng: -74.9237,
    isMlbEvent: false,
    icon: '🏛️',
    heroColor: ['#1a0a00', '#5c2d00'],
  },
  {
    slug: 'field_of_dreams',
    name: 'Field of Dreams',
    city: 'Dyersville', state: 'IA', country: 'USA',
    type: 'hall_of_fame',
    description: 'The iconic movie site where "if you build it, they will come" became legend.',
    lat: 42.4698, lng: -91.2418,
    isMlbEvent: false,
    icon: '🌽',
    heroColor: ['#0a1a00', '#1a4d00'],
  },
  {
    slug: 'doubleday_field',
    name: 'Doubleday Field',
    city: 'Cooperstown', state: 'NY', country: 'USA',
    type: 'hall_of_fame',
    description: 'Historic ballpark dating to 1920, steps from the Hall of Fame.',
    lat: 42.7001, lng: -74.9229,
    isMlbEvent: false,
    icon: '🏟️',
    heroColor: ['#0a0e1a', '#1a2240'],
  },
  {
    slug: 'negro_leagues',
    name: 'Negro Leagues Baseball Museum',
    city: 'Kansas City', state: 'MO', country: 'USA',
    type: 'hall_of_fame',
    description: 'Honoring the legacy of Black players who shaped the game before integration.',
    lat: 39.0997, lng: -94.5786,
    isMlbEvent: false,
    icon: '✊',
    heroColor: ['#1a0000', '#4d0000'],
  },
  {
    slug: 'babe_ruth_museum',
    name: 'Babe Ruth Birthplace and Museum',
    city: 'Baltimore', state: 'MD', country: 'USA',
    type: 'hall_of_fame' as const,
    description: 'Birthplace and museum dedicated to Babe Ruth, located two blocks from Camden Yards.',
    lat: 39.2838, lng: -76.6274,
    isMlbEvent: false,
    icon: '👑',
    heroColor: ['#1a0a00', '#4d1a00'],
  },
  {
    slug: 'louisville_slugger',
    name: 'Louisville Slugger Museum & Factory',
    city: 'Louisville', state: 'KY', country: 'USA',
    type: 'factory',
    description: 'Where the world\'s most famous bats are made — take the factory tour and swing history.',
    lat: 38.2527, lng: -85.7585,
    isMlbEvent: false,
    icon: '🪵',
    heroColor: ['#1a0a00', '#3d1a00'],
  },
  {
    slug: 'baseball_reliquary',
    name: 'Baseball Reliquary',
    city: 'Monrovia', state: 'CA', country: 'USA',
    type: 'hall_of_fame',
    description: 'Alternative hall of fame celebrating the game\'s rebels, mavericks, and outsiders.',
    lat: 34.1478, lng: -117.9998,
    isMlbEvent: false,
    icon: '🗿',
    heroColor: ['#1a001a', '#3d003d'],
  },
  {
    slug: 'rawlings_factory',
    name: 'Rawlings Baseball Factory',
    city: 'Turrialba', state: null, country: 'Costa Rica',
    type: 'factory',
    description: 'The source of every official MLB baseball — witness hand-stitching at scale.',
    lat: 9.9008, lng: -83.6816,
    isMlbEvent: false,
    icon: '⚾',
    heroColor: ['#001a0a', '#004d22'],
  },

  // ── MLB Special Events ───────────────────────────────────────────────────
  {
    slug: 'all_star_game',
    name: 'MLB All-Star Game',
    city: 'Various', state: null, country: 'USA',
    type: 'special_event',
    description: 'The Midsummer Classic — the best from both leagues in one spectacular game.',
    lat: null, lng: null,
    isMlbEvent: true,
    icon: '⭐',
    heroColor: ['#001a33', '#004d99'],
  },
  {
    slug: 'world_series',
    name: 'World Series',
    city: 'Various', state: null, country: 'USA',
    type: 'special_event',
    description: 'The Fall Classic — baseball\'s ultimate championship.',
    lat: null, lng: null,
    isMlbEvent: true,
    icon: '🏆',
    heroColor: ['#1a0a00', '#804000'],
  },
  {
    slug: 'wild_card_game',
    name: 'Wild Card Games',
    city: 'Various', state: null, country: 'USA',
    type: 'special_event',
    description: 'Single-elimination playoff drama — every pitch could be the last.',
    lat: null, lng: null,
    isMlbEvent: true,
    icon: '🍂',
    heroColor: ['#1a0000', '#660000'],
  },
  {
    slug: 'division_series',
    name: 'Division Series (ALDS/NLDS)',
    city: 'Various', state: null, country: 'USA',
    type: 'special_event',
    description: 'Best-of-five October baseball at its finest.',
    lat: null, lng: null,
    isMlbEvent: true,
    icon: '🍂',
    heroColor: ['#1a0500', '#662200'],
  },
  {
    slug: 'championship_series',
    name: 'Championship Series (ALCS/NLCS)',
    city: 'Various', state: null, country: 'USA',
    type: 'special_event',
    description: 'The pennant race climax — two wins away from the World Series.',
    lat: null, lng: null,
    isMlbEvent: true,
    icon: '🏅',
    heroColor: ['#00001a', '#000066'],
  },
  {
    slug: 'opening_day',
    name: 'Opening Day',
    city: 'Various', state: null, country: 'USA',
    type: 'special_event',
    description: 'Baseball\'s annual rebirth — hope springs eternal on Opening Day.',
    lat: null, lng: null,
    isMlbEvent: true,
    icon: '🌸',
    heroColor: ['#001a1a', '#004d4d'],
  },
  {
    slug: 'dreams_game',
    name: 'Field of Dreams Game',
    city: 'Dyersville', state: 'IA', country: 'USA',
    type: 'special_event',
    description: 'MLB\'s annual game in the Dyersville cornfields — pure magic.',
    lat: 42.4698, lng: -91.2418,
    isMlbEvent: true,
    icon: '🌽',
    heroColor: ['#0a1a00', '#2d5200'],
  },

  // ── Historic Stadium Tours ───────────────────────────────────────────────
  {
    slug: 'fenway_tour',
    name: 'Fenway Park Tour',
    city: 'Boston', state: 'MA', country: 'USA',
    type: 'historic_stadium',
    description: 'Walk the warning track at America\'s most beloved ballpark.',
    lat: 42.3467, lng: -71.0972,
    isMlbEvent: false,
    icon: '🟢',
    heroColor: ['#001a00', '#003300'],
  },
  {
    slug: 'wrigley_tour',
    name: 'Wrigley Field Tour',
    city: 'Chicago', state: 'IL', country: 'USA',
    type: 'historic_stadium',
    description: 'Experience the Friendly Confines — ivy walls, hand-turned scoreboard.',
    lat: 41.9484, lng: -87.6553,
    isMlbEvent: false,
    icon: '🐻',
    heroColor: ['#000e33', '#001880'],
  },
  {
    slug: 'yankee_tour',
    name: 'Yankee Stadium Tour',
    city: 'Bronx', state: 'NY', country: 'USA',
    type: 'historic_stadium',
    description: 'Monument Park, the dugout, and a century of championships.',
    lat: 40.8296, lng: -73.9262,
    isMlbEvent: false,
    icon: '🎩',
    heroColor: ['#0a0a0a', '#1a1a1a'],
  },
  {
    slug: 'dodger_tour',
    name: 'Dodger Stadium Tour',
    city: 'Los Angeles', state: 'CA', country: 'USA',
    type: 'historic_stadium',
    description: 'Hollywood\'s ballpark — 60+ years of history in Chavez Ravine.',
    lat: 34.0739, lng: -118.2400,
    isMlbEvent: false,
    icon: '💙',
    heroColor: ['#001433', '#003180'],
  },
  {
    slug: 'oracle_tour',
    name: 'Oracle Park Tour',
    city: 'San Francisco', state: 'CA', country: 'USA',
    type: 'historic_stadium',
    description: 'McCovey Cove, the bleachers, and one of baseball\'s most scenic settings.',
    lat: 37.7786, lng: -122.3893,
    isMlbEvent: false,
    icon: '🌉',
    heroColor: ['#1a0a00', '#4d2200'],
  },

  // ── Amateur & Other ──────────────────────────────────────────────────────
  {
    slug: 'college_ws',
    name: 'College World Series',
    city: 'Omaha', state: 'NE', country: 'USA',
    type: 'amateur',
    description: 'Eight college teams battle for the national championship at Charles Schwab Field.',
    lat: 41.2565, lng: -95.9345,
    isMlbEvent: false,
    icon: '🎓',
    heroColor: ['#001a33', '#003366'],
  },
  {
    slug: 'cape_cod_league',
    name: 'Cape Cod Baseball League',
    city: 'Hyannis', state: 'MA', country: 'USA',
    type: 'amateur',
    description: 'Summer collegiate baseball — tomorrow\'s stars playing on Cape Cod.',
    lat: 41.6528, lng: -70.2845,
    isMlbEvent: false,
    icon: '🌊',
    heroColor: ['#001a1a', '#00404d'],
  },
  {
    slug: 'arizona_fall',
    name: 'Arizona Fall League',
    city: 'Scottsdale', state: 'AZ', country: 'USA',
    type: 'amateur',
    description: 'Top prospects from all 30 organizations play in the desert each fall.',
    lat: 33.4942, lng: -111.9261,
    isMlbEvent: false,
    icon: '🌵',
    heroColor: ['#1a0a00', '#4d2600'],
  },
]

export const DESTINATION_BY_SLUG = Object.fromEntries(DESTINATIONS.map(d => [d.slug, d]))

export function destinationLocation(d: CuratedDestination): string {
  if (d.city === 'Various') return 'Location varies'
  const parts = [d.city]
  if (d.state) parts.push(d.state)
  else if (d.country !== 'USA') parts.push(d.country)
  return parts.join(', ')
}

export function destinationTypeLabel(type: DestinationType): string {
  const map: Record<DestinationType, string> = {
    hall_of_fame:     'Hall of Fame',
    special_event:    'MLB Event',
    historic_stadium: 'Historic Stadium',
    amateur:          'Amateur',
    factory:          'Factory/Museum',
    other:            'Other',
  }
  return map[type] ?? type
}
