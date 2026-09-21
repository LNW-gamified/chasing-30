import { createClient } from '@/lib/supabase-server'
import StadiumMap from '@/components/StadiumMap'
import type { Stadium, StadiumVisit, StadiumWithVisit } from '@/types'
import { DESTINATIONS } from '@/lib/destinations'

export default async function MapPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: destVisits }, { data: bleRows }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('destination_visits').select('destination_id, destination:destinations(slug)'),
    supabase.from('baseball_life_entries').select('venue, event_type').eq('category', 'pilgrimage'),
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

  // A pilgrimage-type destination can also be marked done through
  // baseball_life_entries (the original, manual way of logging a
  // pilgrimage visit) instead of destination_visits. There's no foreign
  // key between them, only a free-text venue field, so this matches the
  // same fuzzy approach (first two words of the destination's name)
  // already used in /api/complete-stop for this exact comparison.
  for (const b of (bleRows ?? []) as { venue: string | null; event_type: string | null }[]) {
    for (const d of DESTINATIONS) {
      const matchWords = d.name.toLowerCase().split(' ').slice(0, 2).join(' ')
      if (b.venue?.toLowerCase().includes(matchWords) || b.event_type?.toLowerCase().includes(matchWords)) {
        visitedDestSlugs.add(d.slug)
      }
    }
  }

  // Only show destinations with coordinates on the map
  const mappableDestinations = DESTINATIONS.filter(d => d.lat !== null && d.lng !== null)

  return (
    <div style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#0B1117' }}>
      <div className="h-[calc(100svh-104px)] md:h-screen" style={{ position: 'relative' }}>
        <StadiumMap
          stadiums={stadiumsWithVisit}
          destinations={mappableDestinations}
          visitedDestinationIds={visitedDestSlugs}
        />
      </div>
    </div>
  )
}
