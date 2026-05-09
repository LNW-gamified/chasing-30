import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import ProgressRing from '@/components/ProgressRing'
import ShareButton from '@/components/ShareButton'
import { MILESTONES } from '@/lib/milestones'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, StadiumVisit, Trip, SpecialEvent } from '@/types'
import Link from 'next/link'
import { Trophy, Plane, Calendar, ChevronRight } from 'lucide-react'
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

  const recentVisits = allVisits.slice(0, 4)
  const upcomingTrips = allTrips.filter(
    (t) => t.status === 'planned' && t.trip_date && t.trip_date >= new Date().toISOString().split('T')[0]
  ).slice(0, 3)

  const divisionProgress = [
    { label: 'AL East', short: 'ALE', league: 'AL', division: 'East' },
    { label: 'AL Central', short: 'ALC', league: 'AL', division: 'Central' },
    { label: 'AL West', short: 'ALW', league: 'AL', division: 'West' },
    { label: 'NL East', short: 'NLE', league: 'NL', division: 'East' },
    { label: 'NL Central', short: 'NLC', league: 'NL', division: 'Central' },
    { label: 'NL West', short: 'NLW', league: 'NL', division: 'West' },
  ].map(({ label, short, league, division }) => {
    const div = allStadiums.filter((s) => s.league === league && s.division === division)
    const visited = div.filter((s) => visitedIds.has(s.id)).length
    return { label, short, total: div.length, visited }
  })

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#ffffff' }}>
            Dashboard
          </h1>
          <p style={{ color: '#64748b' }} className="text-base mt-0.5">
            Your MLB stadium journey
          </p>
        </div>
        <ShareButton />
      </div>

      {/* HERO — Progress Ring */}
      <div
        className="card mb-6 flex flex-col items-center justify-center"
        style={{
          padding: '2.5rem 2rem',
          background: 'linear-gradient(135deg, #131d35 0%, #0f1729 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="text-base font-bold uppercase tracking-widest mb-5" style={{ color: '#64748b', letterSpacing: '0.15em' }}>
            Overall Progress
          </div>
          <ProgressRing visited={visitedCount} total={30} size={220} />
          <div className="mt-5">
            <div className="text-lg font-semibold" style={{ color: '#94a3b8' }}>
              {visitedCount === 0
                ? 'Start your journey — visit your first park'
                : visitedCount === 30
                ? '🏆 You\'ve chased all 30! Legend status.'
                : `${30 - visitedCount} park${30 - visitedCount !== 1 ? 's' : ''} remaining`}
            </div>
            <div className="text-base mt-1" style={{ color: '#64748b' }}>
              {pct}% of your MLB journey complete
            </div>
          </div>
        </div>
      </div>

      {/* Division Grid — 2×3 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {divisionProgress.map(({ label, visited, total }) => {
          const done = visited === total
          return (
            <div
              key={label}
              className="card p-4"
              style={done ? { borderColor: 'rgba(34,197,94,0.25)', backgroundColor: 'rgba(34,197,94,0.04)' } : {}}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-base font-bold" style={{ color: done ? '#22c55e' : '#ffffff' }}>
                  {label}
                </div>
                <div className="text-xl font-black" style={{ color: done ? '#22c55e' : '#3b82f6' }}>
                  {visited}<span className="text-base font-normal" style={{ color: '#64748b' }}>/{total}</span>
                </div>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(visited / total) * 100}%`,
                    backgroundColor: done ? '#22c55e' : '#3b82f6',
                    boxShadow: done ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Games + Upcoming Trips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Recent Games */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-bold" style={{ color: '#ffffff' }}>Recent Games</div>
            <Link href="/stadiums" className="text-base font-medium" style={{ color: '#3b82f6' }}>
              All parks →
            </Link>
          </div>
          {recentVisits.length === 0 ? (
            <div className="text-center py-10" style={{ color: '#64748b' }}>
              <Calendar size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-base">No games logged yet</p>
              <Link href="/stadiums" className="text-base mt-2 block" style={{ color: '#3b82f6' }}>
                Log your first game →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentVisits.map((visit) => {
                const stadium = allStadiums.find((s) => s.id === visit.stadium_id)
                return (
                  <Link
                    key={visit.id}
                    href={`/stadiums/${visit.stadium_id}`}
                    className="row-hover flex items-center gap-3 p-3 rounded-xl"
                  >
                    {stadium ? (
                      <TeamLogo
                        abbreviation={stadium.abbreviation}
                        size={44}
                        style={{ borderRadius: '50%', flexShrink: 0 }}
                      />
                    ) : (
                      <div className="text-2xl">⚾</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold truncate" style={{ color: '#ffffff' }}>
                        {visit.home_team} vs {visit.visiting_team}
                      </div>
                      <div className="text-base" style={{ color: '#64748b' }}>
                        {stadium?.name} · {formatDate(visit.visit_date)}
                      </div>
                    </div>
                    {visit.home_runs != null && visit.away_runs != null && (
                      <div className="text-base font-black flex-shrink-0" style={{ color: '#94a3b8' }}>
                        {visit.away_runs}–{visit.home_runs}
                      </div>
                    )}
                    <ChevronRight size={16} style={{ color: '#4a5568', flexShrink: 0 }} />
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming Trips */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-bold" style={{ color: '#ffffff' }}>Upcoming Trips</div>
            <Link href="/trips" className="text-base font-medium" style={{ color: '#3b82f6' }}>
              All trips →
            </Link>
          </div>
          {upcomingTrips.length === 0 ? (
            <div className="text-center py-10" style={{ color: '#64748b' }}>
              <Plane size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-base">No upcoming trips</p>
              <Link href="/trips" className="text-base mt-2 block" style={{ color: '#3b82f6' }}>
                Plan a trip →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingTrips.map((trip) => {
                const est = trip.est_tickets + trip.est_travel + trip.est_hotel + trip.est_food + trip.est_parking
                return (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="row-hover flex items-center gap-3 p-3 rounded-xl"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ backgroundColor: 'rgba(59,130,246,0.12)' }}
                    >
                      ✈️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold truncate" style={{ color: '#ffffff' }}>
                        {trip.name}
                      </div>
                      <div className="text-base" style={{ color: '#64748b' }}>
                        {trip.stadium?.name}{trip.trip_date && ` · ${formatDate(trip.trip_date)}`}
                      </div>
                    </div>
                    <div className="text-base font-bold flex-shrink-0" style={{ color: '#f59e0b' }}>
                      {formatCurrency(est)}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Milestones + Quick stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(167,139,250,0.06)', borderColor: 'rgba(167,139,250,0.15)' }}>
          <div className="text-4xl font-black" style={{ color: '#a78bfa' }}>{earnedMilestones.length}</div>
          <div>
            <div className="text-base font-semibold" style={{ color: '#ffffff' }}>Milestones</div>
            <div className="text-base" style={{ color: '#64748b' }}>of {MILESTONES.length} earned</div>
          </div>
          <Link href="/milestones" className="ml-auto flex-shrink-0" style={{ color: '#a78bfa' }}>
            <ChevronRight size={20} />
          </Link>
        </div>

        <div className="card p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' }}>
          <div className="text-4xl font-black" style={{ color: '#60a5fa' }}>{allVisits.length}</div>
          <div>
            <div className="text-base font-semibold" style={{ color: '#ffffff' }}>Games</div>
            <div className="text-base" style={{ color: '#64748b' }}>total attended</div>
          </div>
          <Link href="/stats" className="ml-auto flex-shrink-0" style={{ color: '#60a5fa' }}>
            <ChevronRight size={20} />
          </Link>
        </div>

        <div className="card p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.15)' }}>
          <div className="text-4xl font-black" style={{ color: '#f59e0b' }}>{allEvents.length}</div>
          <div>
            <div className="text-base font-semibold" style={{ color: '#ffffff' }}>Special Events</div>
            <div className="text-base" style={{ color: '#64748b' }}>logged</div>
          </div>
          <Link href="/special-events" className="ml-auto flex-shrink-0" style={{ color: '#f59e0b' }}>
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>

      {/* Next milestone CTA */}
      {nextMilestone && (
        <div
          className="card p-5 flex items-center gap-5"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 100%)',
            borderColor: 'rgba(139,92,246,0.25)',
          }}
        >
          <div className="text-4xl flex-shrink-0">{nextMilestone.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold uppercase tracking-wider mb-0.5" style={{ color: '#a78bfa' }}>
              Next Milestone
            </div>
            <div className="text-lg font-bold truncate" style={{ color: '#ffffff' }}>
              {nextMilestone.name}
            </div>
            <div className="text-base" style={{ color: '#94a3b8' }}>
              {nextMilestone.description}
            </div>
          </div>
          <Link
            href="/milestones"
            className="btn-primary flex-shrink-0"
            style={{ backgroundColor: 'rgba(139,92,246,0.8)', fontSize: '1rem' }}
          >
            <Trophy size={16} /> View All
          </Link>
        </div>
      )}
    </AppShell>
  )
}
