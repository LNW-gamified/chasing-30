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
}

interface TripOption {
  startDate: string
  endDate: string
  totalDays: number
  stops: EnrichedStop[]
  avgGapDays: number
  difficulty: 'Road Warrior' | 'On the Move' | 'Leisure Tour'
  score: number
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

// Travel distance for stops that are ALREADY sorted chronologically.
// This scores how much driving/flying the route requires in date order.
function travelScore(stops: RawStop[], stadiums: StadiumInput[], homeLat: number, homeLng: number): number {
  let dist = 0
  let lat = homeLat
  let lng = homeLng
  for (const stop of stops) {
    const s = stadiums.find(st => st.abbreviation === stop.abbreviation)
    if (!s) continue
    dist += haversine(lat, lng, s.lat, s.lng)
    lat = s.lat
    lng = s.lng
  }
  return dist
}

// Cartesian product of string arrays
function cartesianProduct(arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap(combo => arr.map(item => [...combo, item])),
    [[]]
  )
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
    const { abbreviations, stadiums, numDays, startDate, endDate, homeLat, homeLng } =
      await req.json() as {
        abbreviations: string[]
        stadiums: StadiumInput[]
        numDays: number
        startDate: string
        endDate: string
        homeLat: number
        homeLng: number
      }

    if (!abbreviations?.length || !stadiums?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const homeGamesByTeam = await fetchHomeGames(abbreviations, startDate, endDate)

    const teamsWithNoGames = abbreviations.filter(a => !(homeGamesByTeam[a]?.length))
    if (teamsWithNoGames.length > 0) {
      return NextResponse.json(
        { error: `No home games found for: ${teamsWithNoGames.join(', ')}. Try expanding your date range.` },
        { status: 422 }
      )
    }

    const candidates: TripOption[] = []

    // Slide a window of numDays across the search range
    let windowStart = startDate
    while (windowStart <= endDate) {
      const windowEnd = addDays(windowStart, numDays - 1)

      // Home game dates per team in this window — capped at 8 to bound cartesian product
      const teamDateLists = abbreviations.map(abbr =>
        (homeGamesByTeam[abbr] ?? []).filter(d => d >= windowStart && d <= windowEnd).slice(0, 8)
      )

      // Skip window if any team has no home game in it
      if (teamDateLists.some(dl => dl.length === 0)) {
        windowStart = addDays(windowStart, 1)
        continue
      }

      // Enumerate every combination of dates (one per team)
      const combos = cartesianProduct(teamDateLists)

      let bestScore = Infinity
      let bestStops: RawStop[] | null = null

      for (const combo of combos) {
        // Constraint 1: each stop must be on a unique date
        if (new Set(combo).size < combo.length) continue

        // Build stops, then sort chronologically by date
        const stops: RawStop[] = abbreviations.map((abbr, i) => ({
          stadiumId: stadiums.find(s => s.abbreviation === abbr)!.id,
          abbreviation: abbr,
          date: combo[i],
        }))
        stops.sort((a, b) => a.date.localeCompare(b.date))

        // Constraint 2: span must fit within numDays
        const span = daysBetween(stops[0].date, stops[stops.length - 1].date) + 1
        if (span > numDays) continue

        // Score = total travel distance in chronological order (lower = better)
        const score = travelScore(stops, stadiums, homeLat, homeLng)
        if (score < bestScore) {
          bestScore = score
          bestStops = stops
        }
      }

      if (bestStops) {
        // Dates and ordering are guaranteed correct:
        //   - sorted chronologically above
        //   - unique dates enforced above
        //   - tripStart/tripEnd = first/last game dates
        const tripStart = bestStops[0].date
        const tripEnd = bestStops[bestStops.length - 1].date
        const totalDays = daysBetween(tripStart, tripEnd) + 1

        let totalGap = 0
        for (let i = 1; i < bestStops.length; i++) {
          // daysBetween(earlier, later) is always positive here
          totalGap += daysBetween(bestStops[i - 1].date, bestStops[i].date)
        }
        const avgGap = bestStops.length > 1 ? totalGap / (bestStops.length - 1) : 0

        const difficulty: TripOption['difficulty'] =
          avgGap <= 1.5 ? 'Road Warrior' : avgGap <= 3 ? 'On the Move' : 'Leisure Tour'

        // Deduplicate: skip if we already have a similar option (same teams, start within 3 days)
        const isDuplicate = candidates.some(
          o =>
            Math.abs(daysBetween(o.startDate, tripStart)) < 3 &&
            o.stops.map(s => s.abbreviation).sort().join() ===
              bestStops!.map(s => s.abbreviation).sort().join()
        )

        if (!isDuplicate) {
          const enrichedStops: EnrichedStop[] = bestStops.map((stop, i) => {
            const nextStop = bestStops![i + 1]
            const stadium = stadiums.find(s => s.abbreviation === stop.abbreviation)!
            return {
              stadiumId: stop.stadiumId,
              stadiumName: stadium.name,
              team: stadium.team,
              abbreviation: stop.abbreviation,
              gameDate: stop.date,
              dayOfTrip: daysBetween(tripStart, stop.date) + 1,
              // always positive: nextStop.date > stop.date (sorted chronologically, unique dates)
              gapToNext: nextStop ? daysBetween(stop.date, nextStop.date) : null,
            }
          })

          candidates.push({
            startDate: tripStart,
            endDate: tripEnd,
            totalDays,
            stops: enrichedStops,
            avgGapDays: avgGap,
            difficulty,
            score: bestScore,
          })
        }
      }

      if (candidates.length >= 30) break
      windowStart = addDays(windowStart, 1)
    }

    // Rank by travel score (lower = less driving), return top 3
    candidates.sort((a, b) => a.score - b.score)
    return NextResponse.json({ options: candidates.slice(0, 3) })
  } catch (e) {
    console.error('Trip optimizer error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
