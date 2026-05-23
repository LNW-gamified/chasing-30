import { createClient } from '@/lib/supabase-server'
import StadiumMap from '@/components/StadiumMap'
import type { Stadium, StadiumVisit, StadiumWithVisit } from '@/types'
import { DESTINATIONS } from '@/lib/destinations'

export default async function MapPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: destVisits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('destination_visits').select('destination_id, destination:destinations(slug)'),
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

  const visitedDestSlugs = new Set<string>(
    (destVisits ?? []).map((dv: any) => dv.destination?.slug).filter(Boolean)
  )

  // Only show destinations with coordinates on the map
  const mappableDestinations = DESTINATIONS.filter(d => d.lat !== null && d.lng !== null)

  return (
    <div style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#0B1117' }}>
      <div className="h-[calc(100svh-48px)] md:h-screen" style={{ position: 'relative' }}>
        <StadiumMap
          stadiums={stadiumsWithVisit}
          destinations={mappableDestinations}
          visitedDestinationIds={visitedDestSlugs}
        />
      </div>
    </div>
  )
}
