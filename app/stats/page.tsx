import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { haversineDistance, formatCurrency } from '@/lib/utils'
import { tripActualSpent } from '@/lib/trip-spend'
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
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams
  const tab: TabKey = TABS.find(t => t.key === tabParam)?.key ?? 'overview'

  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: trips }, { data: bleRows }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('trips').select('*, trip_stops(est_tickets, est_food, est_parking, est_hotel, est_local_transport, actual_tickets, actual_food, actual_parking, actual_hotel, actual_local_transport)'),
    supabase.from('baseball_life_entries').select('id, category, is_game'),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allTrips = (trips ?? []) as TripWithStopBudgets[]
  const allBaseballLife = (bleRows ?? []) as { id: string; category: string; is_game: boolean }[]

  const mlbGames = allVisits.length
  const milbGames = allBaseballLife.filter(e => e.category === 'minor_league' && e.is_game).length
  const totalGames = mlbGames + milbGames

  const bleMinorLeague = allBaseballLife.filter(e => e.category === 'minor_league').length
  const bleSpecialEvents = allBaseballLife.filter(e => e.category === 'mlb_special_event').length
  const bleSpringTraining = allBaseballLife.filter(e => e.category === 'spring_training').length
  const blePilgrimages = allBaseballLife.filter(e => e.category === 'pilgrimage').length
  const beyondThe30Total = allBaseballLife.length

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

  // W-L across attended games that have a logged score. A "win" is the home
  // team winning, which is how this has always been counted.
  const scoredVisits = allVisits.filter(v => v.home_runs != null && v.away_runs != null)
  const wins = scoredVisits.filter(v => v.home_runs! > v.away_runs!).length
  const losses = scoredVisits.filter(v => v.home_runs! < v.away_runs!).length

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

  // Games by month
  const monthCounts: Record<string, number> = {}
  for (const v of allVisits) {
    const month = new Date(v.visit_date + 'T12:00:00').toLocaleString('en-US', { month: 'short', year: 'numeric' })
    monthCounts[month] = (monthCounts[month] ?? 0) + 1
  }
  const monthlyData = Object.entries(monthCounts).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())

  // Top teams seen
  const teamSeenData = Object.entries(teamSeenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Division breakdown
  const divBreakdown = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'].map((div) => {
    const [league, division] = div.split(' ')
    const group = allStadiums.filter((s) => s.league === league && s.division === division)
    const visited = group.filter((s) => visitedIds.has(s.id)).length
    return { label: div, visited, total: group.length }
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
      icon: <Star size={20} />,
      label: 'Beyond the 30',
      value: beyondThe30Total.toString(),
      sub: [
        bleMinorLeague > 0 ? `${bleMinorLeague} MiLB` : null,
        bleSpecialEvents > 0 ? `${bleSpecialEvents} Events` : null,
        bleSpringTraining > 0 ? `${bleSpringTraining} Spring` : null,
        blePilgrimages > 0 ? `${blePilgrimages} Pilgrimages` : null,
      ].filter(Boolean).join(' · ') || 'Log experiences to see breakdown',
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
      label: 'W-L Record',
      value: scoredVisits.length > 0 ? `${wins}-${losses}` : 'N/A',
      sub: scoredVisits.length > 0 ? `${Math.round((wins / scoredVisits.length) * 100)}% win rate` : 'No scores logged',
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

          {/* Division breakdown */}
          <div className="card p-6">
            <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
              Progress by Division
            </div>
            <div className="flex flex-col gap-4">
              {divBreakdown.map(({ label, visited, total }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: '#8B949E' }}>{label}</span>
                    <span style={{ color: visited === total ? '#3FB950' : '#8B949E' }}>
                      {visited} / {total}
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#30363D' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(visited / total) * 100}%`,
                        backgroundColor: visited === total ? '#3FB950' : '#1F6FEB',
                        transition: 'width 0.5s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── RECORDS ────────────────────────────────────────────────────────── */}
      {tab === 'records' && (
        allVisits.length === 0 ? emptyCard('Log some games to see your records.') : (
          <div className="flex flex-col gap-6">
            <BestGamesCard visits={recordVisits} stadiums={recordStadiums} />

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
            {/* Games over time */}
            {monthlyData.length > 0 && (
              <div className="card p-6">
                <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                  Games Over Time
                </div>
                <div className="flex items-end gap-2" style={{ height: 140 }}>
                  {monthlyData.map(([month, count]) => {
                    const max = Math.max(...monthlyData.map(([, c]) => c as number))
                    return (
                      <div key={month} className="flex flex-col items-center gap-1 flex-1">
                        <div className="text-xs font-medium" style={{ color: '#1F6FEB' }}>
                          {count}
                        </div>
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${((count as number) / max) * 100}px`,
                            backgroundColor: '#1F6FEB',
                            minHeight: 4,
                          }}
                        />
                        <div className="text-xs text-center" style={{ color: '#8B949E', fontSize: '0.78rem' }}>
                          {month}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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

            {/* Stadiums visited list */}
            <div className="card p-6">
              <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
                Visited Stadiums
              </div>
              {visitedStadiums.length === 0 ? (
                <div className="text-sm" style={{ color: '#8B949E' }}>
                  No stadiums visited yet. Start logging your games!
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {visitedStadiums.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center gap-2 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: '#0d1424' }}
                    >
                      <TeamLogo abbreviation={st.abbreviation} size={33} style={{ flexShrink: 0 }} />
                      <div className="min-w-0">
                        <div className="truncate" style={{ color: '#E6EDF3', fontSize: '0.96rem' }}>
                          {st.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: '#8B949E' }}>
                          {st.team}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}
