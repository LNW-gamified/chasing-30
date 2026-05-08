import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import ProgressRing from '@/components/ProgressRing'
import ShareButton from '@/components/ShareButton'
import { MILESTONES } from '@/lib/milestones'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, StadiumVisit, Trip, SpecialEvent } from '@/types'
import Link from 'next/link'
import { Trophy, Plane, Calendar } from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: trips }, { data: events }] = await Promise.all([
    supabase.from('stadiums').select('*').order('name'),
    supabase.from('stadium_visits').select('*').order('visit_date', { ascending: false }),
    supabase.from('trips').select('*, stadium:stadiums(*)').order('trip_date', { ascending: true }),
    supabase.from('special_events').select('*'),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allTrips: (Trip & { stadium: Stadium })[] = (trips as any) ?? []
  const allEvents: SpecialEvent[] = events ?? []

  const visitedIds = new Set(allVisits.map((v) => v.stadium_id))
  const visitedCount = visitedIds.size
  const pct = Math.round((visitedCount / 30) * 100)

  const earnedMilestones = MILESTONES.filter((m) => m.check(allVisits, allStadiums, allEvents))
  const nextMilestone = MILESTONES.find((m) => !m.check(allVisits, allStadiums, allEvents))

  const recentVisits = allVisits.slice(0, 3)
  const upcomingTrips = allTrips.filter(
    (t) => t.status === 'planned' && t.trip_date && t.trip_date >= new Date().toISOString().split('T')[0]
  ).slice(0, 3)

  const totalSpent = allTrips
    .filter((t) => t.status === 'completed')
    .reduce(
      (sum, t) =>
        sum + t.actual_tickets + t.actual_travel + t.actual_hotel + t.actual_food + t.actual_parking,
      0
    )

  // Stadiums by division for the division grid
  const divisionProgress = [
    { label: 'AL East', league: 'AL', division: 'East' },
    { label: 'AL Central', league: 'AL', division: 'Central' },
    { label: 'AL West', league: 'AL', division: 'West' },
    { label: 'NL East', league: 'NL', division: 'East' },
    { label: 'NL Central', league: 'NL', division: 'Central' },
    { label: 'NL West', league: 'NL', division: 'West' },
  ].map(({ label, league, division }) => {
    const div = allStadiums.filter((s) => s.league === league && s.division === division)
    const visited = div.filter((s) => visitedIds.has(s.id)).length
    return { label, total: div.length, visited }
  })

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
            Dashboard
          </h1>
          <p style={{ color: '#8896ae' }} className="text-sm mt-1">
            Your MLB stadium journey at a glance
          </p>
        </div>
        <ShareButton />
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Stadiums Visited', value: visitedCount, sub: `of 30 (${pct}%)`, color: '#22c55e' },
          { label: 'Games Attended', value: allVisits.length, sub: 'total games', color: '#3b82f6' },
          { label: 'Milestones Earned', value: earnedMilestones.length, sub: `of ${MILESTONES.length}`, color: '#a78bfa' },
          { label: 'Total Spent', value: formatCurrency(totalSpent), sub: 'across all trips', color: '#f59e0b' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="card p-5">
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#8896ae' }}>
              {label}
            </div>
            <div className="text-2xl font-bold" style={{ color }}>
              {value}
            </div>
            <div className="text-xs mt-1" style={{ color: '#8896ae' }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Progress ring + division grid */}
        <div className="card p-6 flex flex-col items-center">
          <div className="text-sm font-medium mb-4" style={{ color: '#94a3b8' }}>
            Overall Progress
          </div>
          <ProgressRing visited={visitedCount} total={30} size={160} />
          <div className="mt-4 w-full grid grid-cols-2 gap-2">
            {divisionProgress.map(({ label, visited, total }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs" style={{ color: '#8896ae' }}>
                  <span>{label}</span>
                  <span style={{ color: '#94a3b8' }}>
                    {visited}/{total}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#1f2937' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(visited / total) * 100}%`,
                      backgroundColor: visited === total ? '#22c55e' : '#3b82f6',
                      transition: 'width 0.4s',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent visits */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>
              Recent Games
            </div>
            <Link href="/stadiums" className="text-xs" style={{ color: '#3b82f6' }}>
              View all
            </Link>
          </div>
          {recentVisits.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#8896ae' }}>
              <Calendar size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No games logged yet</p>
              <Link href="/stadiums" className="text-xs mt-2 block" style={{ color: '#3b82f6' }}>
                Log your first game
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentVisits.map((visit) => {
                const stadium = allStadiums.find((s) => s.id === visit.stadium_id)
                return (
                  <Link
                    key={visit.id}
                    href={`/stadiums/${visit.stadium_id}`}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: '#0d1424' }}
                  >
                    {stadium ? (
                      <TeamLogo
                        abbreviation={stadium.abbreviation}
                        size={48}
                        style={{ borderRadius: '50%', flexShrink: 0 }}
                      />
                    ) : (
                      <div className="text-xl">⚾</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#f1f5f9' }}>
                        {visit.home_team} vs {visit.visiting_team}
                      </div>
                      <div className="text-xs" style={{ color: '#8896ae' }}>
                        {stadium?.name} &bull; {formatDate(visit.visit_date)}
                      </div>
                    </div>
                    {visit.home_runs != null && visit.away_runs != null && (
                      <div className="text-sm font-bold" style={{ color: '#94a3b8' }}>
                        {visit.away_runs}-{visit.home_runs}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming trips */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>
              Upcoming Trips
            </div>
            <Link href="/trips" className="text-xs" style={{ color: '#3b82f6' }}>
              View all
            </Link>
          </div>
          {upcomingTrips.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#8896ae' }}>
              <Plane size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No upcoming trips</p>
              <Link href="/trips" className="text-xs mt-2 block" style={{ color: '#3b82f6' }}>
                Plan a trip
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingTrips.map((trip) => {
                const est =
                  trip.est_tickets + trip.est_travel + trip.est_hotel + trip.est_food + trip.est_parking
                return (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: '#0d1424' }}
                  >
                    <div className="text-xl">✈️</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#f1f5f9' }}>
                        {trip.name}
                      </div>
                      <div className="text-xs" style={{ color: '#8896ae' }}>
                        {trip.stadium?.name}
                        {trip.trip_date && ` · ${formatDate(trip.trip_date)}`}
                      </div>
                    </div>
                    <div className="text-sm font-medium" style={{ color: '#f59e0b' }}>
                      {formatCurrency(est)}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Next milestone */}
      {nextMilestone && (
        <div
          className="card p-5 flex items-center gap-4"
          style={{ borderColor: 'rgba(139,92,246,0.3)', backgroundColor: 'rgba(139,92,246,0.05)' }}
        >
          <Trophy size={24} style={{ color: '#a78bfa', flexShrink: 0 }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>
              Next Milestone: {nextMilestone.name}
            </div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>
              {nextMilestone.description}
            </div>
          </div>
          <Link href="/milestones" className="ml-auto btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
            View All
          </Link>
        </div>
      )}
    </AppShell>
  )
}
