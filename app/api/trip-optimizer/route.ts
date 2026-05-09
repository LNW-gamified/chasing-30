import { NextRequest, NextResponse } from 'next/server'

// Maps our DB abbreviations to MLB Stats API team IDs
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

interface GameDate {
  stadiumId: string
  abbreviation: string
  date: string
}

interface TripOption {
  startDate: string
  endDate: string
  totalDays: number
  stops: Array<{
    stadiumId: string
    stadiumName: string
    team: string
    abbreviation: string
    gameDate: string
    dayOfTrip: number
  }>
  avgGapDays: number
  difficulty: 'Road Warrior' | 'On the Move' | 'Leisure Tour'
  score: number
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestNeighborTSP(
  stops: GameDate[],
  stadiums: StadiumInput[],
  homeLat: number,
  homeLng: number
): GameDate[] {
  if (stops.length <= 1) return stops

  const getCoords = (abbr: string) => {
    const s = stadiums.find(st => st.abbreviation === abbr)
    return s ? { lat: s.lat, lng: s.lng } : { lat: homeLat, lng: homeLng }
  }

  const remaining = [...stops]
  const ordered: GameDate[] = []
  let curLat = homeLat
  let curLng = homeLng

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const c = getCoords(remaining[i].abbreviation)
      const d = haversine(curLat, curLng, c.lat, c.lng)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    const c = getCoords(next.abbreviation)
    curLat = c.lat
    curLng = c.lng
  }

  return ordered
}

async function fetchHomeGames(
  abbreviations: string[],
  startDate: string,
  endDate: string
): Promise<Record<string, string[]>> {
  const teamIds = abbreviations.map(a => MLB_TEAM_IDS[a]).filter(Boolean)
  if (teamIds.length === 0) return {}

  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&teamId=${teamIds.join(',')}&gameType=R`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return {}

  const data = await res.json()

  // Build a reverse map: mlb teamId → abbreviation
  const idToAbbr: Record<number, string> = {}
  for (const abbr of abbreviations) {
    const id = MLB_TEAM_IDS[abbr]
    if (id) idToAbbr[id] = abbr
  }

  // Collect home game dates per abbreviation
  const homeDates: Record<string, Set<string>> = {}
  for (const abbr of abbreviations) homeDates[abbr] = new Set()

  for (const dateEntry of (data.dates ?? [])) {
    for (const game of (dateEntry.games ?? [])) {
      const homeTeamId: number = game.teams?.home?.team?.id
      const abbr = idToAbbr[homeTeamId]
      if (abbr && game.gameDate) {
        const dateStr = game.gameDate.slice(0, 10)
        homeDates[abbr].add(dateStr)
      }
    }
  }

  const result: Record<string, string[]> = {}
  for (const abbr of abbreviations) {
    result[abbr] = [...homeDates[abbr]].sort()
  }
  return result
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}

function iterateDates(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = start
  while (cur <= end) {
    dates.push(cur)
    cur = addDays(cur, 1)
  }
  return dates
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      abbreviations,
      stadiums,
      numDays,
      startDate,
      endDate,
      homeLat,
      homeLng,
    }: {
      abbreviations: string[]
      stadiums: StadiumInput[]
      numDays: number
      startDate: string
      endDate: string
      homeLat: number
      homeLng: number
    } = body

    if (!abbreviations?.length || !stadiums?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const homeGamesByTeam = await fetchHomeGames(abbreviations, startDate, endDate)

    // Check if every team has at least some home games
    const teamsWithGames = abbreviations.filter(a => (homeGamesByTeam[a]?.length ?? 0) > 0)
    if (teamsWithGames.length < abbreviations.length) {
      const missing = abbreviations.filter(a => !homeGamesByTeam[a]?.length)
      return NextResponse.json({
        error: `No home games found for: ${missing.join(', ')}. Try expanding your date range.`
      }, { status: 422 })
    }

    const options: TripOption[] = []
    const searchEnd = addDays(endDate, -numDays)
    const candidateDates = iterateDates(startDate, searchEnd)

    for (const windowStart of candidateDates) {
      const windowEnd = addDays(windowStart, numDays)

      // For each team, find earliest home game in this window
      const picks: GameDate[] = []
      let valid = true

      for (const abbr of abbreviations) {
        const dates = homeGamesByTeam[abbr] ?? []
        const inWindow = dates.filter(d => d >= windowStart && d <= windowEnd)
        if (inWindow.length === 0) { valid = false; break }
        const stadium = stadiums.find(s => s.abbreviation === abbr)
        if (!stadium) { valid = false; break }
        picks.push({ stadiumId: stadium.id, abbreviation: abbr, date: inWindow[0] })
      }

      if (!valid || picks.length < abbreviations.length) continue

      // Dedupe: skip if dates are too clumped (all same day)
      const uniqueDates = new Set(picks.map(p => p.date))
      if (picks.length > 1 && uniqueDates.size === 1) continue

      // Sort picks by nearest-neighbor TSP
      const ordered = nearestNeighborTSP(picks, stadiums, homeLat, homeLng)

      // Sort by date as primary, then TSP as tiebreaker
      ordered.sort((a, b) => a.date.localeCompare(b.date))

      // Re-apply TSP within same-day groups (greedy by date first, then TSP)
      const finalOrder = nearestNeighborTSP(ordered, stadiums, homeLat, homeLng)

      const tripStart = finalOrder[0].date
      const tripEnd = finalOrder[finalOrder.length - 1].date
      const totalDays = daysBetween(tripStart, tripEnd) + 1

      // Calculate avg gap
      let totalGap = 0
      for (let i = 1; i < finalOrder.length; i++) {
        totalGap += daysBetween(finalOrder[i - 1].date, finalOrder[i].date)
      }
      const avgGap = finalOrder.length > 1 ? totalGap / (finalOrder.length - 1) : 0

      const difficulty: TripOption['difficulty'] =
        avgGap <= 1 ? 'Road Warrior' : avgGap <= 3 ? 'On the Move' : 'Leisure Tour'

      // Score: lower = better. Penalize long gaps, reward compact trips.
      const score = totalDays + avgGap * 0.5

      const stops = finalOrder.map((p, i) => {
        const stadium = stadiums.find(s => s.abbreviation === p.abbreviation)!
        const dayOfTrip = daysBetween(tripStart, p.date) + 1
        return {
          stadiumId: p.stadiumId,
          stadiumName: stadium.name,
          team: stadium.team,
          abbreviation: p.abbreviation,
          gameDate: p.date,
          dayOfTrip,
        }
      })

      // Avoid near-duplicates (same trip start within 3 days)
      const isDuplicate = options.some(o =>
        Math.abs(daysBetween(o.startDate, tripStart)) < 3 &&
        o.stops.map(s => s.abbreviation).sort().join() === stops.map(s => s.abbreviation).sort().join()
      )
      if (!isDuplicate) {
        options.push({ startDate: tripStart, endDate: tripEnd, totalDays, stops, avgGapDays: avgGap, difficulty, score })
      }

      if (options.length >= 20) break
    }

    // Sort by score and return top 3
    options.sort((a, b) => a.score - b.score)
    return NextResponse.json({ options: options.slice(0, 3) })
  } catch (e) {
    console.error('Trip optimizer error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
