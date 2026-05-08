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
        style={{ backgroundColor: '#0a0e1a', color: '#94a3b8' }}
      >
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🔒</div>
          <div className="text-xl font-semibold mb-2" style={{ color: '#f1f5f9' }}>
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
      style={{ backgroundColor: '#0a0e1a', color: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* Header */}
      <div
        className="px-4 py-5 flex items-center gap-3"
        style={{ backgroundColor: '#0d1424', borderBottom: '1px solid #1f2937' }}
      >
        <span style={{ fontSize: '1.75rem' }}>⚾</span>
        <div>
          <div className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Chasing 30</div>
          <div className="text-xs" style={{ color: '#8896ae' }}>MLB Stadium Tracker — Read Only</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-8">
        {/* Progress hero */}
        <div
          className="rounded-2xl p-6 mb-6 text-center"
          style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
        >
          <div className="text-5xl font-bold mb-1" style={{ color: '#22c55e' }}>
            {visitedCount} / 30
          </div>
          <div className="text-base mb-4" style={{ color: '#94a3b8' }}>
            MLB Stadiums Visited
          </div>
          <div className="rounded-full overflow-hidden mx-auto" style={{ height: 10, backgroundColor: '#1f2937', maxWidth: 320 }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: '#22c55e', transition: 'width 0.5s' }}
            />
          </div>
          <div className="text-sm mt-2" style={{ color: '#8896ae' }}>{pct}% complete</div>
          <div className="flex justify-center gap-8 mt-5">
            <div>
              <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{progress.games_attended}</div>
              <div className="text-xs" style={{ color: '#8896ae' }}>Games Attended</div>
            </div>
            {progress.special_events_count > 0 && (
              <div>
                <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{progress.special_events_count}</div>
                <div className="text-xs" style={{ color: '#8896ae' }}>Special Events</div>
              </div>
            )}
          </div>
        </div>

        {/* Division breakdown */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
        >
          <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>Division Progress</div>
          <div className="flex flex-col gap-3">
            {divisionBreakdown.map(({ label, visited, total }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: '#94a3b8' }}>{label}</span>
                  <span style={{ color: visited === total ? '#22c55e' : '#8896ae' }}>
                    {visited} / {total}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#1f2937' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(visited / total) * 100}%`,
                      backgroundColor: visited === total ? '#22c55e' : '#3b82f6',
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
            style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
          >
            <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>Recent Games</div>
            <div className="flex flex-col gap-3">
              {progress.recent_visits.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#0d1424' }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#f1f5f9' }}>
                      {v.home_team} vs {v.visiting_team}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#8896ae' }}>
                      {formatDateStr(v.visit_date)}
                    </div>
                  </div>
                  {v.home_runs != null && v.away_runs != null && (
                    <div className="text-sm font-bold" style={{ color: '#94a3b8' }}>
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
          style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
        >
          <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>
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
                    <Check size={14} style={{ color: '#22c55e', flexShrink: 0 }} strokeWidth={3} />
                  ) : (
                    <Circle size={14} style={{ color: '#536476', flexShrink: 0 }} />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: visited ? '#f1f5f9' : '#8896ae' }}>
                      {s.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: '#8896ae' }}>
                      {s.team}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="text-center mt-8 text-xs" style={{ color: '#536476' }}>
          Shared via Chasing 30 · Read-only view
        </div>
      </div>
    </div>
  )
}
