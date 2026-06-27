import { createClient } from '@/lib/supabase-server'
import { haversineDistance, formatCurrency } from '@/lib/utils'
import type { Stadium, StadiumVisit, Trip } from '@/types'
import { BarChart3, TrendingUp, DollarSign, MapPin, Trophy, Users, Star } from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'
import YearRecap from '@/components/YearRecap'

export default async function StatsPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: trips }, { data: bleRows }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('trips').select('*'),
    supabase.from('baseball_life_entries').select('id, category, is_game'),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allTrips: Trip[] = trips ?? []
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

  // Total spent across completed trips
  const totalSpent = allTrips
    .filter((t) => t.status === 'completed')
    .reduce(
      (sum, t) =>
        sum + t.actual_tickets + t.actual_travel + t.actual_hotel + t.actual_food + t.actual_parking,
      0
    )

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
  const topTeamSeen =
    Object.entries(teamSeenCounts).sort((a, b) => b[1] - a[1])[0] ?? ['N/A', 0]

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
      icon: <Trophy size={20} />,
      label: 'Favorite Division',
      value: favDivision,
      sub: divisionCounts[favDivision] ? `${divisionCounts[favDivision]} stadium${divisionCounts[favDivision] !== 1 ? 's' : ''} visited` : 'Visit more stadiums',
      color: '#a78bfa',
    },
    {
      icon: <Users size={20} />,
      label: 'Most Seen Team',
      value: topTeamSeen[0] as string,
      sub: topTeamSeen[1] ? `${topTeamSeen[1]} game${(topTeamSeen[1] as number) !== 1 ? 's' : ''}` : 'No games yet',
      color: '#F5A623',
    },
    {
      icon: <MapPin size={20} />,
      label: 'Farthest Trip',
      value: farthestStadium ? farthestStadium.name : visitedStadiums.length < 2 ? 'Visit more stadiums' : 'N/A',
      sub: farthestStadium ? `~${Math.round(farthestMiles).toLocaleString()} miles from first` : '',
      color: '#06b6d4',
    },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
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

      {/* Stat cards */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {teamSeenData.map(([team, count]) => {
                const max = teamSeenData[0][1] as number
                return (
                  <div key={team} className="flex items-center gap-3">
                    <div className="text-sm w-36 truncate" style={{ color: '#8B949E' }}>
                      {team}
                    </div>
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, backgroundColor: '#30363D' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((count as number) / max) * 100}%`,
                          backgroundColor: '#F5A623',
                        }}
                      />
                    </div>
                    <div className="text-sm font-bold w-6 text-right" style={{ color: '#F5A623' }}>
                      {count}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Games over time */}
        {monthlyData.length > 0 && (
          <div className="card p-6 lg:col-span-2">
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

        {/* Stadiums visited list */}
        <div className="card p-6 lg:col-span-2">
          <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
            Visited Stadiums
          </div>
          {visitedStadiums.length === 0 ? (
            <div className="text-sm" style={{ color: '#8B949E' }}>
              No stadiums visited yet. Start logging your games!
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
              {visitedStadiums.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 p-2 rounded-lg text-sm"
                  style={{ backgroundColor: '#0d1424' }}
                >
                  <TeamLogo abbreviation={s.abbreviation} size={33} style={{ flexShrink: 0 }} />
                  <div className="min-w-0">
                    <div className="truncate" style={{ color: '#E6EDF3', fontSize: '0.96rem' }}>
                      {s.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: '#8B949E' }}>
                      {s.team}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Streaks */}
      {allVisits.length > 0 && (
        <div className="mt-6 card p-6">
          <div className="flex items-center gap-2 font-semibold mb-4" style={{ color: '#E6EDF3' }}>
            <TrendingUp size={18} style={{ color: '#1F6FEB' }} />
            Streaks &amp; Records
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
                  {yearsWithGames[0]}–{yearsWithGames[yearsWithGames.length - 1]}
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
      )}

      {allVisits.length > 0 && (
        <div className="mt-6">
          <YearRecap allVisits={allVisits} allStadiums={allStadiums} />
        </div>
      )}

    </div>
  )
}
