import type { BaseballLifeEntry } from '@/types'

export interface BaseballLifeAchievement {
  id: string
  name: string
  description: string
  icon: string
  category: 'minor_league' | 'mlb_special_event' | 'spring_training' | 'pilgrimage' | 'overall'
  check: (entries: BaseballLifeEntry[]) => boolean
}

export const BASEBALL_LIFE_ACHIEVEMENTS: BaseballLifeAchievement[] = [
  // ── Minor League ──────────────────────────────────────────────────────────
  {
    id: 'bl_minor_league_maven',
    name: 'Minor League Maven',
    description: 'Attend your first minor league game',
    icon: '⚾',
    category: 'minor_league',
    check: (e) => e.filter(x => x.category === 'minor_league').length >= 1,
  },
  {
    id: 'bl_double_a_drifter',
    name: 'Double-A Drifter',
    description: 'Attend 5 minor league games',
    icon: '🚌',
    category: 'minor_league',
    check: (e) => e.filter(x => x.category === 'minor_league').length >= 5,
  },
  {
    id: 'bl_bush_league_legend',
    name: 'Bush League Legend',
    description: 'Attend 25 minor league games',
    icon: '🏟️',
    category: 'minor_league',
    check: (e) => e.filter(x => x.category === 'minor_league').length >= 25,
  },

  // ── MLB Special Events ────────────────────────────────────────────────────
  {
    id: 'bl_midsummer_classic',
    name: 'Midsummer Classic',
    description: 'Attend the MLB All-Star Game',
    icon: '🌟',
    category: 'mlb_special_event',
    check: (e) => e.some(x =>
      x.category === 'mlb_special_event' && (
        x.event_type?.toLowerCase().includes('all-star') ||
        x.event_type?.toLowerCase().includes('all star')
      )
    ),
  },
  {
    id: 'bl_derby_day',
    name: 'Derby Day',
    description: 'Attend the Home Run Derby',
    icon: '💥',
    category: 'mlb_special_event',
    check: (e) => e.some(x =>
      x.category === 'mlb_special_event' &&
      x.event_type?.toLowerCase().includes('home run derby')
    ),
  },
  {
    id: 'bl_october_baseball',
    name: 'October Baseball',
    description: 'Attend any playoff game',
    icon: '🍂',
    category: 'mlb_special_event',
    check: (e) => e.some(x =>
      x.category === 'mlb_special_event' &&
      ['Wild Card', 'ALDS', 'NLDS', 'ALCS', 'NLCS', 'Playoff'].some(t => x.event_type?.includes(t))
    ),
  },
  {
    id: 'bl_fall_classic',
    name: 'Fall Classic',
    description: 'Attend a World Series game',
    icon: '🏆',
    category: 'mlb_special_event',
    check: (e) => e.some(x =>
      x.category === 'mlb_special_event' && x.event_type?.toLowerCase().includes('world series')
    ),
  },
  {
    id: 'bl_field_of_dreams_game',
    name: 'Field of Dreams Game',
    description: 'Attend the Field of Dreams Game in Iowa',
    icon: '🌽',
    category: 'mlb_special_event',
    check: (e) => e.some(x =>
      x.category === 'mlb_special_event' &&
      x.event_type?.toLowerCase().includes('field of dreams')
    ),
  },

  // ── Spring Training ───────────────────────────────────────────────────────
  {
    id: 'bl_spring_awakening',
    name: 'Spring Awakening',
    description: 'Attend your first spring training game',
    icon: '🌞',
    category: 'spring_training',
    check: (e) => e.filter(x => x.category === 'spring_training').length >= 1,
  },
  {
    id: 'bl_cactus_league',
    name: 'Cactus League',
    description: 'Attend a spring training game in Arizona',
    icon: '🌵',
    category: 'spring_training',
    check: (e) => e.some(x => x.category === 'spring_training' && x.state === 'AZ'),
  },
  {
    id: 'bl_grapefruit_league',
    name: 'Grapefruit League',
    description: 'Attend a spring training game in Florida',
    icon: '🍊',
    category: 'spring_training',
    check: (e) => e.some(x => x.category === 'spring_training' && x.state === 'FL'),
  },

  // ── Pilgrimages ───────────────────────────────────────────────────────────
  {
    id: 'bl_cooperstown_pilgrim',
    name: 'Cooperstown Pilgrim',
    description: 'Visit the National Baseball Hall of Fame',
    icon: '🏛️',
    category: 'pilgrimage',
    check: (e) => e.some(x =>
      x.category === 'pilgrimage' && (
        x.venue?.toLowerCase().includes('hall of fame') ||
        x.event_type?.toLowerCase().includes('hall of fame')
      )
    ),
  },
  {
    id: 'bl_bat_factory',
    name: 'The Bat Factory',
    description: 'Visit the Louisville Slugger Museum and Factory',
    icon: '🪵',
    category: 'pilgrimage',
    check: (e) => e.some(x =>
      x.category === 'pilgrimage' && (
        x.venue?.toLowerCase().includes('louisville slugger') ||
        x.event_type?.toLowerCase().includes('louisville slugger')
      )
    ),
  },
  {
    id: 'bl_where_it_began',
    name: 'Where It All Began',
    description: 'Visit the Field of Dreams site in Dyersville',
    icon: '🌾',
    category: 'pilgrimage',
    check: (e) => e.some(x =>
      x.category === 'pilgrimage' && (
        x.venue?.toLowerCase().includes('field of dreams') ||
        x.event_type?.toLowerCase().includes('field of dreams')
      )
    ),
  },
  {
    id: 'bl_raw_material',
    name: 'Raw Material',
    description: 'Visit the Rawlings Baseball Factory',
    icon: '⚾',
    category: 'pilgrimage',
    check: (e) => e.some(x =>
      x.category === 'pilgrimage' && (
        x.venue?.toLowerCase().includes('rawlings') ||
        x.event_type?.toLowerCase().includes('rawlings')
      )
    ),
  },
  {
    id: 'bl_negro_leagues_honor',
    name: 'Negro Leagues Honor',
    description: 'Visit the Negro Leagues Baseball Museum',
    icon: '✊',
    category: 'pilgrimage',
    check: (e) => e.some(x =>
      x.category === 'pilgrimage' && (
        x.venue?.toLowerCase().includes('negro leagues') ||
        x.event_type?.toLowerCase().includes('negro leagues')
      )
    ),
  },
  {
    id: 'bl_grand_tour',
    name: 'The Grand Tour',
    description: 'Visit 3 or more baseball pilgrimage sites',
    icon: '🗺️',
    category: 'pilgrimage',
    check: (e) => {
      const venues = new Set(
        e.filter(x => x.category === 'pilgrimage')
          .map(x => x.venue?.toLowerCase().trim())
          .filter(Boolean)
      )
      return venues.size >= 3
    },
  },

  // ── The Full Circuit ──────────────────────────────────────────────────────
  {
    id: 'bl_full_circuit',
    name: 'The Full Circuit',
    description: 'Attend an MLB game, a minor league game, and a spring training game',
    icon: '🔄',
    category: 'overall',
    check: (e) => {
      const cats = new Set(e.map(x => x.category))
      return cats.has('minor_league') && cats.has('spring_training')
    },
  },
  {
    id: 'bl_baseball_lifer',
    name: 'Baseball Lifer',
    description: 'Have entries in all four Baseball Life categories',
    icon: '🎖️',
    category: 'overall',
    check: (e) => {
      const cats = new Set(e.map(x => x.category))
      return cats.has('minor_league') && cats.has('mlb_special_event') &&
             cats.has('spring_training') && cats.has('pilgrimage')
    },
  },
]

export const BASEBALL_LIFE_CATEGORY_GROUPS: {
  key: 'minor_league' | 'mlb_special_event' | 'spring_training' | 'pilgrimage' | 'overall'
  label: string
  icon: string
}[] = [
  { key: 'minor_league',    label: 'Minor League',       icon: '⚾' },
  { key: 'mlb_special_event', label: 'MLB Special Events', icon: '🌟' },
  { key: 'spring_training', label: 'Spring Training',     icon: '🌞' },
  { key: 'pilgrimage',      label: 'Pilgrimages',         icon: '🏛️' },
  { key: 'overall',         label: 'The Full Circuit',    icon: '🏆' },
]
