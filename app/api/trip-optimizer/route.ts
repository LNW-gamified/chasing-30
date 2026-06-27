import { NextRequest, NextResponse } from 'next/server'
import { MLB_TEAM_IDS } from '@/lib/mlb-api'

const ABBR_TO_TZ: Record<string, { tz: string; label: string }> = {
  ATL: { tz: 'America/New_York',    label: 'ET'  }, BAL: { tz: 'America/New_York',    label: 'ET'  },
  BOS: { tz: 'America/New_York',    label: 'ET'  }, CIN: { tz: 'America/New_York',    label: 'ET'  },
  CLE: { tz: 'America/New_York',    label: 'ET'  }, DET: { tz: 'America/New_York',    label: 'ET'  },
  MIA: { tz: 'America/New_York',    label: 'ET'  }, NYM: { tz: 'America/New_York',    label: 'ET'  },
  NYY: { tz: 'America/New_York',    label: 'ET'  }, PHI: { tz: 'America/New_York',    label: 'ET'  },
  PIT: { tz: 'America/New_York',    label: 'ET'  }, TB:  { tz: 'America/New_York',    label: 'ET'  },
  TOR: { tz: 'America/Toronto',     label: 'ET'  }, WSH: { tz: 'America/New_York',    label: 'ET'  },
  CHC: { tz: 'America/Chicago',     label: 'CT'  }, CWS: { tz: 'America/Chicago',     label: 'CT'  },
  HOU: { tz: 'America/Chicago',     label: 'CT'  }, KC:  { tz: 'America/Chicago',     label: 'CT'  },
  MIL: { tz: 'America/Chicago',     label: 'CT'  }, MIN: { tz: 'America/Chicago',     label: 'CT'  },
  STL: { tz: 'America/Chicago',     label: 'CT'  }, TEX: { tz: 'America/Chicago',     label: 'CT'  },
  ARI: { tz: 'America/Phoenix',     label: 'MST' }, COL: { tz: 'America/Denver',      label: 'MT'  },
  LAA: { tz: 'America/Los_Angeles', label: 'PT'  }, LAD: { tz: 'America/Los_Angeles', label: 'PT'  },
  OAK: { tz: 'America/Los_Angeles', label: 'PT'  }, SD:  { tz: 'America/Los_Angeles', label: 'PT'  },
  SF:  { tz: 'America/Los_Angeles', label: 'PT'  }, SEA: { tz: 'America/Los_Angeles', label: 'PT'  },
}

interface StadiumInput {
  id: string
  abbreviation: string
  name: string
  team: string
  lat: number
  lng: number
}

interface GameEntry {
  date: string           // YYYY-MM-DD
  localTime: string      // e.g. "7:10 PM ET"
  opponentName: string   // away team full name, prefixed with "vs "
  opponentTeamId: number // MLB team ID of the away team
}

interface RawStop {
  stadiumId: string
  abbreviation: string
  date: string
  localTime: string
  opponentName: string
  opponentTeamId: number
}

interface EnrichedStop {
  stadiumId: string
  stadiumName: string
  team: string
  abbreviation: string
  gameDate: string
  gameTime: string
  opponentName: string
  opponentTeamId: number
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

function toLocalTime(utcDateStr: string, tz: string, tzLabel: string): string {
  try {
    const local = new Date(utcDateStr).toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return `${local} ${tzLabel}`
  } catch {
    return ''
  }
}

async function fetchHomeGames(
  abbreviations: string[],
  startDate: string,
  endDate: string
): Promise<Record<string, GameEntry[]>> {
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

  const homeDates: Record<string, GameEntry[]> = {}
  for (const abbr of abbreviations) homeDates[abbr] = []

  for (const dateEntry of data.dates ?? []) {
    for (const game of dateEntry.games ?? []) {
      const homeId: number = game.teams?.home?.team?.id
      const abbr = idToAbbr[homeId]
      if (!abbr || !game.gameDate) continue

      const dateStr = (game.gameDate as string).slice(0, 10)
      // Skip doubleheader second games — keep only the first game per date
      if (homeDates[abbr].some(e => e.date === dateStr)) continue

      const tzInfo = ABBR_TO_TZ[abbr] ?? { tz: 'America/New_York', label: 'ET' }
      const localTime = toLocalTime(game.gameDate as string, tzInfo.tz, tzInfo.label)
      const awayName: string = game.teams?.away?.team?.name ?? ''
      const awayId: number = game.teams?.away?.team?.id ?? 0
      homeDates[abbr].push({
        date: dateStr,
        localTime,
        opponentName: awayName ? `vs ${awayName}` : '',
        opponentTeamId: awayId,
      })
    }
  }

  for (const abbr of abbreviations) {
    homeDates[abbr].sort((a, b) => a.date.localeCompare(b.date))
  }

  return homeDates
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

    const otherAbbrs = allAbbrs.filter(a => a !== startingAbbr)

    // Iterate over each home game of the starting stadium as a potential trip start
    const startingGames = (homeGamesByTeam[startingAbbr] ?? [])
      .filter(e => e.date >= startDate && e.date <= endDate)

    const candidates: TripOption[] = []

    for (const startEntry of startingGames) {
      const tripStart = startEntry.date
      const windowEnd = addDays(tripStart, numDays - 1)

      // Nearest-neighbor greedy: always pick the geographically closest remaining stadium
      // that has a home game strictly after the current date and within the window.
      let currentLat = startingStadium.lat
      let currentLng = startingStadium.lng
      let currentDate = tripStart
      const remaining = [...otherAbbrs]
      const route: RawStop[] = [{
        stadiumId: startingStadium.id,
        abbreviation: startingAbbr,
        date: tripStart,
        localTime: startEntry.localTime,
        opponentName: startEntry.opponentName,
        opponentTeamId: startEntry.opponentTeamId,
      }]
      let routeValid = true

      while (remaining.length > 0) {
        let bestIdx = -1
        let bestEntry: GameEntry | null = null
        let bestDist = Infinity

        for (let i = 0; i < remaining.length; i++) {
          const abbr = remaining[i]
          const stadium = stadiums.find(s => s.abbreviation === abbr)
          if (!stadium) continue

          const nextEntry = (homeGamesByTeam[abbr] ?? []).find(
            e => e.date > currentDate && e.date <= windowEnd
          )
          if (!nextEntry) continue

          const dist = haversine(currentLat, currentLng, stadium.lat, stadium.lng)
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
            bestEntry = nextEntry
          }
        }

        if (bestIdx === -1 || !bestEntry) { routeValid = false; break }

        const abbr = remaining.splice(bestIdx, 1)[0]
        const stadium = stadiums.find(s => s.abbreviation === abbr)!
        route.push({
          stadiumId: stadium.id,
          abbreviation: abbr,
          date: bestEntry.date,
          localTime: bestEntry.localTime,
          opponentName: bestEntry.opponentName,
          opponentTeamId: bestEntry.opponentTeamId,
        })
        currentLat = stadium.lat
        currentLng = stadium.lng
        currentDate = bestEntry.date
      }

      if (!routeValid) continue

      if (candidates.some(o => o.startDate === tripStart)) continue

      const tripEnd = route[route.length - 1].date
      const totalDays = daysBetween(tripStart, tripEnd) + 1

      const enrichedStops: EnrichedStop[] = route.map((stop, i) => {
        const stadium = stadiums.find(s => s.abbreviation === stop.abbreviation)!
        const prevStop = route[i - 1]
        const prevStadium = prevStop ? stadiums.find(s => s.abbreviation === prevStop.abbreviation)! : null
        const nextStop = route[i + 1] ?? null
        const distFromPrev = prevStadium
          ? Math.round(haversine(prevStadium.lat, prevStadium.lng, stadium.lat, stadium.lng))
          : 0
        const driveMinFromPrev = Math.round(distFromPrev * 1.4)

        return {
          stadiumId: stop.stadiumId,
          stadiumName: stadium.name,
          team: stadium.team,
          abbreviation: stop.abbreviation,
          gameDate: stop.date,
          gameTime: stop.localTime,
          opponentName: stop.opponentName,
          opponentTeamId: stop.opponentTeamId,
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
