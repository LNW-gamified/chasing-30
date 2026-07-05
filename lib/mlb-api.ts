export const MLB_TEAM_IDS: Record<string, number> = {
  LAA: 108, ARI: 109, BAL: 110, BOS: 111,
  CHC: 112, CIN: 113, CLE: 114, COL: 115,
  DET: 116, HOU: 117, KC: 118, LAD: 119,
  WSH: 120, NYM: 121, OAK: 133, PHI: 143,
  PIT: 134, SD: 135, SEA: 136, SF: 137,
  STL: 138, TB: 139, TEX: 140, TOR: 141,
  MIN: 142, NYY: 147, MIA: 146, MIL: 158,
  ATL: 144, CWS: 145,
}

export const MLB_ID_TO_ABBR: Record<number, string> = Object.fromEntries(
  Object.entries(MLB_TEAM_IDS).map(([abbr, id]) => [id, abbr])
)

export const STADIUM_TZ: Record<string, string> = {
  ARI: 'America/Phoenix',
  ATL: 'America/New_York',  BAL: 'America/New_York',  BOS: 'America/New_York',
  CHC: 'America/Chicago',   CWS: 'America/Chicago',   CIN: 'America/New_York',
  CLE: 'America/New_York',  COL: 'America/Denver',    DET: 'America/Detroit',
  HOU: 'America/Chicago',   KC:  'America/Chicago',
  LAA: 'America/Los_Angeles', LAD: 'America/Los_Angeles',
  MIA: 'America/New_York',  MIL: 'America/Chicago',   MIN: 'America/Chicago',
  NYM: 'America/New_York',  NYY: 'America/New_York',
  OAK: 'America/Los_Angeles', PHI: 'America/New_York', PIT: 'America/New_York',
  SD:  'America/Los_Angeles', SF:  'America/Los_Angeles', SEA: 'America/Los_Angeles',
  STL: 'America/Chicago',   TB:  'America/New_York',  TEX: 'America/Chicago',
  TOR: 'America/Toronto',   WSH: 'America/New_York',
}

export const TZ_LABEL: Record<string, string> = {
  'America/New_York':    'ET',
  'America/Chicago':     'CT',
  'America/Denver':      'MT',
  'America/Phoenix':     'AZT',
  'America/Los_Angeles': 'PT',
  'America/Detroit':     'ET',
  'America/Toronto':     'ET',
}

export interface UpcomingGame {
  gamePk: number
  gameDate: string
  homeTeam: string
  awayTeam: string
  venue: string
  status: string
  promotions: string[]
}

export async function fetchUpcomingHomeGames(teamAbbr: string, days = 180): Promise<UpcomingGame[]> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return []

  const today = new Date().toISOString().split('T')[0]
  const end = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
  const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&startDate=${today}&endDate=${end}&sportId=1&hydrate=team,venue,game(promotions)`

  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()

    const games: UpcomingGame[] = []
    for (const date of data.dates ?? []) {
      for (const game of date.games ?? []) {
        const homeId = game.teams?.home?.team?.id
        if (homeId !== teamId) continue
        games.push({
          gamePk: game.gamePk,
          gameDate: game.gameDate,
          homeTeam: game.teams.home.team.name,
          awayTeam: game.teams.away.team.name,
          venue: game.venue?.name ?? '',
          status: game.status?.abstractGameState ?? '',
          promotions: (game.promotions ?? []).map((p: { name?: string }) => p.name).filter(Boolean) as string[],
        })
      }
    }
    return games
  } catch {
    return []
  }
}

export interface SeasonGame {
  gamePk: number
  gameDate: string      // UTC ISO from MLB API
  homeTeam: string
  homeTeamAbbr: string
  awayTeam: string
  awayTeamAbbr: string
  status: string        // 'Final' | 'Live' | 'Preview' | etc.
  isFinal: boolean
  isLive: boolean
}

export async function fetchSeasonHomeGames(teamAbbr: string): Promise<SeasonGame[]> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return []

  const year      = new Date().getFullYear()
  const startDate = `${year}-03-01`
  const endDate   = `${year + 2}-12-31`
  const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&sportId=1&gameType=R`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()

    const games: SeasonGame[] = []
    for (const dateEntry of data.dates ?? []) {
      for (const game of dateEntry.games ?? []) {
        const homeTeamId: number = game.teams?.home?.team?.id
        if (homeTeamId !== teamId) continue
        const awayTeamId: number = game.teams?.away?.team?.id
        games.push({
          gamePk:       game.gamePk,
          gameDate:     game.gameDate,
          homeTeam:     game.teams.home.team.name,
          homeTeamAbbr: teamAbbr,
          awayTeam:     game.teams.away.team.name,
          awayTeamAbbr: MLB_ID_TO_ABBR[awayTeamId] ?? '',
          status:       game.status?.abstractGameState ?? '',
          isFinal:      game.status?.abstractGameState === 'Final',
          isLive:       game.status?.abstractGameState === 'Live',
        })
      }
    }
    return games
  } catch {
    return []
  }
}

// ── Venue dimensions ─────────────────────────────────────────────────────────

export interface VenueDimensions {
  leftLine:    number | null
  leftCenter:  number | null
  center:      number | null
  rightCenter: number | null
  rightLine:   number | null
  roofType:    string | null
  turfType:    string | null
  capacity:    number | null
}

export async function fetchVenueDimensions(teamAbbr: string): Promise<VenueDimensions | null> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return null
  try {
    const teamRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}`)
    if (!teamRes.ok) return null
    const teamData = await teamRes.json()
    const venueId: number | undefined = teamData.teams?.[0]?.venue?.id
    if (!venueId) return null

    const venueRes = await fetch(`https://statsapi.mlb.com/api/v1/venues/${venueId}?hydrate=fieldInfo`)
    if (!venueRes.ok) return null
    const venueData = await venueRes.json()
    const fi = venueData.venues?.[0]?.fieldInfo
    if (!fi) return null

    return {
      leftLine:    fi.leftLine    ?? null,
      leftCenter:  fi.leftCenter  ?? null,
      center:      fi.center      ?? null,
      rightCenter: fi.rightCenter ?? null,
      rightLine:   fi.rightLine   ?? null,
      roofType:    fi.roofType    ?? null,
      turfType:    fi.turfType    ?? null,
      capacity:    fi.capacity    ?? null,
    }
  } catch {
    return null
  }
}

// ── Team season stats ─────────────────────────────────────────────────────────

export interface TeamSeasonStats {
  wins:       number | null
  losses:     number | null
  era:        string | null
  avg:        string | null
  homeRuns:   number | null
  strikeouts: number | null
  runsScored: number | null
}

export async function fetchTeamSeasonStats(teamAbbr: string): Promise<TeamSeasonStats | null> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return null
  const year = new Date().getFullYear()
  try {
    const [hitRes, pitchRes, standRes] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${year}`),
      fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${year}`),
      fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsType=regularSeason`),
    ])
    const hitData   = hitRes.ok   ? await hitRes.json()   : null
    const pitchData = pitchRes.ok ? await pitchRes.json() : null
    const standData = standRes.ok ? await standRes.json() : null

    const hitStat   = hitData?.stats?.[0]?.splits?.[0]?.stat
    const pitchStat = pitchData?.stats?.[0]?.splits?.[0]?.stat

    let wins = null, losses = null
    if (standData?.records) {
      for (const league of standData.records) {
        for (const team of (league.teamRecords ?? [])) {
          if (team.team?.id === teamId) { wins = team.wins ?? null; losses = team.losses ?? null }
        }
      }
    }

    return {
      wins, losses,
      era:        pitchStat?.era        ?? null,
      avg:        hitStat?.avg          ?? null,
      homeRuns:   hitStat?.homeRuns     ?? null,
      strikeouts: pitchStat?.strikeouts ?? null,
      runsScored: hitStat?.runs         ?? null,
    }
  } catch {
    return null
  }
}

// ── Game highlights ───────────────────────────────────────────────────────────

export interface GameHighlight {
  title:       string
  description: string
  url:         string
  thumbnailUrl: string | null
}

export interface GameContent {
  recap:      string | null
  highlights: GameHighlight[]
}

interface ImageCut {
  aspectRatio: string
  width: number
  height: number
  src: string
}

function pickThumbnail(image: { cuts?: ImageCut[] } | undefined): string | null {
  const cuts = image?.cuts
  if (!cuts || cuts.length === 0) return null
  // Prefer 16:9 cuts sized for a small list thumbnail (target ~400px wide),
  // rather than the largest available (1920px) or smallest (74px).
  const widescreen = cuts.filter(c => c.aspectRatio === '16:9')
  const pool = widescreen.length > 0 ? widescreen : cuts
  const target = 400
  const closest = pool.reduce((best, c) =>
    Math.abs(c.width - target) < Math.abs(best.width - target) ? c : best
  , pool[0])
  return closest.src
}

export async function fetchGameContent(gamePk: number): Promise<GameContent | null> {
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/content`)
    if (!res.ok) return null
    const data = await res.json()
    const recap = data.editorial?.recap?.mlb?.blurb ?? data.editorial?.recap?.mlb?.seoTitle ?? null
    const items: any[] = data.highlights?.highlights?.items ?? []
    const highlights: GameHighlight[] = items
      .filter((h: any) => h.type === 'video' && h.playbacks?.length > 0)
      .slice(0, 3)
      .map((h: any) => ({
        title:       h.headline ?? h.title ?? 'Highlight',
        description: h.blurb   ?? '',
        url:         h.playbacks?.find((p: any) => p.name === 'mp4Avc') ?.url
                  ?? h.playbacks?.[0]?.url ?? '',
        thumbnailUrl: pickThumbnail(h.image),
      }))
      .filter(h => h.url)
    return { recap, highlights }
  } catch {
    return null
  }
}

// ── Current roster ────────────────────────────────────────────────────────────

export interface RosterPlayer {
  id:           number
  name:         string
  position:     string
  positionType: string
  jerseyNumber: string | null
}

export async function fetchTeamRoster(teamAbbr: string): Promise<RosterPlayer[]> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return []
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.roster ?? []).map((p: any) => ({
      id:           p.person.id,
      name:         p.person.fullName,
      position:     p.position.abbreviation,
      positionType: p.position.type,
      jerseyNumber: p.jerseyNumber ?? null,
    }))
  } catch {
    return []
  }
}

// ── Recent transactions ───────────────────────────────────────────────────────

export interface Transaction {
  date:         string
  description:  string
  typeCode:     string
}

export async function fetchRecentTransactions(teamAbbr: string): Promise<Transaction[]> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return []
  const endDate   = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/transactions?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.transactions ?? [])
      .filter((t: any) => t.typeCode && t.description)
      .slice(0, 8)
      .map((t: any) => ({
        date:        t.date ?? t.effectiveDate ?? '',
        description: t.description,
        typeCode:    t.typeCode,
      }))
  } catch {
    return []
  }
}

// ── Scoring plays ─────────────────────────────────────────────────────────────

export interface ScoringPlay {
  inning:      number
  halfInning:  'top' | 'bottom'
  description: string
  awayScore:   number
  homeScore:   number
}

export async function fetchScoringPlays(gamePk: number): Promise<ScoringPlay[]> {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live` +
      `?fields=liveData,plays,scoringPlays,allPlays,about,result,inning,halfInning,awayScore,homeScore,description,event`
    )
    if (!res.ok) return []
    const data  = await res.json()
    const all: any[]     = data.liveData?.plays?.allPlays ?? []
    const indices: number[] = data.liveData?.plays?.scoringPlays ?? []
    return indices
      .map(i => all[i])
      .filter(Boolean)
      .map(p => ({
        inning:      p.about?.inning     ?? 0,
        halfInning:  p.about?.halfInning ?? 'top',
        description: p.result?.description ?? '',
        awayScore:   p.result?.awayScore  ?? 0,
        homeScore:   p.result?.homeScore  ?? 0,
      }))
  } catch {
    return []
  }
}

// ── Playoff picture ───────────────────────────────────────────────────────────

export interface PlayoffPicture {
  wins:              number
  losses:            number
  pct:               string
  divisionRank:      number
  divisionName:      string
  gamesBack:         string
  wildCardRank:      number | null
  wildCardGamesBack: string
  magicNumber:       string | null
  eliminationNumber: string | null
  clinched:          boolean
}

export async function fetchPlayoffPicture(teamAbbr: string): Promise<PlayoffPicture | null> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return null
  const year = new Date().getFullYear()
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsType=regularSeason&hydrate=division`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    for (const record of data.records ?? []) {
      const tr = (record.teamRecords ?? []).find((t: any) => t.team.id === teamId)
      if (!tr) continue
      return {
        wins:              tr.wins,
        losses:            tr.losses,
        pct:               tr.winningPercentage ?? '.000',
        divisionRank:      parseInt(tr.divisionRank ?? '0'),
        divisionName:      record.division?.nameShort ?? record.division?.name ?? '',
        gamesBack:         tr.gamesBack === '-'         ? '—' : tr.gamesBack ?? '—',
        wildCardRank:      tr.wildCardRank ? parseInt(tr.wildCardRank) : null,
        wildCardGamesBack: tr.wildCardGamesBack === '-' ? '—' : tr.wildCardGamesBack ?? '—',
        magicNumber:       tr.magicNumber && tr.magicNumber !== '-'         ? tr.magicNumber : null,
        eliminationNumber: tr.eliminationNumber && tr.eliminationNumber !== '-' ? tr.eliminationNumber : null,
        clinched:          tr.clinched ?? false,
      }
    }
    return null
  } catch {
    return null
  }
}

// ── Minor league affiliates ───────────────────────────────────────────────────

export interface MiLBAffiliate {
  id:         number
  sportId:    number
  name:       string
  level:      string
  leagueName: string
}

export async function fetchMinorLeagueAffiliates(teamAbbr: string): Promise<MiLBAffiliate[]> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return []
  const year = new Date().getFullYear()
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/affiliates?season=${year}`)
    if (!res.ok) return []
    const data = await res.json()
    const LEVELS: Record<string, string> = {
      'Triple-A': 'AAA', 'Double-A': 'AA', 'High-A': 'A+', 'Single-A': 'A',
    }
    const seen = new Set<string>()
    return (data.teams ?? [])
      .map((t: any) => {
        const sport = t.sport?.name ?? ''
        const level = Object.keys(LEVELS).find(l => sport.includes(l))
        if (!level || seen.has(level)) return null
        seen.add(level)
        return {
          id: t.id, sportId: t.sport?.id,
          name: t.name, level: LEVELS[level], leagueName: t.league?.name ?? '',
        }
      })
      .filter(Boolean)
      .sort((a: MiLBAffiliate, b: MiLBAffiliate) =>
        ['AAA','AA','A+','A'].indexOf(a.level) - ['AAA','AA','A+','A'].indexOf(b.level)
      )
  } catch {
    return []
  }
}

export interface FarmGame {
  affiliateName: string
  level:         string
  opponent:      string
  isHome:        boolean
  teamScore:     number | null
  oppScore:      number | null
  isLive:        boolean
  isFinal:       boolean
  gameDate:      string
  inning:        string | null
}

// Fetches today's game (if any) for each affiliate. MLB's schedule endpoint
// requires an explicit sportId for non-MLB teams (verified: Triple-A=11,
// Double-A=12, High-A=13, Single-A=14 — teamId+date alone returns an error).
export async function fetchFarmSystemToday(affiliates: MiLBAffiliate[]): Promise<FarmGame[]> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const results = await Promise.all(affiliates.map(async (aff): Promise<FarmGame | null> => {
    if (!aff.id || !aff.sportId) return null
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=${aff.sportId}&teamId=${aff.id}&date=${today}&hydrate=linescore`
      )
      if (!res.ok) return null
      const data = await res.json()
      const game = data.dates?.[0]?.games?.[0]
      if (!game) return null

      const isHome = game.teams?.home?.team?.id === aff.id
      const opponent = (isHome ? game.teams?.away?.team?.name : game.teams?.home?.team?.name) ?? 'TBD'
      const ls = game.linescore
      const inningNum  = ls?.currentInning ?? null
      const inningHalf = ls?.isTopInning === false ? 'Bot' : 'Top'

      return {
        affiliateName: aff.name,
        level:         aff.level,
        opponent,
        isHome,
        teamScore: (isHome ? game.teams?.home?.score : game.teams?.away?.score) ?? null,
        oppScore:  (isHome ? game.teams?.away?.score : game.teams?.home?.score) ?? null,
        isLive:  game.status?.abstractGameState === 'Live',
        isFinal: game.status?.abstractGameState === 'Final',
        gameDate: game.gameDate,
        inning: inningNum ? `${inningHalf} ${inningNum}` : null,
      }
    } catch {
      return null
    }
  }))
  return results.filter((g): g is FarmGame => g !== null)
}
