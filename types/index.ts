export interface Stadium {
  id: string
  name: string
  team: string
  abbreviation: string
  city: string
  state: string
  lat: number
  lng: number
  capacity: number | null
  opened: number | null
  surface: string | null
  league: 'AL' | 'NL'
  division: 'East' | 'Central' | 'West'
  created_at: string
}

export interface InningScore {
  inning: number
  home: number | null
  away: number | null
}

export interface StadiumVisit {
  id: string
  stadium_id: string
  visit_date: string
  home_team: string
  visiting_team: string
  home_team_record: string | null
  visiting_team_record: string | null
  seat_section: string | null
  seat_row: string | null
  seat_number: string | null
  first_pitch_time: string | null
  game_duration: string | null
  temperature: number | null
  weather: string | null
  attendance: number | null
  home_starter_name: string | null
  home_starter_wl: string | null
  home_starter_ip: string | null
  home_starter_h: number | null
  home_starter_er: number | null
  home_starter_bb: number | null
  home_starter_k: number | null
  away_starter_name: string | null
  away_starter_wl: string | null
  away_starter_ip: string | null
  away_starter_h: number | null
  away_starter_er: number | null
  away_starter_bb: number | null
  away_starter_k: number | null
  inning_scores: InningScore[]
  home_runs: number | null
  home_hits: number | null
  home_errors: number | null
  home_lob: number | null
  away_runs: number | null
  away_hits: number | null
  away_errors: number | null
  away_lob: number | null
  winning_pitcher: string | null
  losing_pitcher: string | null
  save_pitcher: string | null
  hp_umpire: string | null
  first_base_umpire: string | null
  second_base_umpire: string | null
  third_base_umpire: string | null
  photo_url: string | null
  notes: string | null
  additional_seats: { section: string; row: string; number: string }[] | null
  mlb_game_pk: number | null
  stats_auto_populated: boolean
  moments: string[] | null
  game_events: string[] | null
  boxscore_data: Record<string, unknown> | null
  trip_id: string | null
  created_by: string | null
  created_at: string
  stadium?: Stadium
}

export interface TripStop {
  id: string
  trip_id: string
  stadium_id: string
  game_date: string | null
  game_time: string | null
  opponent: string | null
  opponent_team_id: number | null
  sort_order: number
  est_tickets: number
  est_food: number
  est_parking: number
  actual_tickets: number
  actual_food: number
  actual_parking: number
  notes: string | null
  ticket_section: string | null
  ticket_row: string | null
  ticket_seats: string[] | null
  ticket_confirmation: string | null
  drive_time_minutes: number | null
  drive_distance_miles: number | null
  created_at: string
  stadium?: Stadium
}

export interface Trip {
  id: string
  stadium_id: string | null
  name: string
  trip_date: string | null
  start_date: string | null
  end_date: string | null
  status: 'planned' | 'completed' | 'cancelled'
  trip_type: 'stadium' | 'destination'
  destination_id: string | null
  experience_type: 'tour' | 'game' | 'festival' | 'pilgrimage' | 'other' | null
  est_tickets: number
  est_travel: number
  est_hotel: number
  est_food: number
  est_parking: number
  actual_tickets: number
  actual_travel: number
  actual_hotel: number
  actual_food: number
  actual_parking: number
  notes: string | null
  created_by: string | null
  created_at: string
  stadium?: Stadium
}

export interface Destination {
  id: string
  slug: string
  name: string
  city: string
  state: string | null
  country: string
  type: 'hall_of_fame' | 'special_event' | 'historic_stadium' | 'amateur' | 'factory' | 'other'
  description: string | null
  lat: number | null
  lng: number | null
  is_mlb_event: boolean
  website_url: string | null
  created_at: string
}

export interface DestinationVisit {
  id: string
  destination_id: string
  trip_id: string | null
  visit_date: string
  experience_type: 'tour' | 'game' | 'festival' | 'pilgrimage' | 'other' | null
  notes: string | null
  moments: string[] | null
  created_by: string | null
  created_at: string
  destination?: Destination
}

export interface RetiredNumber {
  id: string
  team_id: string
  number: string
  player_name: string
  year_retired: number
}

export interface StadiumNote {
  id: string
  stadium_id: string
  notes: string | null
  updated_by: string | null
  updated_at: string
}

export type SpecialEventType =
  | 'world_series'
  | 'all_star_game'
  | 'postseason'
  | 'spring_training'
  | 'minor_league'
  | 'historic_ballpark'
  | 'international'
  | 'other'

export interface SpecialEvent {
  id: string
  event_type: SpecialEventType
  event_date: string
  seat_section: string | null
  seat_row: string | null
  seat_number: string | null
  weather: string | null
  temperature: number | null
  attendance: number | null
  notes: string | null
  photo_url: string | null
  home_team: string | null
  visiting_team: string | null
  event_year: number | null
  game_number: number | null
  series_round: string | null
  stadium_name: string | null
  city: string | null
  state: string | null
  country: string | null
  ml_level: string | null
  venue_name: string | null
  series_name: string | null
  custom_title: string | null
  created_by: string | null
  created_at: string
}

export interface Milestone {
  id: string
  name: string
  description: string
  icon: string
  check: (visits: StadiumVisit[], stadiums: Stadium[], events?: SpecialEvent[], specialVisits?: SpecialVisit[], destinationVisits?: DestinationVisit[]) => boolean
  earned_at?: string | null
}

export interface SerializableMilestone {
  id: string
  name: string
  description: string
  icon: string
  earnDate?: string | null
}

export interface StadiumWithVisit extends Stadium {
  visited: boolean
  visits: StadiumVisit[]
}

export type SpecialVisitType =
  | 'minor_league'
  | 'spring_training'
  | 'international'
  | 'all_star'
  | 'world_series'
  | 'playoff'
  | 'stadium_tour'
  | 'college'
  | 'independent'
  | 'other'

export interface SpecialVisit {
  id: string
  visit_type: SpecialVisitType
  venue: string
  city: string | null
  state: string | null
  visit_date: string
  teams: string | null
  description: string | null
  notes: string | null
  is_mlb_event: boolean
  game_pk: number | null
  ticket_section: string | null
  ticket_row: string | null
  ticket_seats: string[] | null
  ticket_confirmation: string | null
  moments: string[] | null
  photos: string[] | null
  game_data: Record<string, unknown> | null
  attendance: number | null
  created_by: string | null
  created_at: string
}

export interface StopChecklistItem {
  id: string
  stop_id: string
  category: 'food_drinks' | 'souvenirs' | 'moments' | 'must_do'
  item: string
  checked: boolean
  suggested: boolean
  created_at: string
}

export interface StadiumTrendingFood {
  id: string
  stadium_id: string
  item_name: string
  description: string | null
  is_classic: boolean
  active: boolean
  season_year: number | null
  created_at: string
}

export interface StadiumWeather {
  id: string
  stadium_id: string
  month: number
  avg_high_temp: number
  avg_precip_days: number
  avg_wind_speed: number
  rating: 'great' | 'good' | 'fair' | 'avoid'
  last_updated: string
}

export interface StadiumSouvenir {
  id: string
  stadium_id: string
  item_name: string
  description: string | null
  is_classic: boolean
  active: boolean
  season_year: number | null
  created_at: string
}
