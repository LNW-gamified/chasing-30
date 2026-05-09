import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import StadiumMap from '@/components/StadiumMap'
import type { Stadium, StadiumVisit, StadiumWithVisit } from '@/types'

export default async function MapPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []

  const visitMap = new Map<string, StadiumVisit[]>()
  for (const v of allVisits) {
    const list = visitMap.get(v.stadium_id) ?? []
    list.push(v)
    visitMap.set(v.stadium_id, list)
  }

  const stadiumsWithVisit: StadiumWithVisit[] = allStadiums.map((s) => ({
    ...s,
    visited: visitMap.has(s.id),
    visits: visitMap.get(s.id) ?? [],
  }))

  const visitedCount = stadiumsWithVisit.filter((s) => s.visited).length
  const pct = Math.round((visitedCount / 30) * 100)

  return (
    <AppShell>
      {/* Minimal header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-black tracking-tight" style={{ color: '#ffffff' }}>Stadium Map</h1>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-base font-semibold" style={{ color: '#22c55e' }}>
            <span style={{ fontSize: '0.6rem' }}>●</span> {visitedCount} visited
          </span>
          <span className="flex items-center gap-1.5 text-base" style={{ color: '#4a5568' }}>
            <span style={{ fontSize: '0.6rem' }}>●</span> {30 - visitedCount} remaining
          </span>
        </div>
      </div>

      {/* Map container with floating progress card */}
      <div
        style={{ height: 'calc(100svh - 150px)', minHeight: 480, position: 'relative', borderRadius: 12, overflow: 'hidden' }}
      >
        <StadiumMap stadiums={stadiumsWithVisit} />

        {/* Floating progress card */}
        <div
          className="absolute top-3 right-3 z-10 card p-4"
          style={{
            minWidth: 150,
            backgroundColor: 'rgba(19,29,53,0.94)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-base font-bold uppercase tracking-widest mb-1" style={{ color: '#4a5568', letterSpacing: '0.12em' }}>
            Journey
          </div>
          <div className="flex items-end gap-1 mb-2">
            <span className="font-black" style={{ color: '#22c55e', fontSize: '2.25rem', lineHeight: 1, letterSpacing: '-0.04em' }}>
              {visitedCount}
            </span>
            <span className="text-lg font-semibold mb-1" style={{ color: '#4a5568' }}>/30</span>
          </div>
          <div className="rounded-full overflow-hidden mb-1.5" style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                borderRadius: 9999,
                boxShadow: visitedCount > 0 ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
              }}
            />
          </div>
          <div className="text-base" style={{ color: '#64748b' }}>{pct}% complete</div>
        </div>
      </div>
    </AppShell>
  )
}
