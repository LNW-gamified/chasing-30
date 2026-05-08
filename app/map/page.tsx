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

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
          Stadium Map
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a8b8c8' }}>
          <span style={{ color: '#22c55e' }}>●</span> Visited ({visitedCount}) &nbsp;
          <span style={{ color: '#a8b8c8' }}>●</span> Not Visited ({30 - visitedCount})
        </p>
      </div>

      <div style={{ height: 'calc(100vh - 11rem)', minHeight: 400 }}>
        <StadiumMap stadiums={stadiumsWithVisit} />
      </div>
    </AppShell>
  )
}
