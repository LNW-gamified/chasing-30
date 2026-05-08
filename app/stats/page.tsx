import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import { haversineDistance, formatCurrency } from '@/lib/utils'
import type { Stadium, StadiumVisit, Trip, SpecialEvent, SpecialEventType } from '@/types'
import { BarChart3, TrendingUp, DollarSign, MapPin, Trophy, Users, Star } from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'

const EVENT_LABELS: Record<SpecialEventType, string> = {
  world_series:      'World Series',
  all_star_game:     'All-Star Game',
  postseason:        'Postseason',
  spring_training:   'Spring Training',
  minor_league:      'Minor League',
  historic_ballpark: 'Historic Ballpark',
  international:     'International',
  other:             'Other',
}

export default async function StatsPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: trips }, { data: events }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('trips').select('*'),
    supabase.from('special_events').select('*'),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allTrips: Trip[] = trips ?? []
  const allEvents: SpecialEvent[] = events ?? []

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

  // Most visited opponent
  const opponentCounts: Record<string, number> = {}
  for (const v of allVisits) {
    if (v.visiting_team) {
      opponentCounts[v.visiting_team] = (opponentCounts[v.visiting_team] ?? 0) + 1
    }
  }
  const topOpponent =
    Object.entries(opponentCounts).sort((a, b) => b[1] - a[1])[0] ?? ['N/A', 0]

  // Farthest trip — from first visited stadium to all others
  let farthestStadium: Stadium | null = null
  let farthestMiles = 0
  if (visitedStadiums.length >= 2) {
    const origin = visitedStadiums[0]
    for (const s of visitedStadiums.slice(1)) {
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

  // Games by team (visiting)
  const teamOpponentData = Object.entries(opponentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Division breakdown
  const divBreakdown = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'].map((div) => {
    const [league, division] = div.split(' ')
    const group = allStadiums.filter((s) => s.league === league && s.division === division)
    const visited = group.filter((s) => visitedIds.has(s.id)).length
    return { label: div, visited, total: group.length }
  })

  const statCards = [
    {
      icon: <BarChart3 size={20} />,
      label: 'Stadiums Visited',
      value: `${visitedIds.size} / 30`,
      sub: `${Math.round((visitedIds.size / 30) * 100)}% complete`,
      color: '#22c55e',
    },
    {
      icon: <TrendingUp size={20} />,
      label: 'Games Attended',
      value: allVisits.length.toString(),
      sub: `across ${visitedIds.size} stadiums`,
      color: '#3b82f6',
    },
    {
      icon: <DollarSign size={20} />,
      label: 'Total Spent',
      value: formatCurrency(totalSpent),
      sub: 'across completed trips',
      color: '#f59e0b',
    },
    {
      icon: <Trophy size={20} />,
      label: 'Favorite Division',
      value: favDivision,
      sub: divisionCounts[favDivision] ? `${divisionCounts[favDivision]} stadiums visited` : 'Visit more stadiums',
      color: '#a78bfa',
    },
    {
      icon: <Users size={20} />,
      label: 'Most Visited Opponent',
      value: topOpponent[0] as string,
      sub: topOpponent[1] ? `${topOpponent[1]} game${(topOpponent[1] as number) !== 1 ? 's' : ''}` : 'No games yet',
      color: '#f97316',
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
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
          Stats
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a8b8c8' }}>
          Your complete MLB journey by the numbers
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {statCards.map(({ icon, label, value, sub, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center gap-2 mb-3" style={{ color }}>
              {icon}
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#a8b8c8' }}>
                {label}
              </span>
            </div>
            <div className="text-xl font-bold leading-tight" style={{ color: '#f1f5f9' }}>
              {value}
            </div>
            {sub && (
              <div className="text-xs mt-1" style={{ color: '#a8b8c8' }}>
                {sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Division breakdown */}
        <div className="card p-6">
          <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>
            Progress by Division
          </div>
          <div className="flex flex-col gap-4">
            {divBreakdown.map(({ label, visited, total }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: '#b8c8d8' }}>{label}</span>
                  <span style={{ color: visited === total ? '#22c55e' : '#a8b8c8' }}>
                    {visited} / {total}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#1f2937' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(visited / total) * 100}%`,
                      backgroundColor: visited === total ? '#22c55e' : '#3b82f6',
                      transition: 'width 0.5s',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most visited opponents */}
        <div className="card p-6">
          <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>
            Most Seen Opponents
          </div>
          {teamOpponentData.length === 0 ? (
            <div className="text-sm" style={{ color: '#a8b8c8' }}>
              Log some games to see opponent stats
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {teamOpponentData.map(([team, count]) => {
                const max = teamOpponentData[0][1] as number
                return (
                  <div key={team} className="flex items-center gap-3">
                    <div className="text-sm w-36 truncate" style={{ color: '#b8c8d8' }}>
                      {team}
                    </div>
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#1f2937' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((count as number) / max) * 100}%`,
                          backgroundColor: '#f97316',
                        }}
                      />
                    </div>
                    <div className="text-sm font-medium w-6 text-right" style={{ color: '#f97316' }}>
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
            <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>
              Games Over Time
            </div>
            <div className="flex items-end gap-2" style={{ height: 100 }}>
              {monthlyData.map(([month, count]) => {
                const max = Math.max(...monthlyData.map(([, c]) => c as number))
                return (
                  <div key={month} className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-xs font-medium" style={{ color: '#3b82f6' }}>
                      {count}
                    </div>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${((count as number) / max) * 70}px`,
                        backgroundColor: '#3b82f6',
                        minHeight: 4,
                      }}
                    />
                    <div className="text-xs text-center" style={{ color: '#a8b8c8', fontSize: '0.78rem' }}>
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
          <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>
            Visited Stadiums
          </div>
          {visitedStadiums.length === 0 ? (
            <div className="text-sm" style={{ color: '#a8b8c8' }}>
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
                    <div className="truncate" style={{ color: '#f1f5f9', fontSize: '0.96rem' }}>
                      {s.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: '#a8b8c8' }}>
                      {s.team}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Special Events section */}
      {allEvents.length > 0 && (
        <div className="mt-6 card p-6">
          <div className="flex items-center gap-2 font-semibold mb-4" style={{ color: '#f1f5f9' }}>
            <Star size={18} style={{ color: '#f59e0b' }} />
            Special Events ({allEvents.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(Object.entries(EVENT_LABELS) as [SpecialEventType, string][]).map(([type, label]) => {
              const count = allEvents.filter((e) => e.event_type === type).length
              if (count === 0) return null
              return (
                <div key={type} className="text-center p-3 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
                  <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{count}</div>
                  <div className="text-xs mt-1" style={{ color: '#a8b8c8' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </AppShell>
  )
}
