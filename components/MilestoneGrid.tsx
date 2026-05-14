'use client'

import { useState } from 'react'
import { Check, X, Share2, Calendar, MapPin, Search } from 'lucide-react'
import type { SerializableMilestone, StadiumVisit, Stadium, SpecialEvent } from '@/types'

// ── Constants ──────────────────────────────────────────────────────────────

const MILESTONE_POINTS: Record<string, number> = {
  first_game: 25, five_stadiums: 50, ten_stadiums: 75,
  fifteen_stadiums: 100, twenty_stadiums: 125, twentyfive_stadiums: 150, all_stadiums: 300,
  al_east: 50, al_central: 50, al_west: 50, nl_east: 50, nl_central: 50, nl_west: 50,
  american_league: 100, national_league: 100,
  east_coast: 100, midwest: 100, west_coast: 100,
  five_games: 35, ten_games: 50,
  world_series_attendance: 150, all_star_attendance: 100, postseason_attendance: 100,
  spring_training_attendance: 50, minor_league_attendance: 50,
  hall_of_fame_visit: 75, field_of_dreams_visit: 75,
  international_game: 100, historic_ballparks_all: 200,
  first_special_event: 30,
  // Game-event achievements
  walk_off_witness: 75, double_walk_off: 125,
  no_hit_wonder: 150, perfect_day: 300, committee_work: 100,
  extra_credit: 50, marathon_man: 75,
  lights_out: 50, grand_slam_witness: 75,
  full_cycle: 150, history_maker: 200,
  run_factory: 50, pitchers_duel: 75,
}

const PLACES_IDS = new Set([
  'five_stadiums', 'ten_stadiums', 'fifteen_stadiums', 'twenty_stadiums',
  'twentyfive_stadiums', 'all_stadiums',
  'al_east', 'al_central', 'al_west',
  'nl_east', 'nl_central', 'nl_west',
  'american_league', 'national_league',
  'east_coast', 'midwest', 'west_coast',
])

const EXPERIENCE_IDS = new Set([
  'first_game', 'five_games', 'ten_games',
  'first_special_event', 'world_series_attendance', 'all_star_attendance',
  'postseason_attendance', 'spring_training_attendance', 'minor_league_attendance',
  'hall_of_fame_visit', 'field_of_dreams_visit', 'international_game', 'historic_ballparks_all',
  // Game-event achievements
  'walk_off_witness', 'double_walk_off',
  'no_hit_wonder', 'perfect_day', 'committee_work',
  'extra_credit', 'marathon_man',
  'lights_out', 'grand_slam_witness',
  'full_cycle', 'history_maker',
  'run_factory', 'pitchers_duel',
])

interface StaticExperience {
  id: string
  name: string
  description: string
  icon: string
}

const STATIC_EXPERIENCES: StaticExperience[] = [
  { id: 'rain_delay',      name: 'Rain Delay',             description: 'Sit through a rain delay at a ballpark',           icon: '🌧️' },
  { id: 'walk_off_win',    name: 'Walk-Off Win',            description: 'Witness a walk-off victory in person',             icon: '🎉' },
  { id: 'foul_ball',       name: 'Foul Ball',               description: 'Catch or retrieve a foul ball at a game',          icon: '⚾' },
  { id: 'bobblehead',      name: 'Bobblehead Night',        description: 'Score a bobblehead giveaway at the park',          icon: '🪆' },
  { id: 'fireworks_night', name: 'Fireworks Night',         description: 'Stay for post-game fireworks',                     icon: '🎆' },
  { id: 'opening_day',     name: 'Opening Day',             description: 'Attend Opening Day for any team',                  icon: '🌱' },
  { id: 'rivalry_game',    name: 'Rivalry Game',            description: 'Attend a heated rivalry matchup',                  icon: '⚔️' },
  { id: 'enemy_territory', name: 'Enemy Territory',         description: 'Cheer for the visiting team at a ballpark',        icon: '🕵️' },
  { id: 'seventh_inning',  name: 'Seventh Inning Stretch',  description: 'Sing Take Me Out to the Ballgame',                 icon: '🎵' },
  { id: 'early_bird',      name: 'Early Bird',              description: 'Arrive early to watch batting practice',           icon: '🌅' },
  { id: 'jersey_day',      name: 'Jersey Day',              description: 'Wear your team jersey to a game',                  icon: '👕' },
  { id: 'night_owl',       name: 'Night Owl',               description: 'Stay until the very last out of a night game',     icon: '🦉' },
]

// ── Helper functions ───────────────────────────────────────────────────────

interface EarningContext {
  date: string
  location?: string
}

function getNthUniqueVisit(n: number, sorted: StadiumVisit[], stadiums: Stadium[]): EarningContext | null {
  const seen = new Set<string>()
  for (const v of sorted) {
    if (!seen.has(v.stadium_id)) {
      seen.add(v.stadium_id)
      if (seen.size === n) {
        return { date: v.visit_date, location: stadiums.find(s => s.id === v.stadium_id)?.name }
      }
    }
  }
  return null
}

function getCompletionContext(group: Stadium[], sorted: StadiumVisit[], stadiums: Stadium[]): EarningContext | null {
  const groupIds = new Set(group.map(s => s.id))
  const seen = new Set<string>()
  for (const v of sorted) {
    if (groupIds.has(v.stadium_id) && !seen.has(v.stadium_id)) {
      seen.add(v.stadium_id)
      if (seen.size === groupIds.size) {
        return { date: v.visit_date, location: stadiums.find(s => s.id === v.stadium_id)?.name }
      }
    }
  }
  return null
}

function getSerializableMilestoneContext(
  milestone: SerializableMilestone,
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[]
): EarningContext | null {
  const sv = [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))
  const se = [...allEvents].sort((a, b) => a.event_date.localeCompare(b.event_date))
  const sn = (id: string) => allStadiums.find(s => s.id === id)?.name

  switch (milestone.id) {
    case 'first_game':  return sv[0] ? { date: sv[0].visit_date, location: sn(sv[0].stadium_id) } : null
    case 'five_games':  return sv[4] ? { date: sv[4].visit_date, location: sn(sv[4].stadium_id) } : null
    case 'ten_games':   return sv[9] ? { date: sv[9].visit_date, location: sn(sv[9].stadium_id) } : null
    case 'five_stadiums':       return getNthUniqueVisit(5,  sv, allStadiums)
    case 'ten_stadiums':        return getNthUniqueVisit(10, sv, allStadiums)
    case 'fifteen_stadiums':    return getNthUniqueVisit(15, sv, allStadiums)
    case 'twenty_stadiums':     return getNthUniqueVisit(20, sv, allStadiums)
    case 'twentyfive_stadiums': return getNthUniqueVisit(25, sv, allStadiums)
    case 'all_stadiums':        return getNthUniqueVisit(30, sv, allStadiums)
    case 'al_east':    return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'East'),    sv, allStadiums)
    case 'al_central': return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'Central'), sv, allStadiums)
    case 'al_west':    return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'West'),    sv, allStadiums)
    case 'nl_east':    return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'East'),    sv, allStadiums)
    case 'nl_central': return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'Central'), sv, allStadiums)
    case 'nl_west':    return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'West'),    sv, allStadiums)
    case 'american_league': return getCompletionContext(allStadiums.filter(s => s.league === 'AL'), sv, allStadiums)
    case 'national_league': return getCompletionContext(allStadiums.filter(s => s.league === 'NL'), sv, allStadiums)
    case 'east_coast':  return getCompletionContext(allStadiums.filter(s => s.division === 'East'),    sv, allStadiums)
    case 'midwest':     return getCompletionContext(allStadiums.filter(s => s.division === 'Central'), sv, allStadiums)
    case 'west_coast':  return getCompletionContext(allStadiums.filter(s => s.division === 'West'),    sv, allStadiums)
    case 'first_special_event': {
      const e = se[0]
      return e ? { date: e.event_date, location: e.stadium_name ?? e.venue_name ?? undefined } : null
    }
    case 'world_series_attendance': {
      const e = se.find(e => e.event_type === 'world_series')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'all_star_attendance': {
      const e = se.find(e => e.event_type === 'all_star_game')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'postseason_attendance': {
      const e = se.find(e => e.event_type === 'postseason')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'spring_training_attendance': {
      const e = se.find(e => e.event_type === 'spring_training')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'minor_league_attendance': {
      const e = se.find(e => e.event_type === 'minor_league')
      return e ? { date: e.event_date, location: e.venue_name ?? e.stadium_name ?? undefined } : null
    }
    case 'hall_of_fame_visit': {
      const e = se.find(e => e.event_type === 'historic_ballpark' && e.venue_name === 'National Baseball Hall of Fame')
      return e ? { date: e.event_date, location: 'Cooperstown, NY' } : null
    }
    case 'field_of_dreams_visit': {
      const e = se.find(e => e.event_type === 'historic_ballpark' && e.venue_name === 'Field of Dreams')
      return e ? { date: e.event_date, location: 'Dyersville, IA' } : null
    }
    case 'international_game': {
      const e = se.find(e => e.event_type === 'international')
      return e ? { date: e.event_date, location: e.stadium_name ?? e.city ?? undefined } : null
    }
    case 'historic_ballparks_all': {
      const VENUES = ['Louisville Slugger Museum & Factory', 'National Baseball Hall of Fame', 'Negro Leagues Baseball Museum', 'Field of Dreams', 'Rickwood Field']
      const historic = se.filter(e => e.event_type === 'historic_ballpark' && e.venue_name && VENUES.includes(e.venue_name))
      const seen = new Set<string>()
      for (const e of historic) {
        seen.add(e.venue_name!)
        if (seen.size === VENUES.length) return { date: e.event_date, location: e.venue_name ?? undefined }
      }
      return null
    }
    // Game-event achievements — find first qualifying visit
    case 'walk_off_witness':   { const v = sv.find(v => v.game_events?.includes('walk_off'));          return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'double_walk_off':    { const v = sv.filter(v => v.game_events?.includes('walk_off'))[1];    return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'no_hit_wonder':      { const v = sv.find(v => v.game_events?.includes('no_hitter'));         return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'perfect_day':        { const v = sv.find(v => v.game_events?.includes('perfect_game'));      return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'committee_work':     { const v = sv.find(v => v.game_events?.includes('combined_no_hitter')); return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'extra_credit':       { const v = sv.find(v => v.game_events?.includes('extra_innings'));     return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'marathon_man':       { const v = sv.find(v => v.game_events?.includes('twelve_plus_innings')); return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'lights_out':         { const v = sv.find(v => v.game_events?.includes('shutout'));           return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'grand_slam_witness': { const v = sv.find(v => v.game_events?.includes('grand_slam'));        return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'full_cycle':         { const v = sv.find(v => v.game_events?.includes('cycle'));             return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'history_maker':      { const v = sv.find(v => v.game_events?.includes('milestone_hr'));      return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'run_factory':        { const v = sv.find(v => v.game_events?.includes('run_factory'));       return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'pitchers_duel':      { const v = sv.find(v => v.game_events?.includes('pitchers_duel'));     return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    default: return null
  }
}

function getMilestoneProgress(
  id: string,
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[]
): { current: number; total: number } | null {
  const visitedCount = new Set(allVisits.map(v => v.stadium_id)).size
  const visitedIds   = new Set(allVisits.map(v => v.stadium_id))

  const divCount = (lg: string, dv: string) => allStadiums.filter(s => s.league === lg && s.division === dv).length
  const divVis   = (lg: string, dv: string) => allStadiums.filter(s => s.league === lg && s.division === dv && visitedIds.has(s.id)).length
  const lgCount  = (lg: string) => allStadiums.filter(s => s.league    === lg).length
  const lgVis    = (lg: string) => allStadiums.filter(s => s.league    === lg && visitedIds.has(s.id)).length
  const regCount = (dv: string) => allStadiums.filter(s => s.division  === dv).length
  const regVis   = (dv: string) => allStadiums.filter(s => s.division  === dv && visitedIds.has(s.id)).length

  switch (id) {
    case 'first_game':          return { current: Math.min(allVisits.length, 1),  total: 1  }
    case 'five_stadiums':       return { current: Math.min(visitedCount, 5),       total: 5  }
    case 'ten_stadiums':        return { current: Math.min(visitedCount, 10),      total: 10 }
    case 'fifteen_stadiums':    return { current: Math.min(visitedCount, 15),      total: 15 }
    case 'twenty_stadiums':     return { current: Math.min(visitedCount, 20),      total: 20 }
    case 'twentyfive_stadiums': return { current: Math.min(visitedCount, 25),      total: 25 }
    case 'all_stadiums':        return { current: visitedCount,                    total: 30 }
    case 'five_games':          return { current: Math.min(allVisits.length, 5),  total: 5  }
    case 'ten_games':           return { current: Math.min(allVisits.length, 10), total: 10 }
    case 'al_east':    return { current: divVis('AL', 'East'),    total: divCount('AL', 'East')    }
    case 'al_central': return { current: divVis('AL', 'Central'), total: divCount('AL', 'Central') }
    case 'al_west':    return { current: divVis('AL', 'West'),    total: divCount('AL', 'West')    }
    case 'nl_east':    return { current: divVis('NL', 'East'),    total: divCount('NL', 'East')    }
    case 'nl_central': return { current: divVis('NL', 'Central'), total: divCount('NL', 'Central') }
    case 'nl_west':    return { current: divVis('NL', 'West'),    total: divCount('NL', 'West')    }
    case 'american_league': return { current: lgVis('AL'), total: lgCount('AL') }
    case 'national_league': return { current: lgVis('NL'), total: lgCount('NL') }
    case 'east_coast':  return { current: regVis('East'),    total: regCount('East')    }
    case 'midwest':     return { current: regVis('Central'), total: regCount('Central') }
    case 'west_coast':  return { current: regVis('West'),    total: regCount('West')    }
    case 'historic_ballparks_all': {
      const VENUES = ['Louisville Slugger Museum & Factory', 'National Baseball Hall of Fame', 'Negro Leagues Baseball Museum', 'Field of Dreams', 'Rickwood Field']
      const visited = new Set(allEvents.filter(e => e.event_type === 'historic_ballpark' && e.venue_name).map(e => e.venue_name!))
      return { current: VENUES.filter(v => visited.has(v)).length, total: VENUES.length }
    }
    case 'double_walk_off': {
      const count = allVisits.filter(v => v.game_events?.includes('walk_off')).length
      return { current: Math.min(count, 2), total: 2 }
    }
    default: return null
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  earned: SerializableMilestone[]
  unearned: SerializableMilestone[]
  allVisits: StadiumVisit[]
  allStadiums: Stadium[]
  allEvents: SpecialEvent[]
  currentRankName: string
  rankTiers: Array<{ name: string; minPts: number; icon: string }>
}

type SelectedItem =
  | { type: 'milestone'; milestone: SerializableMilestone; isEarned: boolean }
  | { type: 'static'; experience: StaticExperience }

// ── Component ──────────────────────────────────────────────────────────────

export default function MilestoneGrid({
  earned, unearned, allVisits, allStadiums, allEvents, currentRankName, rankTiers,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'earned' | 'places' | 'experiences'>('all')
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState<SelectedItem | null>(null)

  const earnedIds    = new Set(earned.map(m => m.id))
  const currentRankIdx = rankTiers.findIndex(r => r.name === currentRankName)

  // Filter milestone list
  const allMilestones = [...earned, ...unearned]
  const filteredMilestones = allMilestones.filter(m => {
    if (filter === 'earned')      return earnedIds.has(m.id)
    if (filter === 'places')      return PLACES_IDS.has(m.id)
    if (filter === 'experiences') return EXPERIENCE_IDS.has(m.id)
    return true
  }).filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
  })

  // Static experiences shown in Experiences and All tabs
  const showStatics = filter === 'all' || filter === 'experiences'
  const filteredStatics = showStatics ? STATIC_EXPERIENCES.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  }) : []

  // Modal context (earned milestones only)
  const context = selected?.type === 'milestone' && selected.isEarned
    ? getSerializableMilestoneContext(selected.milestone, allVisits, allStadiums, allEvents)
    : null

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px 0' }}>

        {/* Rank progression strip */}
        <div style={{
          overflowX: 'auto', display: 'flex', alignItems: 'center',
          marginBottom: 28, paddingBottom: 4,
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {rankTiers.map((tier, i) => {
            const isCurrent = tier.name === currentRankName
            const isPast    = i < currentRankIdx
            return (
              <div key={tier.name} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '8px 10px', borderRadius: 12,
                  backgroundColor: isCurrent ? 'rgba(245,166,35,0.1)' : 'transparent',
                  border: `1.5px solid ${isCurrent ? 'rgba(245,166,35,0.35)' : 'transparent'}`,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isPast ? 0 : 17,
                    backgroundColor: isCurrent
                      ? 'rgba(245,166,35,0.15)'
                      : isPast ? 'rgba(63,185,80,0.1)' : 'rgba(139,148,158,0.08)',
                    border: `2px solid ${
                      isCurrent ? '#F5A623'
                      : isPast ? 'rgba(63,185,80,0.35)' : '#30363D'}`,
                  }}>
                    {isPast
                      ? <Check size={15} color="#3FB950" strokeWidth={3} />
                      : tier.icon}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#F5A623' : '#8B949E',
                    whiteSpace: 'nowrap',
                  }}>
                    {tier.name}
                  </span>
                </div>
                {/* Connector line */}
                {i < rankTiers.length - 1 && (
                  <div style={{
                    width: 18, height: 2, flexShrink: 0,
                    backgroundColor: i < currentRankIdx ? 'rgba(63,185,80,0.3)' : '#30363D',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Filter tabs + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'earned', 'places', 'experiences'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '7px 15px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                backgroundColor: filter === f ? '#1C2430' : 'rgba(139,148,158,0.08)',
                color: filter === f ? '#E6EDF3' : '#8B949E',
                border: filter === f ? '1px solid #484F58' : '1px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {f === 'earned'
                  ? `Earned (${earned.length})`
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 140, maxWidth: 220 }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: '#8B949E', pointerEvents: 'none',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: '100%', padding: '7px 10px 7px 30px', borderRadius: 20,
                border: '1px solid #30363D', fontSize: 13, color: '#E6EDF3',
                backgroundColor: '#1C2430', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Achievement list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 32 }}>

          {filteredMilestones.map(m => {
            const isEarned  = earnedIds.has(m.id)
            const isPlace   = PLACES_IDS.has(m.id)
            const pts       = MILESTONE_POINTS[m.id] ?? 25
            const progress  = getMilestoneProgress(m.id, allVisits, allStadiums, allEvents)
            const pct       = progress ? Math.round((progress.current / progress.total) * 100) : 0
            const barColor  = isPlace ? '#1F6FEB' : '#F5A623'

            return (
              <button
                key={m.id}
                onClick={() => setSelected({ type: 'milestone', milestone: m, isEarned })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 10px', borderRadius: 12, border: 'none',
                  backgroundColor: 'transparent', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1C2430' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                {/* Icon square */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, position: 'relative',
                  backgroundColor: isEarned
                    ? 'rgba(245,166,35,0.12)'
                    : isPlace ? 'rgba(31,111,235,0.07)' : 'rgba(245,166,35,0.07)',
                  border: `1.5px solid ${
                    isEarned ? 'rgba(245,166,35,0.25)' : '#30363D'}`,
                  filter: isEarned ? 'none' : 'grayscale(55%)',
                }}>
                  {m.icon}
                  {isEarned && (
                    <div style={{
                      position: 'absolute', bottom: -4, right: -4,
                      width: 16, height: 16, borderRadius: '50%',
                      backgroundColor: '#3FB950', border: '2px solid #0B1117',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={8} color="#0B1117" strokeWidth={3.5} />
                    </div>
                  )}
                </div>

                {/* Text + progress */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600,
                    color: isEarned ? '#E6EDF3' : '#8B949E',
                    marginBottom: 1,
                  }}>
                    {m.name}
                  </div>
                  <div style={{
                    fontSize: 13, color: '#8B949E',
                    marginBottom: progress && !isEarned ? 6 : 0,
                  }}>
                    {m.description}
                  </div>
                  {progress && !isEarned && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        flex: 1, height: 4, borderRadius: 4,
                        backgroundColor: '#30363D', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: `${pct}%`, backgroundColor: barColor,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#8B949E', flexShrink: 0 }}>
                        {progress.current}/{progress.total}
                      </span>
                    </div>
                  )}
                </div>

                {/* Points */}
                <div style={{ flexShrink: 0 }}>
                  {isEarned ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '3px 10px', borderRadius: 20,
                      backgroundColor: 'rgba(63,185,80,0.12)',
                      fontSize: 12, fontWeight: 700, color: '#3FB950',
                    }}>
                      +{pts}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#30363D', fontWeight: 600 }}>
                      +{pts}
                    </span>
                  )}
                </div>
              </button>
            )
          })}

          {/* Static experiences */}
          {filteredStatics.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected({ type: 'static', experience: s })}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 10px', borderRadius: 12, border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer',
                textAlign: 'left', width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, filter: 'grayscale(60%)',
                backgroundColor: 'rgba(139,148,158,0.08)',
                border: '1.5px solid #30363D',
              }}>
                {s.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#8B949E', marginBottom: 1 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 13, color: '#8B949E' }}>{s.description}</div>
              </div>
              <span style={{ fontSize: 11, color: '#30363D', fontWeight: 500, flexShrink: 0 }}>
                Bucket list
              </span>
            </button>
          ))}

          {/* Empty state */}
          {filteredMilestones.length === 0 && filteredStatics.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#8B949E', marginBottom: 4 }}>
                No matches
              </div>
              <div style={{ fontSize: 14, color: '#8B949E' }}>
                Try a different filter or search term
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, backgroundColor: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              width: '100%', maxWidth: 360, borderRadius: 20,
              backgroundColor: '#161B22', position: 'relative',
              border: selected.type === 'milestone' && selected.isEarned
                ? '1px solid rgba(245,166,35,0.3)'
                : '1px solid #30363D',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute', top: 14, right: 14, zIndex: 10,
                width: 30, height: 30, borderRadius: '50%', border: 'none',
                backgroundColor: 'rgba(139,148,158,0.12)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#8B949E',
              }}
            >
              <X size={15} />
            </button>

            <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
              {/* Icon circle */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34,
                backgroundColor: selected.type === 'milestone' && selected.isEarned
                  ? 'rgba(245,166,35,0.18)' : 'rgba(139,148,158,0.08)',
                border: `2px solid ${
                  selected.type === 'milestone' && selected.isEarned
                    ? 'rgba(245,166,35,0.4)' : '#30363D'}`,
              }}>
                {selected.type === 'milestone' ? selected.milestone.icon : selected.experience.icon}
              </div>

              {/* "Achievement Unlocked" label */}
              {selected.type === 'milestone' && selected.isEarned && (
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                  color: '#F5A623', textTransform: 'uppercase', marginBottom: 8,
                }}>
                  Achievement Unlocked!
                </div>
              )}

              {/* Name */}
              <div style={{ fontSize: 19, fontWeight: 800, color: '#E6EDF3', marginBottom: 6 }}>
                {selected.type === 'milestone' ? selected.milestone.name : selected.experience.name}
              </div>

              {/* Description */}
              <div style={{ fontSize: 14, color: '#8B949E', marginBottom: 18 }}>
                {selected.type === 'milestone' ? selected.milestone.description : selected.experience.description}
              </div>

              {/* Earned milestone */}
              {selected.type === 'milestone' && selected.isEarned && (() => {
                const m = selected.milestone
                const pts = MILESTONE_POINTS[m.id] ?? 25
                return (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 14px', borderRadius: 20,
                        backgroundColor: 'rgba(63,185,80,0.12)', color: '#3FB950',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        ⚡ +{pts} pts
                      </span>
                    </div>
                    {context && (
                      <div style={{
                        padding: '12px 14px', borderRadius: 12, marginBottom: 18,
                        backgroundColor: 'rgba(139,148,158,0.06)',
                        border: '1px solid #30363D',
                        textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#E6EDF3' }}>
                          <Calendar size={13} color="#F5A623" style={{ flexShrink: 0 }} />
                          {formatDate(context.date)}
                        </div>
                        {context.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#E6EDF3' }}>
                            <MapPin size={13} color="#F5A623" style={{ flexShrink: 0 }} />
                            {context.location}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => {
                          navigator.share?.({
                            title: 'Achievement Unlocked!',
                            text: `I just earned "${m.name}" on Chasing 30! 🏆`,
                          }).catch(() => {})
                        }}
                        style={{
                          flex: 1, padding: '11px 0', borderRadius: 12,
                          backgroundColor: 'rgba(139,148,158,0.12)',
                          border: '1px solid #30363D',
                          color: '#E6EDF3', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Share2 size={14} /> Share
                      </button>
                      <button
                        onClick={() => setSelected(null)}
                        style={{
                          flex: 1, padding: '11px 0', borderRadius: 12,
                          backgroundColor: '#F5A623', border: 'none',
                          color: '#0B1117', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Awesome!
                      </button>
                    </div>
                  </>
                )
              })()}

              {/* Unearned milestone */}
              {selected.type === 'milestone' && !selected.isEarned && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 20,
                  backgroundColor: 'rgba(139,148,158,0.08)',
                  color: '#8B949E', fontSize: 13, fontWeight: 600,
                }}>
                  🔒 Keep going — you&apos;ll get there
                </div>
              )}

              {/* Static / bucket list */}
              {selected.type === 'static' && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 20,
                  backgroundColor: 'rgba(139,148,158,0.08)',
                  color: '#8B949E', fontSize: 13, fontWeight: 600,
                }}>
                  ⭐ Add this to your bucket list
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
