import { createPublicClient } from '@/lib/supabase-public'
import { Check, Circle } from 'lucide-react'

interface StadiumRow {
  id: string
  name: string
  team: string
  abbreviation: string
  city: string
  state: string
  league: string
  division: string
}

interface VisitRow {
  visit_date: string
  home_team: string
  visiting_team: string
  home_runs: number | null
  away_runs: number | null
  stadium_id: string
}

interface ProgressData {
  stadiums_visited: number
  games_attended: number
  special_events_count: number
  all_stadiums: StadiumRow[]
  visited_ids: string[]
  recent_visits: VisitRow[]
}

const DIVISIONS = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West']

interface ShareMilestone {
  icon: string
  name: string
  description: string
}

function computeEarnedMilestones(
  visitedCount: number,
  gamesAttended: number,
  visitedIds: string[],
  allStadiums: StadiumRow[],
  specialEventsCount: number
): ShareMilestone[] {
  const visitedSet = new Set(visitedIds)
  const earned: ShareMilestone[] = []

  const addIf = (condition: boolean, icon: string, name: string, description: string) => {
    if (condition) earned.push({ icon, name, description })
  }

  // Games attended
  addIf(gamesAttended >= 1,  '⚾', 'First Pitch',          'Attend your first MLB game')
  addIf(gamesAttended >= 5,  '🎟️', 'Season Ticket Holder', 'Attend 5 total games')
  addIf(gamesAttended >= 10, '🤩', 'Superfan',             'Attend 10 total games')

  // Stadium counts
  addIf(visitedCount >= 5,  '🚗', 'Road Warrior',    'Visit 5 different stadiums')
  addIf(visitedCount >= 10, '🔟', 'Double Digits',   'Visit 10 different stadiums')
  addIf(visitedCount >= 15, '🏟️', 'Halfway There',   'Visit 15 different stadiums')
  addIf(visitedCount >= 20, '🎯', 'On Deck',         'Visit 20 different stadiums')
  addIf(visitedCount >= 25, '🏃', 'Final Stretch',   'Visit 25 different stadiums')
  addIf(visitedCount >= 30, '🏆', 'The Full 30',     'Visit all 30 MLB stadiums')

  // Special events
  addIf(specialEventsCount >= 1, '🌟', 'Beyond the Diamond', 'Log your first special baseball experience')

  // Division completions
  const divIcons: Record<string, string> = {
    'AL East': '🗽', 'AL Central': '🌽', 'AL West': '🌵',
    'NL East': '🦅', 'NL Central': '🐻', 'NL West': '🌉',
  }
  for (const div of DIVISIONS) {
    const [league, division] = div.split(' ')
    const group = allStadiums.filter((s) => s.league === league && s.division === division)
    if (group.length > 0 && group.every((s) => visitedSet.has(s.id))) {
      addIf(true, divIcons[div] ?? '🏅', `${div} Complete`, `Visit all stadiums in the ${div}`)
    }
  }

  // League completions
  const alStadiums = allStadiums.filter(s => s.league === 'AL')
  const nlStadiums = allStadiums.filter(s => s.league === 'NL')
  addIf(alStadiums.length > 0 && alStadiums.every(s => visitedSet.has(s.id)), '🇺🇸', 'Junior Circuit', 'Visit all 15 American League stadiums')
  addIf(nlStadiums.length > 0 && nlStadiums.every(s => visitedSet.has(s.id)), '⭐', 'Senior Circuit', 'Visit all 15 National League stadiums')

  // Coast/region sweeps
  const eastStadiums    = allStadiums.filter(s => s.division === 'East')
  const centralStadiums = allStadiums.filter(s => s.division === 'Central')
  const westStadiums    = allStadiums.filter(s => s.division === 'West')
  addIf(eastStadiums.length > 0    && eastStadiums.every(s => visitedSet.has(s.id)),    '🌅', 'East Coast Tour',       'Visit all East division stadiums')
  addIf(centralStadiums.length > 0 && centralStadiums.every(s => visitedSet.has(s.id)), '🌾', 'Midwest Swing',         'Visit all Central division stadiums')
  addIf(westStadiums.length > 0    && westStadiums.every(s => visitedSet.has(s.id)),    '🌊', 'West Coast Wanderer',   'Visit all West division stadiums')

  return earned
}

function formatDateStr(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_progress', { p_token: token })

  if (error || !data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ color: '#8B949E' }}
      >
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🔒</div>
          <div className="text-xl font-semibold mb-2" style={{ color: '#E6EDF3' }}>
            Link not found
          </div>
          <div className="text-sm">This share link is invalid or has been removed.</div>
        </div>
      </div>
    )
  }

  const progress = data as ProgressData
  const visitedSet = new Set(progress.visited_ids ?? [])
  const visitedCount = progress.stadiums_visited
  const pct = Math.round((visitedCount / 30) * 100)
  const earnedMilestones = computeEarnedMilestones(
    visitedCount,
    progress.games_attended,
    progress.visited_ids ?? [],
    progress.all_stadiums ?? [],
    progress.special_events_count
  )

  const divisionBreakdown = DIVISIONS.map((div) => {
    const [league, division] = div.split(' ')
    const group = (progress.all_stadiums ?? []).filter(
      (s) => s.league === league && s.division === division
    )
    const visited = group.filter((s) => visitedSet.has(s.id)).length
    return { label: div, visited, total: group.length }
  })

  return (
    <div
      className="min-h-screen"
      style={{ color: '#E6EDF3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* Header */}
      <div
        className="px-4 py-5 flex items-center gap-3"
        style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D' }}
      >
        <span style={{ fontSize: '1.75rem' }}>⚾</span>
        <div>
          <div className="font-bold text-lg" style={{ color: '#E6EDF3' }}>Chasing 30</div>
          <div className="text-xs" style={{ color: '#8B949E' }}>MLB Stadium Tracker — Read Only</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-8">
        {/* Progress hero */}
        <div
          className="rounded-2xl p-6 mb-6 text-center"
          style={{ backgroundColor: '#161B22', border: '1px solid #30363D' }}
        >
          <div className="text-4xl font-bold mb-1" style={{ color: '#3FB950' }}>
            {visitedCount} / 30
          </div>
          <div className="text-base mb-4" style={{ color: '#8B949E' }}>
            MLB Stadiums Visited
          </div>
          <div className="rounded-full overflow-hidden mx-auto" style={{ height: 10, backgroundColor: '#30363D', maxWidth: 320 }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: '#3FB950', transition: 'width 0.5s' }}
            />
          </div>
          <div className="text-sm mt-2" style={{ color: '#8B949E' }}>{pct}% complete</div>
          <div className="flex justify-center gap-8 mt-5">
            <div>
              <div className="text-2xl font-bold" style={{ color: '#1F6FEB' }}>{progress.games_attended}</div>
              <div className="text-xs" style={{ color: '#8B949E' }}>Games Witnessed</div>
            </div>
            {progress.special_events_count > 0 && (
              <div>
                <div className="text-2xl font-bold" style={{ color: '#F5A623' }}>{progress.special_events_count}</div>
                <div className="text-xs" style={{ color: '#8B949E' }}>Special Events</div>
              </div>
            )}
          </div>
        </div>

        {/* Division breakdown */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ backgroundColor: '#161B22', border: '1px solid #30363D' }}
        >
          <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>The Circuit</div>
          <div className="flex flex-col gap-3">
            {divisionBreakdown.map(({ label, visited, total }) => (
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
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent visits */}
        {(progress.recent_visits ?? []).length > 0 && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ backgroundColor: '#161B22', border: '1px solid #30363D' }}
          >
            <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>Recent Games</div>
            <div className="flex flex-col gap-3">
              {progress.recent_visits.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#161B22' }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#E6EDF3' }}>
                      {v.home_team} vs {v.visiting_team}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#8B949E' }}>
                      {formatDateStr(v.visit_date)}
                    </div>
                  </div>
                  {v.home_runs != null && v.away_runs != null && (
                    <div className="text-sm font-bold" style={{ color: '#8B949E' }}>
                      {v.away_runs}–{v.home_runs}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All stadiums checklist */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#161B22', border: '1px solid #30363D' }}
        >
          <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
            All 30 Stadiums
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(progress.all_stadiums ?? []).map((s) => {
              const visited = visitedSet.has(s.id)
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ opacity: visited ? 1 : 0.45 }}
                >
                  {visited ? (
                    <Check size={14} style={{ color: '#3FB950', flexShrink: 0 }} strokeWidth={3} />
                  ) : (
                    <Circle size={14} style={{ color: '#536476', flexShrink: 0 }} />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: visited ? '#E6EDF3' : '#8B949E' }}>
                      {s.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: '#8B949E' }}>
                      {s.team}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Milestones */}
        {earnedMilestones.length > 0 && (
          <div
            className="rounded-2xl p-5 mt-6"
            style={{ backgroundColor: '#161B22', border: '1px solid #30363D' }}
          >
            <div className="font-semibold mb-4" style={{ color: '#E6EDF3' }}>
              🏆 Milestones Earned ({earnedMilestones.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {earnedMilestones.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: '#E6EDF3' }}>{m.name}</div>
                    <div className="text-xs" style={{ color: '#8B949E' }}>{m.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8 text-xs" style={{ color: '#536476' }}>
          Shared via Chasing 30 · Read-only view
        </div>
      </div>
    </div>
  )
}
