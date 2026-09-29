import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { haversineDistance, formatCurrency } from '@/lib/utils'
import { tripActualSpent } from '@/lib/trip-spend'
import { sameTeam, teamNickname } from '@/lib/team-match'
import { GAME_MOMENTS } from '@/lib/moments'
import type { Stadium, StadiumVisit, Trip } from '@/types'
import { TrendingUp, MapPin, Trophy, Users, Star, DollarSign, Award } from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'
import YearRecap from '@/components/YearRecap'
import { BestGamesCard, DayNightCard, type RecordVisit, type RecordStadium } from '@/components/StatsRecords'

type TripWithStopBudgets = Trip & {
  trip_stops: { est_tickets: number; est_food: number; est_parking: number; est_hotel: number; est_local_transport: number; actual_tickets: number; actual_food: number; actual_parking: number; actual_hotel: number; actual_local_transport: number }[]
}

// Stats is the one home for everything analytical about your history. The
// sections keep it from being a single endless scroll, and they're plain
// links (?tab=...) rather than client state so the dashboard can deep-link
// straight to the right one.
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'records',  label: 'Records'  },
  { key: 'rankings', label: 'Rankings' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'beyond',   label: 'Beyond the 30' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams
  const tab: TabKey = TABS.find(t => t.key === tabParam)?.key ?? 'overview'

  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: trips }, { data: bleRows }, { data: destVisitRows }, { data: collectibleRows }, { data: milbStadiumRows }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('trips').select('*, trip_stops(est_tickets, est_food, est_parking, est_hotel, est_local_transport, actual_tickets, actual_food, actual_parking, actual_hotel, actual_local_transport)'),
    supabase.from('baseball_life_entries').select('id, category, is_game, venue, event_type, visit_date, city, state'),
    supabase.from('destination_visits').select('id, visit_date, destination:destinations(name)'),
    supabase.from('collectible_log').select('category, giveaway_type'),
    supabase.from('minor_league_stadiums').select('name, team, level'),
  ])

  const { data: { user } } = await supabase.auth.getUser()
  const { data: settings } = user
    ? await supabase.from('user_settings').select('favorite_team_abbr').eq('user_id', user.id).maybeSingle()
    : { data: null }
  const favAbbr: string | null = (settings as { favorite_team_abbr: string | null } | null)?.favorite_team_abbr ?? null

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allTrips = (trips ?? []) as TripWithStopBudgets[]
  const allBaseballLife = (bleRows ?? []) as {
    id: string; category: string; is_game: boolean; venue: string | null; event_type: string | null
    visit_date: string; city: string | null; state: string | null
  }[]
  const destVisits = (destVisitRows ?? []) as unknown as { id: string; visit_date: string; destination: { name: string } | null }[]
  const collectibles = (collectibleRows ?? []) as { category: string; giveaway_type: string | null }[]
  const milbStadiums = (milbStadiumRows ?? []) as { name: string; team: string | null; level: string | null }[]

  const mlbGames = allVisits.length
  const milbGames = allBaseballLife.filter(e => e.category === 'minor_league' && e.is_game).length
  const totalGames = mlbGames + milbGames

  const visitedIds = new Set(allVisits.map((v) => v.stadium_id))
  const visitedStadiums = allStadiums.filter((s) => visitedIds.has(s.id))

  // Same shared definition the dashboard tile uses, so the two can't disagree.
  const totalSpent = allTrips.reduce((sum, t) => sum + tripActualSpent(t, t.trip_stops), 0)

  // Favorite division (most visited stadiums)
  const divisionCounts: Record<string, number> = {}
  for (const s of visitedStadiums) {
    const key = `${s.league} ${s.division}`
    divisionCounts[key] = (divisionCounts[key] ?? 0) + 1
  }
  const favDivision =
    Object.entries(divisionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

  // Most seen team (home + away appearances)
  const teamSeenCounts: Record<string, number> = {}
  for (const v of allVisits) {
    const away = v.visiting_team?.replace(/^vs\.?\s+/i, '').trim()
    if (away) teamSeenCounts[away] = (teamSeenCounts[away] ?? 0) + 1
    if (v.home_team) teamSeenCounts[v.home_team] = (teamSeenCounts[v.home_team] ?? 0) + 1
  }
  const companionCounts: Record<string, number> = {}
  for (const v of allVisits) {
    for (const name of v.companions ?? []) {
      companionCounts[name] = (companionCounts[name] ?? 0) + 1
    }
  }
  const topCompanions = Object.entries(companionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Your ballpark rankings — average across every rated visit to each
  // stadium, so visiting the same park twice with different experiences
  // blends into one overall picture rather than showing as two entries.
  const ratingsByStadium: Record<string, { food: number[]; atmosphere: number[]; seats: number[] }> = {}
  for (const v of allVisits) {
    if (v.rating_food == null && v.rating_atmosphere == null && v.rating_seats == null) continue
    const bucket = ratingsByStadium[v.stadium_id] ?? { food: [], atmosphere: [], seats: [] }
    if (v.rating_food != null) bucket.food.push(v.rating_food)
    if (v.rating_atmosphere != null) bucket.atmosphere.push(v.rating_atmosphere)
    if (v.rating_seats != null) bucket.seats.push(v.rating_seats)
    ratingsByStadium[v.stadium_id] = bucket
  }
  const avg = (nums: number[]) => nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : null
  const ballparkRankings = Object.entries(ratingsByStadium)
    .map(([stadiumId, r]) => {
      const stadium = allStadiums.find(s => s.id === stadiumId)
      if (!stadium) return null
      const parts = [avg(r.food), avg(r.atmosphere), avg(r.seats)].filter((n): n is number => n != null)
      const overall = parts.length > 0 ? parts.reduce((s, n) => s + n, 0) / parts.length : null
      return { stadium, overall, food: avg(r.food), atmosphere: avg(r.atmosphere), seats: avg(r.seats) }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.overall !== null)
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))

  // Scored games are the ones with a final score logged.
  const scoredVisits = allVisits.filter(v => v.home_runs != null && v.away_runs != null)

  // Your team's record at the games you attended. This used to be the home
  // team's result at every game, which reads as "your" record but isn't: the
  // Mariners can be 1-1 when you're there while the home teams went 2-2.
  const favStadium = favAbbr ? allStadiums.find(st => st.abbreviation === favAbbr) ?? null : null
  const favTeamName = favStadium?.team ?? null
  const favGames = favTeamName
    ? scoredVisits.filter(v => sameTeam(v.home_team, favTeamName) || sameTeam(v.visiting_team, favTeamName))
    : []
  const favWon = (v: StadiumVisit) =>
    sameTeam(v.home_team, favTeamName) ? v.home_runs! > v.away_runs! : v.away_runs! > v.home_runs!
  const favWins = favGames.filter(favWon).length
  const favLosses = favGames.length - favWins

  // Teams seen play, home or away: a second chase alongside the 30 parks.
  const teamsSeen = allStadiums.filter(st =>
    allVisits.some(v => sameTeam(v.home_team, st.team) || sameTeam(v.visiting_team, st.team))
  ).length

  // Games by season
  const yearCounts: Record<string, number> = {}
  for (const v of allVisits) {
    const yr = v.visit_date.slice(0, 4)
    yearCounts[yr] = (yearCounts[yr] ?? 0) + 1
  }
  const byYear = Object.entries(yearCounts).sort((a, b) => a[0].localeCompare(b[0]))
  const maxYearCount = Math.max(...byYear.map(([, c]) => c), 1)

  // Most visited ballparks. Only parks with 2+ visits make the list, since a
  // ranking where everything is tied at one visit says nothing.
  const stadiumVisitCounts: Record<string, number> = {}
  for (const v of allVisits) stadiumVisitCounts[v.stadium_id] = (stadiumVisitCounts[v.stadium_id] ?? 0) + 1
  const mostVisited = Object.entries(stadiumVisitCounts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ stadium: allStadiums.find(s => s.id === id), count }))
    .filter((r): r is { stadium: Stadium; count: number } => !!r.stadium)

  // Slimmed rows for the client-side record cards (see StatsRecords.tsx).
  const recordVisits: RecordVisit[] = allVisits.map(v => ({
    id: v.id, stadium_id: v.stadium_id, visit_date: v.visit_date, first_pitch_time: v.first_pitch_time,
    home_team: v.home_team, visiting_team: v.visiting_team, home_runs: v.home_runs, away_runs: v.away_runs,
    attendance: v.attendance, temperature: v.temperature, weather: v.weather,
    winning_pitcher: v.winning_pitcher, losing_pitcher: v.losing_pitcher,
    home_starter_name: v.home_starter_name, away_starter_name: v.away_starter_name,
  }))
  const recordStadiums: RecordStadium[] = visitedStadiums.map(st => ({
    id: st.id, name: st.name, abbreviation: st.abbreviation, lat: st.lat, lng: st.lng,
  }))

  // Where the money goes, by category. Hotel counts both per-stop hotels and
  // the trip-level hotel that single-destination trips use.
  const spend: Record<string, number> = { Tickets: 0, Food: 0, Parking: 0, Hotel: 0, 'Local Transport': 0, Travel: 0 }
  for (const t of allTrips) {
    spend.Travel += Number(t.actual_travel ?? 0)
    spend.Hotel += Number(t.actual_hotel ?? 0)
    for (const stp of t.trip_stops ?? []) {
      spend.Tickets += Number(stp.actual_tickets ?? 0)
      spend.Food += Number(stp.actual_food ?? 0)
      spend.Parking += Number(stp.actual_parking ?? 0)
      spend.Hotel += Number(stp.actual_hotel ?? 0)
      spend['Local Transport'] += Number(stp.actual_local_transport ?? 0)
    }
  }
  const spendRows = Object.entries(spend).filter(([, amt]) => amt > 0).sort((a, b) => b[1] - a[1])
  const tripsWithSpend = allTrips
    .map(t => ({ name: t.name, total: tripActualSpent(t, t.trip_stops) }))
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)
  const priciestTrip = tripsWithSpend[0] ?? null
  const avgPerTrip = tripsWithSpend.length > 0 ? totalSpent / tripsWithSpend.length : 0

  // Fun totals
  const runsSeen = scoredVisits.reduce((sum, v) => sum + v.home_runs! + v.away_runs!, 0)
  const fansSeen = allVisits.reduce((sum, v) => sum + (v.attendance ?? 0), 0)
  const visitsWithInnings = allVisits.filter(v => (v.inning_scores?.length ?? 0) > 0)
  const extraInningGames = visitsWithInnings.filter(v => v.inning_scores.length > 9).length
  const oneRunGames = scoredVisits.filter(v => Math.abs(v.home_runs! - v.away_runs!) === 1).length
  const funTiles: { emoji: string; value: string; label: string; sub: string }[] = []
  if (scoredVisits.length > 0) {
    funTiles.push({ emoji: '🏃', value: runsSeen.toLocaleString(), label: 'Runs seen', sub: `across ${scoredVisits.length} scored game${scoredVisits.length !== 1 ? 's' : ''}` })
  }
  if (fansSeen > 0) {
    funTiles.push({ emoji: '👥', value: fansSeen.toLocaleString(), label: 'Fans in the park with you', sub: 'combined attendance' })
  }
  if (visitsWithInnings.length > 0) {
    funTiles.push({ emoji: '⏱️', value: String(extraInningGames), label: 'Extra-inning games', sub: `of ${visitsWithInnings.length} game${visitsWithInnings.length !== 1 ? 's' : ''}` })
  }
  if (scoredVisits.length > 0) {
    funTiles.push({ emoji: '🤏', value: String(oneRunGames), label: 'One-run games', sub: `of ${scoredVisits.length} scored game${scoredVisits.length !== 1 ? 's' : ''}` })
  }

  // Game-day moments logged across your visits
  const momentCounts = GAME_MOMENTS
    .map(m => ({ ...m, count: allVisits.filter(v => v.moments?.includes(m.id)).length }))
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count)

  // Timeline: full game log, bookends, and seasonality (Apr-Oct always shown,
  // plus any month outside that window that actually has games).
  const gameLog = [...allVisits].sort((a, b) => b.visit_date.localeCompare(a.visit_date))
  const firstGame = gameLog.length > 0 ? gameLog[gameLog.length - 1] : null
  const latestGame = gameLog.length > 1 ? gameLog[0] : null
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthOfYear = Array.from({ length: 12 }, () => 0)
  for (const v of allVisits) monthOfYear[Number(v.visit_date.slice(5, 7)) - 1]++
  const activeMonths = monthOfYear.map((c, i) => (c > 0 ? i : -1)).filter(i => i >= 0)
  const monthLo = Math.min(3, ...activeMonths)
  const monthHi = Math.max(9, ...activeMonths)
  const monthBars = monthOfYear.slice(monthLo, monthHi + 1).map((count, i) => ({ label: MONTH_LABELS[monthLo + i], count }))
  const maxMonthCount = Math.max(...monthBars.map(m => m.count), 1)
  const stadiumById = new Map(allStadiums.map(st => [st.id, st]))

  // Beyond the 30
  const milbEntries = allBaseballLife.filter(e => e.category === 'minor_league')
  const milbVenueMap: Record<string, { venue: string; city: string | null; state: string | null; count: number; first: string; last: string }> = {}
  for (const e of milbEntries) {
    const key = e.venue ?? 'Unknown park'
    const cur = milbVenueMap[key]
    if (!cur) milbVenueMap[key] = { venue: key, city: e.city, state: e.state, count: 1, first: e.visit_date, last: e.visit_date }
    else {
      cur.count++
      if (e.visit_date < cur.first) cur.first = e.visit_date
      if (e.visit_date > cur.last) cur.last = e.visit_date
    }
  }
  const milbParks = Object.values(milbVenueMap)
    .sort((a, b) => b.count - a.count)
    .map(pk => {
      const meta = milbStadiums.find(m => m.name.toLowerCase() === pk.venue.toLowerCase())
      return { ...pk, team: meta?.team ?? null, level: meta?.level ?? null }
    })

  const eventEntries = allBaseballLife
    .filter(e => e.category === 'mlb_special_event' || e.category === 'spring_training')
    .map(e => ({
      name: e.event_type ?? e.venue ?? 'Event',
      date: e.visit_date,
      kind: e.category === 'spring_training' ? 'Spring Training' : 'Special Event',
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  // Pilgrimages can be logged two ways (the original manual log, and the trip
  // flow's destination visits). De-dupe so one visit isn't listed twice.
  const pilgrimageSeen = new Set<string>()
  const pilgrimages = [
    ...allBaseballLife.filter(e => e.category === 'pilgrimage').map(e => ({ name: e.venue ?? e.event_type ?? 'Pilgrimage', date: e.visit_date })),
    ...destVisits.map(d => ({ name: d.destination?.name ?? 'Destination', date: d.visit_date })),
  ]
    .filter(pg => {
      const key = `${pg.date}|${pg.name.toLowerCase().split(' ').slice(0, 2).join(' ')}`
      if (pilgrimageSeen.has(key)) return false
      pilgrimageSeen.add(key)
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const collectionCounts = { giveaway: 0, food: 0, souvenir: 0 }
  const giveawayTypeCounts: Record<string, number> = {}
  for (const c of collectibles) {
    if (c.category in collectionCounts) collectionCounts[c.category as keyof typeof collectionCounts]++
    if (c.category === 'giveaway') {
      const t = c.giveaway_type ?? 'other'
      giveawayTypeCounts[t] = (giveawayTypeCounts[t] ?? 0) + 1
    }
  }
  const GIVEAWAY_LABELS: Record<string, string> = { jersey: 'Jerseys', bobblehead: 'Bobbleheads', tshirt: 'T-shirts', hat: 'Hats', other: 'Other' }
  const giveawayBreakdown = Object.entries(giveawayTypeCounts).sort((a, b) => b[1] - a[1])
  const beyondTotal = allBaseballLife.length + destVisits.length

  // Farthest trip — from chronologically first visited stadium to all others
  let farthestStadium: Stadium | null = null
  let farthestMiles = 0
  if (visitedStadiums.length >= 2) {
    const firstVisitId = [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0]?.stadium_id
    const origin = allStadiums.find(s => s.id === firstVisitId) ?? visitedStadiums[0]
    for (const s of visitedStadiums) {
      if (s.id === origin.id) continue
      const dist = haversineDistance(origin.lat, origin.lng, s.lat, s.lng)
      if (dist > farthestMiles) {
        farthestMiles = dist
        farthestStadium = s
      }
    }
  }

  // Top teams seen
  const teamSeenData = Object.entries(teamSeenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Division breakdown
  const divBreakdown = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'].map((div) => {
    const [league, division] = div.split(' ')
    const group = allStadiums
      .filter((st) => st.league === league && st.division === division)
      .sort((a, b) => a.team.localeCompare(b.team))
    const visited = group.filter((st) => visitedIds.has(st.id)).length
    return { label: div, visited, total: group.length, group }
  })

  // Consecutive years with at least one game attended
  const yearsWithGames = [...new Set(allVisits.map((v) => new Date(v.visit_date + 'T12:00:00').getFullYear()))].sort()
  let longestYearStreak = 0
  let currentYearStreak = 0
  let prevYear: number | null = null
  for (const yr of yearsWithGames) {
    if (prevYear === null || yr === prevYear + 1) {
      currentYearStreak++
    } else {
      longestYearStreak = Math.max(longestYearStreak, currentYearStreak)
      currentYearStreak = 1
    }
    prevYear = yr
  }
  longestYearStreak = Math.max(longestYearStreak, currentYearStreak)

  // Longest consecutive-day stadium streak (unique stadiums on consecutive dates)
  const visitsByDate = new Map<string, Set<string>>()
  for (const v of allVisits) {
    if (!visitsByDate.has(v.visit_date)) visitsByDate.set(v.visit_date, new Set())
    visitsByDate.get(v.visit_date)!.add(v.stadium_id)
  }
  const sortedDates = [...visitsByDate.keys()].sort()
  let longestTripStreak = 0
  const uniqueInStreak = new Set<string>()
  for (let i = 0; i < sortedDates.length; i++) {
    const d = new Date(sortedDates[i] + 'T12:00:00')
    if (i === 0) {
      visitsByDate.get(sortedDates[i])!.forEach((id) => uniqueInStreak.add(id))
    } else {
      const prev = new Date(sortedDates[i - 1] + 'T12:00:00')
      const dayDiff = (d.getTime() - prev.getTime()) / 86400000
      if (dayDiff <= 2) {
        visitsByDate.get(sortedDates[i])!.forEach((id) => uniqueInStreak.add(id))
      } else {
        longestTripStreak = Math.max(longestTripStreak, uniqueInStreak.size)
        uniqueInStreak.clear()
        visitsByDate.get(sortedDates[i])!.forEach((id) => uniqueInStreak.add(id))
      }
    }
  }
  longestTripStreak = Math.max(longestTripStreak, uniqueInStreak.size)

  const statCards = [
    {
      icon: <TrendingUp size={20} />,
      label: 'Total Games',
      value: totalGames.toString(),
      sub: `${mlbGames} MLB · ${milbGames} MiLB`,
      color: '#1F6FEB',
    },
    {
      icon: <Users size={20} />,
      label: 'Teams Seen',
      value: `${teamsSeen} / 30`,
      sub: teamsSeen > 0 ? 'home or away, at any park' : 'Log a game to start the count',
      color: '#06b6d4',
    },
    {
      icon: <Star size={20} />,
      label: 'Beyond the 30',
      value: beyondTotal.toString(),
      sub: beyondTotal > 0 ? 'MiLB, events, pilgrimages & more' : 'Log experiences to see breakdown',
      color: '#F5A623',
    },
    {
      icon: <DollarSign size={20} />,
      label: 'Total Spent',
      value: formatCurrency(totalSpent),
      sub: totalSpent > 0 ? 'across all trips' : 'Add actual costs to a trip',
      color: '#3FB950',
    },
    {
      icon: <Trophy size={20} />,
      label: favTeamName ? `${teamNickname(favTeamName)} Record` : 'W-L Record',
      value: favGames.length > 0 ? `${favWins}-${favLosses}` : 'N/A',
      sub: favGames.length > 0 ? `${Math.round((favWins / favGames.length) * 100)}% win rate at your games` : favTeamName ? 'No scores logged yet' : 'Set a favorite team in Settings',
      color: '#58A6FF',
    },
    {
      icon: <Award size={20} />,
      label: 'Favorite Division',
      value: favDivision,
      sub: divisionCounts[favDivision] ? `${divisionCounts[favDivision]} stadium${divisionCounts[favDivision] !== 1 ? 's' : ''} visited` : 'Visit more stadiums',
      color: '#a78bfa',
    },
    {
      icon: <MapPin size={20} />,
      label: 'Farthest Trip',
      value: farthestStadium ? farthestStadium.name : visitedStadiums.length < 2 ? 'Visit more stadiums' : 'N/A',
      sub: farthestStadium ? `~${Math.round(farthestMiles).toLocaleString()} miles from first` : '',
      color: '#06b6d4',
    },
  ]

  const listRow = (name: string, count: number, max: number, color: string) => (
    <div key={name} className="flex items-center gap-3">
      <div className="text-sm w-36 truncate" style={{ color: '#8B949E' }}>{name}</div>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, backgroundColor: '#30363D' }}>
        <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, backgroundColor: color }} />
      </div>
      <div className="text-sm font-bold w-6 text-right" style={{ color }}>{count}</div>
    </div>
  )

  const emptyCard = (message: string) => (
    <div className="card p-8 text-center text-sm" style={{ color: '#8B949E' }}>{message}</div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#E6EDF3', margin: '0 0 16px' }}>Stats</h1>

      {/* Section switcher */}
      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 2 }}>
        {TABS.map(t => {
          const active = t.key === tab
          return (
            <Link
              key={t.key}
              href={`/stats?tab=${t.key}`}
              style={{
                padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 700,
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                backgroundColor: active ? '#1F6FEB' : '#161B22',
                color: active ? '#fff' : '#8B949E',
                border: `1px solid ${active ? '#1F6FEB' : '#30363D'}`,
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {/* ESPN-style hero stat */}
          <div
            className="card mb-8 p-8 text-center"
            style={{
              background: 'linear-gradient(135deg, #131d35 0%, #0f1729 100%)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(63,185,80,0.08) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="text-base font-bold uppercase tracking-widest mb-3" style={{ color: '#8B949E', letterSpacing: '0.2em' }}>
                MLB Parks Visited
              </div>
              <div
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 900,
                  color: '#3FB950',
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  textShadow: '0 0 40px rgba(63,185,80,0.35)',
                }}
              >
                {visitedIds.size}
              </div>
              <div className="text-2xl font-bold mt-2" style={{ color: '#E6EDF3' }}>
                of 30 stadiums
              </div>
              <div className="text-lg mt-1" style={{ color: '#8B949E' }}>
                {Math.round((visitedIds.size / 30) * 100)}% of your MLB journey complete
              </div>
              <div className="rounded-full overflow-hidden mt-5 mx-auto" style={{ height: 6, maxWidth: 320, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div
                  style={{
                    width: `${(visitedIds.size / 30) * 100}%`,
                    height: '100%',
                    backgroundColor: '#3FB950',
                    borderRadius: 9999,
                    boxShadow: visitedIds.size > 0 ? '0 0 12px rgba(63,185,80,0.5)' : 'none',
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Headline tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {statCards.map(({ icon, label, value, sub, color }) => (
              <div key={label} className="card p-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <span style={{ color }}>{icon}</span>
                  <span className="text-base font-bold uppercase tracking-wider" style={{ color: '#8B949E' }}>
                    {label}
                  </span>
                </div>
                <div className="text-3xl font-black leading-tight truncate" style={{ color: '#E6EDF3' }}>
                  {value}
                </div>
                {sub && (
                  <div className="text-base mt-1.5" style={{ color: '#8B949E' }}>
                    {sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Division breakdown + full checklist */}
          <div className="card p-6">
            <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
              Progress by Division
            </div>
            <div className="flex flex-col gap-5">
              {divBreakdown.map(({ label, visited, total, group }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: '#8B949E' }}>{label}</span>
                    <span style={{ color: visited === total ? '#3FB950' : '#8B949E' }}>
                      {visited} / {total}
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden mb-3" style={{ height: 6, backgroundColor: '#30363D' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(visited / total) * 100}%`,
                        backgroundColor: visited === total ? '#3FB950' : '#1F6FEB',
                        transition: 'width 0.5s',
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {group.map(st => {
                      const isVisited = visitedIds.has(st.id)
                      return (
                        <div
                          key={st.id}
                          className="flex items-center gap-2 p-2 rounded-lg text-sm"
                          style={{ backgroundColor: '#0d1424', opacity: isVisited ? 1 : 0.4 }}
                        >
                          <TeamLogo abbreviation={st.abbreviation} size={26} style={{ flexShrink: 0 }} />
                          <div className="truncate" style={{ color: isVisited ? '#E6EDF3' : '#8B949E', fontSize: '0.9rem' }}>
                            {st.team}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {spendRows.length > 0 && (
            <div className="card p-6 mt-6">
              <div className="flex items-center gap-2 font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                <DollarSign size={18} style={{ color: '#3FB950' }} />
                Where the Money Goes
              </div>
              <div className="flex flex-col gap-3 mb-5">
                {spendRows.map(([category, amt]) => listRow(category, amt, spendRows[0][1], '#3FB950'))}
              </div>
              <div className="flex flex-wrap gap-4 pt-4" style={{ borderTop: '1px solid #30363D' }}>
                {priciestTrip && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8B949E' }}>Priciest Trip</div>
                    <div className="text-sm font-semibold mt-1" style={{ color: '#E6EDF3' }}>{priciestTrip.name}</div>
                    <div className="text-sm" style={{ color: '#3FB950' }}>{formatCurrency(priciestTrip.total)}</div>
                  </div>
                )}
                {avgPerTrip > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8B949E' }}>Average per Trip</div>
                    <div className="text-sm font-semibold mt-1" style={{ color: '#E6EDF3' }}>{formatCurrency(avgPerTrip)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── RECORDS ────────────────────────────────────────────────────────── */}
      {tab === 'records' && (
        allVisits.length === 0 ? emptyCard('Log some games to see your records.') : (
          <div className="flex flex-col gap-6">
            <BestGamesCard visits={recordVisits} stadiums={recordStadiums} />

            {funTiles.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {funTiles.map(({ emoji, value, label, sub }) => (
                  <div key={label} className="card p-5">
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
                    <div className="text-2xl font-black" style={{ color: '#E6EDF3' }}>{value}</div>
                    <div className="text-sm mt-1" style={{ color: '#8B949E' }}>{label}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#8B949E' }}>{sub}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="card p-6">
              <div className="flex items-center gap-2 font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                <TrendingUp size={18} style={{ color: '#1F6FEB' }} />
                Streaks
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
                  <div className="text-4xl font-bold" style={{ color: '#1F6FEB' }}>
                    {longestYearStreak}
                  </div>
                  <div className="text-sm mt-1" style={{ color: '#8B949E' }}>
                    Consecutive year{longestYearStreak !== 1 ? 's' : ''} with a game
                  </div>
                  {yearsWithGames.length > 0 && (
                    <div className="text-xs mt-1" style={{ color: '#8B949E' }}>
                      {yearsWithGames[0]}-{yearsWithGames[yearsWithGames.length - 1]}
                    </div>
                  )}
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
                  <div className="text-4xl font-bold" style={{ color: '#a78bfa' }}>
                    {longestTripStreak}
                  </div>
                  <div className="text-sm mt-1" style={{ color: '#8B949E' }}>
                    Stadiums in one road trip
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#8B949E' }}>
                    consecutive-day streak
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
                  <div className="text-4xl font-bold" style={{ color: '#3FB950' }}>
                    {yearsWithGames.length}
                  </div>
                  <div className="text-sm mt-1" style={{ color: '#8B949E' }}>
                    Season{yearsWithGames.length !== 1 ? 's' : ''} attended
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#8B949E' }}>
                    unique calendar years
                  </div>
                </div>
              </div>
            </div>

            {momentCounts.length > 0 && (
              <div className="card p-6">
                <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                  Game-Day Moments
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {momentCounts.map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#E6EDF3' }}>{m.label}</div>
                        <div className="text-xs" style={{ color: '#8B949E' }}>{m.count} time{m.count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DayNightCard visits={recordVisits} stadiums={recordStadiums} />
          </div>
        )
      )}

      {/* ── RANKINGS ───────────────────────────────────────────────────────── */}
      {tab === 'rankings' && (
        allVisits.length === 0 ? emptyCard('Log some games to see your rankings.') : (
          <div className="flex flex-col gap-6">
            {/* Your Ballpark Rankings */}
            {ballparkRankings.length > 0 ? (
              <div className="card p-6">
                <div className="flex items-center gap-2 font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                  <Star size={18} style={{ color: '#F5A623' }} />
                  Your Ballpark Rankings
                </div>
                <div className="flex flex-col gap-3">
                  {ballparkRankings.map((r, i) => (
                    <div key={r.stadium.id} className="flex items-center gap-4 p-3 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
                      <div className="text-lg font-bold w-6 text-center flex-shrink-0" style={{ color: i === 0 ? '#F5A623' : '#8B949E' }}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold" style={{ color: '#E6EDF3', fontSize: '0.96rem' }}>
                          {r.stadium.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: '#8B949E' }}>
                          {r.stadium.team}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} size={16} color="#F5A623" fill={n <= Math.round(r.overall ?? 0) ? '#F5A623' : 'none'} strokeWidth={1.5} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card p-6">
                <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: '#E6EDF3' }}>
                  <Star size={18} style={{ color: '#F5A623' }} />
                  Your Ballpark Rankings
                </div>
                <div className="text-sm" style={{ color: '#8B949E' }}>
                  Rate a visit (food, atmosphere, seats) when you log or edit a game, and your parks will rank here.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most visited ballparks */}
              {mostVisited.length > 0 && (
                <div className="card p-6">
                  <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                    Most Visited Ballparks
                  </div>
                  <div className="flex flex-col gap-3">
                    {mostVisited.map(({ stadium, count }) =>
                      listRow(stadium.name, count, mostVisited[0].count, '#3FB950')
                    )}
                  </div>
                </div>
              )}

              {/* Most games with */}
              <div className="card p-6">
                <div className="flex items-center gap-2 font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                  <Users size={18} style={{ color: '#58A6FF' }} />
                  Most Games With
                </div>
                {topCompanions.length === 0 ? (
                  <div className="text-sm" style={{ color: '#8B949E' }}>
                    Add companions when you log a game to see who you go with most.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topCompanions.map(([name, count]) => listRow(name, count, topCompanions[0][1], '#58A6FF'))}
                  </div>
                )}
              </div>
            </div>

            {/* Most seen teams */}
            <div className="card p-6">
              <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                Most Seen Teams
              </div>
              {teamSeenData.length === 0 ? (
                <div className="text-sm" style={{ color: '#8B949E' }}>
                  Log some games to see team stats
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {teamSeenData.map(([team, count]) => listRow(team, count as number, teamSeenData[0][1] as number, '#F5A623'))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── TIMELINE ───────────────────────────────────────────────────────── */}
      {tab === 'timeline' && (
        allVisits.length === 0 ? emptyCard('Log some games to see your timeline.') : (
          <div className="flex flex-col gap-6">
            {(firstGame || latestGame) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {firstGame && (
                  <div className="card p-5">
                    <div className="text-sm font-bold" style={{ color: '#8B949E' }}>⭐ First Game</div>
                    <div className="font-semibold mt-1" style={{ color: '#E6EDF3' }}>
                      {stadiumById.get(firstGame.stadium_id)?.name ?? '-'}
                    </div>
                    <div className="text-sm mt-1" style={{ color: '#8B949E' }}>
                      {new Date(firstGame.visit_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
                {latestGame && (
                  <div className="card p-5">
                    <div className="text-sm font-bold" style={{ color: '#8B949E' }}>🗓️ Latest Game</div>
                    <div className="font-semibold mt-1" style={{ color: '#E6EDF3' }}>
                      {stadiumById.get(latestGame.stadium_id)?.name ?? '-'}
                    </div>
                    <div className="text-sm mt-1" style={{ color: '#8B949E' }}>
                      {new Date(latestGame.visit_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Games by month of year — fixed Apr-Oct window (plus any outlier
                month), unlike a running month-by-month chart, this doesn't
                grow illegibly as years of history pile up. */}
            <div className="card p-6">
              <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                Games by Month
              </div>
              <div className="flex items-end gap-2" style={{ height: 140 }}>
                {monthBars.map(({ label, count }) => (
                  <div key={label} className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-xs font-medium" style={{ color: count > 0 ? '#1F6FEB' : '#30363D' }}>
                      {count > 0 ? count : ''}
                    </div>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(count / maxMonthCount) * 100}px`,
                        backgroundColor: count > 0 ? '#1F6FEB' : '#21262D',
                        minHeight: 4,
                      }}
                    />
                    <div className="text-xs text-center" style={{ color: '#8B949E', fontSize: '0.78rem' }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Games by season */}
            {byYear.length > 0 && (
              <div className="card p-6">
                <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                  Games by Season
                </div>
                <div className="flex flex-col gap-3">
                  {byYear.map(([year, count]) => (
                    <div key={year} className="flex items-center gap-3">
                      <div className="text-sm font-bold w-10 flex-shrink-0" style={{ color: '#8B949E' }}>{year}</div>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, backgroundColor: '#30363D' }}>
                        <div className="h-full rounded-full" style={{ width: `${(count / maxYearCount) * 100}%`, background: 'linear-gradient(90deg, #1F6FEB, #58A6FF)' }} />
                      </div>
                      <div className="text-sm font-bold w-6 text-right" style={{ color: '#E6EDF3' }}>{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <YearRecap allVisits={allVisits} allStadiums={allStadiums} />

            {/* Full game log, newest first */}
            <div className="card p-6">
              <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                Game Log
              </div>
              <div className="flex flex-col gap-2" style={{ maxHeight: 480, overflowY: 'auto' }}>
                {gameLog.map(v => {
                  const st = stadiumById.get(v.stadium_id)
                  const scored = v.home_runs != null && v.away_runs != null
                  return (
                    <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg text-sm" style={{ backgroundColor: '#0d1424' }}>
                      {st && <TeamLogo abbreviation={st.abbreviation} size={28} style={{ flexShrink: 0 }} />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold" style={{ color: '#E6EDF3' }}>
                          {st?.name ?? 'Unknown park'}
                        </div>
                        <div className="text-xs truncate" style={{ color: '#8B949E' }}>
                          {new Date(v.visit_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {v.visiting_team && v.home_team ? ` · ${v.visiting_team.replace(/^vs\.?\s+/i, '')} @ ${v.home_team}` : ''}
                        </div>
                      </div>
                      {scored && (
                        <div className="text-sm font-bold flex-shrink-0" style={{ color: '#8B949E' }}>
                          {v.away_runs}-{v.home_runs}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── BEYOND THE 30 ────────────────────────────────────────────────── */}
      {tab === 'beyond' && (
        beyondTotal === 0 ? emptyCard('Log a MiLB game, special event, or pilgrimage to see it here.') : (
          <div className="flex flex-col gap-6">
            {milbParks.length > 0 && (
              <div className="card p-6">
                <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                  Minor League Parks
                </div>
                <div className="flex flex-col gap-3">
                  {milbParks.map(pk => (
                    <div key={pk.venue} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate" style={{ color: '#E6EDF3' }}>{pk.venue}</div>
                        <div className="text-xs truncate" style={{ color: '#8B949E' }}>
                          {[pk.team, pk.level, [pk.city, pk.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="text-sm font-bold flex-shrink-0" style={{ color: '#F5A623' }}>
                        {pk.count} game{pk.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {eventEntries.length > 0 && (
                <div className="card p-6">
                  <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                    Special Events & Spring Training
                  </div>
                  <div className="flex flex-col gap-2">
                    {eventEntries.map((e, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg text-sm" style={{ backgroundColor: '#0d1424' }}>
                        <div className="min-w-0 truncate" style={{ color: '#E6EDF3' }}>{e.name}</div>
                        <div className="text-xs flex-shrink-0 ml-2" style={{ color: '#8B949E' }}>
                          {e.kind} · {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pilgrimages.length > 0 && (
                <div className="card p-6">
                  <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                    Pilgrimages
                  </div>
                  <div className="flex flex-col gap-2">
                    {pilgrimages.map((pg, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg text-sm" style={{ backgroundColor: '#0d1424' }}>
                        <div className="min-w-0 truncate" style={{ color: '#E6EDF3' }}>{pg.name}</div>
                        <div className="text-xs flex-shrink-0 ml-2" style={{ color: '#8B949E' }}>
                          {new Date(pg.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {collectibles.length > 0 && (
              <div className="card p-6">
                <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                  Your Collection
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Giveaways', count: collectionCounts.giveaway, color: '#F5A623' },
                    { label: 'Food', count: collectionCounts.food, color: '#3FB950' },
                    { label: 'Souvenirs', count: collectionCounts.souvenir, color: '#58A6FF' },
                  ].map(c => (
                    <div key={c.label} className="p-4 rounded-xl text-center" style={{ backgroundColor: '#0d1424' }}>
                      <div className="text-2xl font-black" style={{ color: c.color }}>{c.count}</div>
                      <div className="text-sm mt-1" style={{ color: '#8B949E' }}>{c.label}</div>
                    </div>
                  ))}
                </div>
                {giveawayBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {giveawayBreakdown.map(([type, count]) => (
                      <div key={type} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(245,166,35,0.1)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.25)' }}>
                        {GIVEAWAY_LABELS[type] ?? type}: {count}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
