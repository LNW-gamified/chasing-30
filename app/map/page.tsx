import { createClient } from '@/lib/supabase-server'
import StadiumMap from '@/components/StadiumMap'
import type { Stadium, StadiumVisit, StadiumWithVisit } from '@/types'

export default async function MapPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
  ])

  const allStadiums: Stadium[]      = stadiums ?? []
  const allVisits:   StadiumVisit[] = visits ?? []

  const visitMap = new Map<string, StadiumVisit[]>()
  for (const v of allVisits) {
    const list = visitMap.get(v.stadium_id) ?? []
    list.push(v)
    visitMap.set(v.stadium_id, list)
  }

  const stadiumsWithVisit: StadiumWithVisit[] = allStadiums.map(s => ({
    ...s,
    visited: visitMap.has(s.id),
    visits:  visitMap.get(s.id) ?? [],
  }))

  return (
    <div style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#0B1117' }}>
      {/* On mobile: full viewport minus the sticky header (48px) + tab bar/banner from AppShell */}
      {/* On desktop: offset by the 256px AppShell sidebar via md:ml-64 on the parent div */}
      <div className="h-[calc(100svh-48px)] md:h-screen" style={{ position: 'relative' }}>
        <StadiumMap stadiums={stadiumsWithVisit} />
      </div>
    </div>
  )
}
