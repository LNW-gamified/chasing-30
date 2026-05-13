import { NextRequest, NextResponse } from 'next/server'

const MLB_TEAM_IDS: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CWS: 145,
  CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117, KC:  118,
  LAA: 108, LAD: 119, MIA: 146, MIL: 158, MIN: 142, NYM: 121,
  NYY: 147, OAK: 133, PHI: 143, PIT: 134, SD:  135, SF:  137,
  SEA: 136, STL: 138, TB:  139, TEX: 140, TOR: 141, WSH: 120,
}

interface StadiumInput {
  id: string
  abbreviation: string
  name: string
  team: string
  lat: number
  lng: number
}

interface RawStop {
  stadiumId: string
  abbreviation: string
  date: string
}

interface EnrichedStop {
  stadiumId: string
  stadiumName: string
  team: string
  abbreviation: string
  gameDate: string
  dayOfTrip: number
  gapToNext: number | null
  distFromPrev: number
  driveMinFromPrev: number
}

interface TripOption {
  startDate: string
  endDate: string
  totalDays: number
  stops: EnrichedStop[]
  avgGapDays: number
  difficulty: 'Road Warrior' | 'On the Move' | 'Leisure Tour'
  score: number
  totalDistanceMiles: number
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000
  )
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

async function fetchHomeGames(
  abbreviations: string[],
  startDate: string,
  endDate: string
): Promise<Record<string, string[]>> {
  const teamIds = abbreviations.map(a => MLB_TEAM_IDS[a]).filter(Boolean)
  if (teamIds.length === 0) return {}

  const url =
    `https://statsapi.mlb.com/api/v1/schedule` +
    `?sportId=1&startDate=${startDate}&endDate=${endDate}` +
    `&teamId=${teamIds.join(',')}&gameType=R`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return {}

  const data = await res.json()

  const idToAbbr: Record<number, string> = {}
  for (const abbr of abbreviations) {
    const id = MLB_TEAM_IDS[abbr]
    if (id) idToAbbr[id] = abbr
  }

  const homeDates: Record<string, Set<string>> = {}
  for (const abbr of abbreviations) homeDates[abbr] = new Set()

  for (const dateEntry of data.dates ?? []) {
    for (const game of dateEntry.games ?? []) {
      const homeId: number = game.teams?.home?.team?.id
      const abbr = idToAbbr[homeId]
      if (abbr && game.gameDate) {
        homeDates[abbr].add((game.gameDate as string).slice(0, 10))
      }
    }
  }

  const result: Record<string, string[]> = {}
  for (const abbr of abbreviations) result[abbr] = [...homeDates[abbr]].sort()
  return result
}

export async function POST(req: NextRequest) {
  try {
    const { abbreviations, stadiums, numDays, startDate, endDate, startingAbbr } =
      await req.json() as {
        abbreviations: string[]
        stadiums: StadiumInput[]
        numDays: number
        startDate: string
        endDate: string
        startingAbbr: string
      }

    if (!abbreviations?.length || !stadiums?.length || !startingAbbr) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Deduplicate: starting stadium may also appear in abbreviations
    const allAbbrs = [...new Set([startingAbbr, ...abbreviations])]
    const homeGamesByTeam = await fetchHomeGames(allAbbrs, startDate, endDate)

    const teamsWithNoGames = allAbbrs.filter(a => !(homeGamesByTeam[a]?.length))
    if (teamsWithNoGames.length > 0) {
      return NextResponse.json(
        { error: `No home games found for: ${teamsWithNoGames.join(', ')}. Try expanding your date range.` },
        { status: 422 }
      )
    }

    const startingStadium = stadiums.find(s => s.abbreviation === startingAbbr)
    if (!startingStadium) {
      return NextResponse.json({ error: 'Starting stadium not found in stadiums list' }, { status: 400 })
    }

    // Other stadiums to visit after the starting stadium
    const otherAbbrs = allAbbrs.filter(a => a !== startingAbbr)

    // Iterate over each home game date of the starting stadium as a potential trip start
    const startingGameDates = (homeGamesByTeam[startingAbbr] ?? [])
      .filter(d => d >= startDate && d <= endDate)

    const candidates: TripOption[] = []

    for (const tripStart of startingGameDates) {
      const windowEnd = addDays(tripStart, numDays - 1)

      // Nearest-neighbor greedy: from starting stadium, always pick the geographically
      // closest remaining stadium that has a home game after the current date and within the window.
      let currentLat = startingStadium.lat
      let currentLng = startingStadium.lng
      let currentDate = tripStart
      const remaining = [...otherAbbrs]
      const route: RawStop[] = [{
        stadiumId: startingStadium.id,
        abbreviation: startingAbbr,
        date: tripStart,
      }]
      let routeValid = true

      while (remaining.length > 0) {
        let bestIdx = -1
        let bestDate = ''
        let bestDist = Infinity

        for (let i = 0; i < remaining.length; i++) {
          const abbr = remaining[i]
          const stadium = stadiums.find(s => s.abbreviation === abbr)
          if (!stadium) continue

          // Earliest home game for this team strictly after current date and within window
          const nextGame = (homeGamesByTeam[abbr] ?? []).find(d => d > currentDate && d <= windowEnd)
          if (!nextGame) continue

          const dist = haversine(currentLat, currentLng, stadium.lat, stadium.lng)
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
            bestDate = nextGame
          }
        }

        if (bestIdx === -1) { routeValid = false; break }

        const abbr = remaining.splice(bestIdx, 1)[0]
        const stadium = stadiums.find(s => s.abbreviation === abbr)!
        route.push({ stadiumId: stadium.id, abbreviation: abbr, date: bestDate })
        currentLat = stadium.lat
        currentLng = stadium.lng
        currentDate = bestDate
      }

      if (!routeValid) continue

      // Skip if same first-game date already captured (same starting conditions produce same route)
      if (candidates.some(o => o.startDate === tripStart)) continue

      const tripEnd = route[route.length - 1].date
      const totalDays = daysBetween(tripStart, tripEnd) + 1

      // Build enriched stops with per-leg driving distance and estimated time
      const enrichedStops: EnrichedStop[] = route.map((stop, i) => {
        const stadium = stadiums.find(s => s.abbreviation === stop.abbreviation)!
        const prevStop = route[i - 1]
        const prevStadium = prevStop ? stadiums.find(s => s.abbreviation === prevStop.abbreviation)! : null
        const nextStop = route[i + 1] ?? null
        // Straight-line miles between consecutive stadiums
        const distFromPrev = prevStadium
          ? Math.round(haversine(prevStadium.lat, prevStadium.lng, stadium.lat, stadium.lng))
          : 0
        // Rough drive time: road distance ≈ 1.4× straight-line at ~60 mph
        const driveMinFromPrev = Math.round(distFromPrev * 1.4)

        return {
          stadiumId: stop.stadiumId,
          stadiumName: stadium.name,
          team: stadium.team,
          abbreviation: stop.abbreviation,
          gameDate: stop.date,
          dayOfTrip: daysBetween(tripStart, stop.date) + 1,
          gapToNext: nextStop ? daysBetween(stop.date, nextStop.date) : null,
          distFromPrev,
          driveMinFromPrev,
        }
      })

      const totalDistanceMiles = enrichedStops.reduce((sum, s) => sum + s.distFromPrev, 0)

      let totalGap = 0
      for (let i = 1; i < route.length; i++) {
        totalGap += daysBetween(route[i - 1].date, route[i].date)
      }
      const avgGap = route.length > 1 ? totalGap / (route.length - 1) : 0
      const difficulty: TripOption['difficulty'] =
        avgGap <= 1.5 ? 'Road Warrior' : avgGap <= 3 ? 'On the Move' : 'Leisure Tour'

      candidates.push({
        startDate: tripStart,
        endDate: tripEnd,
        totalDays,
        stops: enrichedStops,
        avgGapDays: avgGap,
        difficulty,
        score: totalDistanceMiles,
        totalDistanceMiles,
      })

      if (candidates.length >= 50) break
    }

    // Sort chronologically; break ties by shorter trip duration
    candidates.sort((a, b) =>
      a.startDate !== b.startDate
        ? a.startDate.localeCompare(b.startDate)
        : a.totalDays - b.totalDays
    )
    return NextResponse.json({ options: candidates, total: candidates.length })
  } catch (e) {
    console.error('Trip optimizer error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
