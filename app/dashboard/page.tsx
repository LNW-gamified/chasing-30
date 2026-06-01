import { createClient } from '@/lib/supabase-server'
import { MILESTONES } from '@/lib/milestones'
import type { Stadium, StadiumVisit, SpecialEvent, SpecialVisit, Trip } from '@/types'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { CalendarDays, ClipboardList, MapPin, DollarSign, Trophy, Eye } from 'lucide-react'
import TodayGames, { type TodayGame } from '@/components/TodayGames'
import Standings from '@/components/Standings'
import FavoriteTeamPicker from '@/components/FavoriteTeamPicker'
import DashboardSpecialVisitButton from '@/components/DashboardSpecialVisitButton'
import OnThisDay, { type HistoryFact } from '@/components/OnThisDay'
import HeroRing, { type RingDot } from '@/components/HeroRing'
import TeamLogo from '@/components/TeamLogo'
import { fetchPlayoffPicture, type PlayoffPicture } from '@/lib/mlb-api'

// ─── MLB API ──────────────────────────────────────────────────────────────────

const MLB_ID_TO_ABBR: Record<number, string> = {
  109: 'ARI', 144: 'ATL', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  145: 'CWS', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET',
  117: 'HOU', 118: 'KC',  108: 'LAA', 119: 'LAD', 146: 'MIA',
  158: 'MIL', 142: 'MIN', 121: 'NYM', 147: 'NYY', 133: 'OAK',
  143: 'PHI', 134: 'PIT', 135: 'SD',  137: 'SF',  136: 'SEA',
  138: 'STL', 139: 'TB',  140: 'TEX', 141: 'TOR', 120: 'WSH',
}

async function fetchTodayGames(favAbbr: string | null): Promise<TodayGame[]> {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&gameType=R&hydrate=linescore`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const games: TodayGame[] = (data.dates?.[0]?.games ?? []).map((g: any) => {
      const awayAbbr  = MLB_ID_TO_ABBR[g.teams?.away?.team?.id as number] ?? 'MLB'
      const homeAbbr  = MLB_ID_TO_ABBR[g.teams?.home?.team?.id as number] ?? 'MLB'
      const ls        = g.linescore
      const inningNum = ls?.currentInning ?? null
      const inning    = inningNum ? `${ls?.isTopInning === false ? '▼' : '▲'} ${inningNum}` : null
      return {
        gamePk:    g.gamePk,
        gameDate:  g.gameDate,
        awayAbbr,
        homeAbbr,
        awayScore: g.teams?.away?.score ?? null,
        homeScore: g.teams?.home?.score ?? null,
        isLive:    g.status?.abstractGameState === 'Live',
        isFinal:   g.status?.abstractGameState === 'Final',
        isFavorite: favAbbr !== null && (awayAbbr === favAbbr || homeAbbr === favAbbr),
        inning,
      }
    })
    return games.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
  } catch {
    return []
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFirstName(user: any): string {
  const meta = user?.user_metadata
  const full =
    meta?.full_name ??
    meta?.name ??
    meta?.first_name ??
    meta?.given_name ??
    meta?.display_name ??
    null
  if (full) return (full as string).trim().split(/\s+/)[0]
  return 'Your'
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch { return d }
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000))
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16,
      paddingLeft: 14,
      borderLeft: '3px solid #F5A623',
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1 }}>
        {label}
      </span>
      {right}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const todayDate  = new Date()
  const todayMonth = todayDate.getMonth() + 1
  const todayDay   = todayDate.getDate()
  const todayISO   = todayDate.toLocaleDateString('en-CA')

  const [
    { data: stadiums },
    { data: visits },
    { data: events },
    { data: trips },
    { data: { user } },
    { data: specialVisits },
    { data: destVisits },
    { data: historyFacts },
  ] = await Promise.all([
    supabase.from('stadiums').select('*').order('league').order('division').order('name'),
    supabase.from('stadium_visits').select('*').order('visit_date', { ascending: false }),
    supabase.from('special_events').select('*'),
    supabase.from('trips').select('*, stadium:stadiums(*)').order('start_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
    supabase.auth.getUser(),
    supabase.from('special_visits').select('*'),
    supabase.from('destination_visits').select('destination_id'),
    supabase.from('baseball_history')
      .select('id,year,fact,category,player_name,team')
      .eq('month', todayMonth)
      .eq('day', todayDay)
      .order('year', { ascending: false }),
  ])

  const userId = user?.id ?? ''
  const { data: userSettings } = userId
    ? await supabase.from('user_settings').select('favorite_team_abbr').eq('user_id', userId).single()
    : { data: null }

  const allStadiums:     Stadium[]      = stadiums ?? []
  const allVisits:       StadiumVisit[] = visits ?? []
  const allEvents:       SpecialEvent[] = events ?? []
  const allTrips:        Trip[]         = trips ?? []
  const allSpecialVisits: SpecialVisit[] = (specialVisits ?? []) as SpecialVisit[]
  const todayHistory:    HistoryFact[]  = (historyFacts ?? []) as HistoryFact[]

  const visitedIds   = new Set(allVisits.map(v => v.stadium_id))
  const visitedCount = visitedIds.size
  const earnedMilestones = MILESTONES.filter(m => m.check(allVisits, allStadiums, allEvents, allSpecialVisits))
  const pct = Math.round((visitedCount / 30) * 100)
  const name = getFirstName(user)

  // Ring dots — visited stadiums in chronological visit order, then empty slots
  const visitedInOrder: Array<{ abbr: string; visitDate: string }> = []
  {
    const seen = new Set<string>()
    for (const v of [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))) {
      if (!seen.has(v.stadium_id)) {
        seen.add(v.stadium_id)
        const abbr = allStadiums.find(s => s.id === v.stadium_id)?.abbreviation
        if (abbr) visitedInOrder.push({ abbr, visitDate: v.visit_date })
      }
    }
  }
  const ringDots: RingDot[] = Array.from({ length: 30 }, (_, i) => {
    if (i < visitedInOrder.length) {
      return { abbr: visitedInOrder[i].abbr, visited: true, visitDate: visitedInOrder[i].visitDate }
    }
    return { abbr: null, visited: false }
  })

  // Next planned trip
  const nextPlannedTrip = allTrips.find((t: any) =>
    t.status === 'planned' && t.start_date && t.start_date >= todayISO
  ) as any | undefined

  // Division progress — now includes team dots
  const divProgress = [
    { label: 'AL East',    league: 'AL', division: 'East'    },
    { label: 'AL Central', league: 'AL', division: 'Central' },
    { label: 'AL West',    league: 'AL', division: 'West'    },
    { label: 'NL East',    league: 'NL', division: 'East'    },
    { label: 'NL Central', league: 'NL', division: 'Central' },
    { label: 'NL West',    league: 'NL', division: 'West'    },
  ].map(({ label, league, division }) => {
    const group = allStadiums.filter(s => s.league === league && s.division === division)
    const teams = group.map(s => ({ abbr: s.abbreviation, visited: visitedIds.has(s.id) }))
    const vis   = teams.filter(t => t.visited).length
    return { label, total: group.length, vis, teams }
  })

  // Stats
  const favAbbr            = (userSettings as any)?.favorite_team_abbr ?? null
  const gamesAttended      = allVisits.length
  const specialVisitCount  = allSpecialVisits.length
  const destinationsVisited = new Set((destVisits ?? []).map((dv: any) => dv.destination_id)).size
  const totalSpent = allTrips
    .filter((t: any) => t.status === 'completed')
    .reduce((sum, t: any) => sum + t.actual_tickets + t.actual_travel + t.actual_hotel + t.actual_food + t.actual_parking, 0)

  const divCounts: Record<string, number> = {}
  for (const s of allStadiums) {
    if (visitedIds.has(s.id)) {
      const key = `${s.league} ${s.division}`
      divCounts[key] = (divCounts[key] ?? 0) + 1
    }
  }
  const divEntries = Object.entries(divCounts).sort((a, b) => b[1] - a[1])
  const favDivision = divEntries.length > 0 && (divEntries.length === 1 || divEntries[0][1] > divEntries[1][1])
    ? divEntries[0][0] : '—'

  const teamCounts: Record<string, number> = {}
  for (const v of allVisits) {
    const away = v.visiting_team?.replace(/^vs\.?\s+/i, '').trim()
    if (v.home_team) teamCounts[v.home_team] = (teamCounts[v.home_team] ?? 0) + 1
    if (away)        teamCounts[away]         = (teamCounts[away] ?? 0) + 1
  }
  const teamEntries  = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])
  const mostSeenFull = teamEntries.length > 0 ? teamEntries[0][0] : '—'
  const mostSeenTeam = mostSeenFull === '—' ? '—' : (() => {
    const words = mostSeenFull.split(' ')
    const last = words[words.length - 1]
    return last === 'Sox' ? `${words[words.length - 2]} Sox` : last
  })()

  const todayGames   = await fetchTodayGames(favAbbr)
  const playoffPic: PlayoffPicture | null = favAbbr ? await fetchPlayoffPicture(favAbbr) : null

  // "Did you attend?" — final/live home games today at unvisited stadiums
  const attendPromptStadiums = todayGames
    .filter(g => (g.isFinal || g.isLive) && !visitedIds.has(
      allStadiums.find(s => s.abbreviation === g.homeAbbr)?.id ?? ''
    ))
    .map(g => allStadiums.find(s => s.abbreviation === g.homeAbbr))
    .filter((s): s is Stadium => Boolean(s))
    .slice(0, 3)

  // Fav team stadium
  const favStadium = favAbbr ? allStadiums.find(s => s.abbreviation === favAbbr) ?? null : null
  const favStadiumVisited = favStadium ? visitedIds.has(favStadium.id) : false

  // ─── Shared styles ──────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#161B22',
    borderRadius: 16,
    border: '1px solid #21262D',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  }

  const SECTION_GAP = '2rem'

  return (
    <div style={{ color: '#E6EDF3', overflowX: 'hidden', maxWidth: '100%' }}>
      <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '1.5rem 1rem 2rem', overflowX: 'hidden', boxSizing: 'border-box' }}>


        {/* ── Hero row: The Chase (left) + Today at the Ballpark (right) ── */}
        <div
          className={todayGames.length > 0 ? 'md:grid md:grid-cols-5 md:gap-4' : ''}
          style={{ marginBottom: SECTION_GAP }}
        >
          {/* Left column: The Chase */}
          <div className={todayGames.length > 0 ? 'md:col-span-2 mb-4 md:mb-0 hero-col' : ''}>
            <div
              className="dash-card"
              style={{
                ...card,
                padding: '20px 20px 24px',
                background: '#111827',
                border: '1px solid #1e2d4a',
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(63,185,80,0.55)', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 10 }}>
                THE CHASE
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <HeroRing visited={visitedCount} total={30} dots={ringDots} />
              </div>

              <div style={{ fontSize: 22, fontWeight: 800, color: '#E6EDF3', marginBottom: 3, letterSpacing: '-0.3px' }}>
                {visitedCount === 30 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
                    <Trophy size={16} color="#F5A623" /> All 30 stadiums conquered
                  </span>
                ) : visitedCount === 0
                  ? 'The journey begins with one ballpark'
                  : `${visitedCount} of 30 MLB stadiums visited`}
              </div>
              <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 10 }}>
                {visitedCount === 30
                  ? 'Hall of Famer status achieved!'
                  : `${30 - visitedCount} park${30 - visitedCount !== 1 ? 's' : ''} remaining on the tour`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3FB950', boxShadow: '0 0 5px rgba(63,185,80,0.5)' }}/>
                  <span style={{ fontSize: 12, color: '#3FB950', fontWeight: 700 }}>{pct}% complete</span>
                </div>
                <span style={{ color: '#21262D', fontSize: 14 }}>|</span>
                <Link href="/milestones" style={{ fontSize: 12, color: '#1F6FEB', fontWeight: 600, textDecoration: 'none' }}>
                  {earnedMilestones.length} milestone{earnedMilestones.length !== 1 ? 's' : ''} earned →
                </Link>
                <span style={{ color: '#21262D', fontSize: 14 }}>|</span>
                <Link href="/passport" style={{ fontSize: 12, color: '#F5A623', fontWeight: 600, textDecoration: 'none' }}>
                  View Passport →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', maxWidth: 300, margin: '0 auto' }}>
                <Link href="/trips" style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '9px 0', borderRadius: 999,
                  background: '#1F6FEB', color: '#fff',
                  fontWeight: 700, fontSize: 14, textDecoration: 'none',
                  boxShadow: '0 2px 12px rgba(31,111,235,0.35)',
                }}>
                  Plan Road Trip
                </Link>
                <DashboardSpecialVisitButton />
              </div>
            </div>
          </div>

          {/* Right column: Today at the Ballpark */}
          {todayGames.length > 0 && (
            <div className="md:col-span-3 hero-col">
              <div
                className="dash-card"
                style={{
                  ...card,
                  padding: '20px 20px 16px',
                  height: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <TodayGames initialGames={todayGames} favAbbr={favAbbr} />
              </div>
            </div>
          )}
        </div>

        {/* ── Did you attend today? ────────────────────────────────── */}
        {attendPromptStadiums.length > 0 && (
          <div
            className="dash-card"
            style={{ ...card, marginBottom: SECTION_GAP, padding: '14px 16px', border: '1px solid rgba(245,166,35,0.25)', background: 'rgba(245,166,35,0.05)' }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ⚾ Did you attend today?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attendPromptStadiums.map(s => (
                <Link
                  key={s.id}
                  href={`/stadiums/${s.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                    backgroundColor: '#161B22', border: '1px solid #30363D',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TeamLogo abbreviation={s.abbreviation} size={28} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#8B949E' }}>{s.city}, {s.state}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#F5A623', fontWeight: 600 }}>Log Game →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Next Game board ─────────────────────────────────────── */}
        {nextPlannedTrip && (
          <div
            className="dash-card"
            style={{
              ...card,
              marginBottom: SECTION_GAP,
              background: 'linear-gradient(135deg, #0D1A28 0%, #101E30 100%)',
              border: '1px solid #1A2E44',
              padding: '20px 24px',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Scan-line animation */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
              <div className="departure-scan" style={{
                position: 'absolute', top: 0, bottom: 0, width: '40%',
                background: 'linear-gradient(90deg, transparent, rgba(245,166,35,0.04), transparent)',
              }}/>
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'rgba(245,166,35,0.72)', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14 }}>
                ◈ NEXT GAME
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3', lineHeight: 1.15, marginBottom: 4 }}>
                    {nextPlannedTrip.stadium?.name ?? nextPlannedTrip.name ?? 'Upcoming Trip'}
                  </div>
                  {nextPlannedTrip.stadium?.city && (
                    <div style={{ fontSize: 13, color: '#8B949E' }}>
                      {nextPlannedTrip.stadium.city}{nextPlannedTrip.stadium.state ? `, ${nextPlannedTrip.stadium.state}` : ''}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'rgba(245,166,35,0.6)', marginTop: 8, fontFamily: 'monospace' }}>
                    {fmtDate(nextPlannedTrip.start_date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 48, fontWeight: 900, color: '#F5A623',
                    lineHeight: 1, letterSpacing: '-2px',
                    textShadow: '0 0 20px rgba(245,166,35,0.35)',
                  }}>
                    {daysUntil(nextPlannedTrip.start_date)}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(245,166,35,0.6)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                    {daysUntil(nextPlannedTrip.start_date) === 0 ? 'TODAY' : daysUntil(nextPlannedTrip.start_date) === 1 ? 'DAY' : 'DAYS'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Playoff Picture ─────────────────────────────────────────── */}
        {playoffPic && favStadium && (
          <div className="dash-card" style={{ ...card, marginBottom: SECTION_GAP, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <TeamLogo abbreviation={favStadium.abbreviation} size={28} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#E6EDF3' }}>{favStadium.team}</span>
              <span style={{ fontSize: 12, color: '#8B949E', marginLeft: 2 }}>· Playoff Picture</span>
              {playoffPic.clinched && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.12)', padding: '2px 8px', borderRadius: 10 }}>✓ CLINCHED</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Record',   value: `${playoffPic.wins}–${playoffPic.losses}` },
                { label: 'Win %',    value: playoffPic.pct },
                { label: `${playoffPic.divisionName} Rank`, value: `#${playoffPic.divisionRank}` },
                playoffPic.gamesBack !== '—'
                  ? { label: 'GB',   value: playoffPic.gamesBack }
                  : { label: 'Division', value: 'Leader' },
                playoffPic.wildCardRank
                  ? { label: 'Wild Card', value: `#${playoffPic.wildCardRank}` }
                  : null,
                playoffPic.magicNumber
                  ? { label: 'Magic #', value: playoffPic.magicNumber }
                  : null,
                playoffPic.eliminationNumber
                  ? { label: 'Elim #', value: playoffPic.eliminationNumber }
                  : null,
              ].filter(Boolean).map(stat => (
                <div key={stat!.label}>
                  <div style={{ fontSize: 10, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{stat!.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#E6EDF3' }}>{stat!.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── On This Day ──────────────────────────────────────────────── */}
        {todayHistory.length > 0 && (
          <div style={{ marginBottom: SECTION_GAP }}>
            <OnThisDay facts={todayHistory} />
          </div>
        )}

        {/* ── Fav team visit suggestion ────────────────────────────────── */}
        {favStadium && !favStadiumVisited && (
          <div
            className="dash-card"
            style={{ ...card, marginBottom: SECTION_GAP, padding: '16px', border: '1px solid rgba(31,111,235,0.3)', background: 'rgba(31,111,235,0.05)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <TeamLogo abbreviation={favStadium.abbreviation} size={36} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>
                    You haven&apos;t visited your team&apos;s home yet
                  </div>
                  <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>
                    {favStadium.name} · {favStadium.city}, {favStadium.state}
                  </div>
                </div>
              </div>
              <Link
                href="/trips"
                style={{
                  padding: '8px 14px', borderRadius: 8, flexShrink: 0,
                  backgroundColor: '#1F6FEB', color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                Plan Trip →
              </Link>
            </div>
          </div>
        )}

        {/* ── Your Scouting Report ─────────────────────────────────────── */}
        <div style={{ marginBottom: SECTION_GAP }}>
          <SectionHeader label="Your Scouting Report" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              { Icon: CalendarDays, value: gamesAttended,        label: 'Games Witnessed',      valSize: 48, color: '#1F6FEB' },
              { Icon: ClipboardList, value: specialVisitCount,   label: 'Special Visits',        valSize: 48, color: '#1F6FEB' },
              { Icon: MapPin,        value: destinationsVisited,  label: 'Destinations',          valSize: 48, color: '#1F6FEB' },
              { Icon: DollarSign,    value: formatCurrency(totalSpent), label: 'Total Spent',    valSize: 44, color: '#3FB950' },
              { Icon: Trophy,        value: favDivision,          label: 'Fav Division',          valSize: favDivision.length > 7 ? 22 : 30, color: '#F5A623' },
              { Icon: Eye,           value: mostSeenTeam,         label: 'Most Seen Team',        valSize: mostSeenTeam.length > 7 ? 22 : 30, color: '#F5A623' },
            ] as const).map(({ Icon, value, label, valSize, color }) => (
              <div
                key={label}
                className="dash-card"
                style={{
                  ...card,
                  padding: '20px 18px 18px',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <Icon size={24} color={color} strokeWidth={1.8} style={{ marginBottom: 14, flexShrink: 0 }}/>
                <div style={{
                  fontSize: valSize, fontWeight: 900, color: '#E6EDF3',
                  lineHeight: 1, marginBottom: 8,
                  letterSpacing: typeof value === 'number' ? '-1px' : '0',
                  width: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', textAlign: 'center',
                }}>
                  {value.toString()}
                </div>
                <div style={{ fontSize: 11, color: '#8B949E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 'auto' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── The Circuit — division progress ──────────────────────────── */}
        <div style={{ marginBottom: SECTION_GAP }}>
          <SectionHeader label="The Circuit" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {divProgress.map(({ label, vis, total }) => (
              <div
                key={label}
                className="dash-card"
                style={{ ...card, padding: '18px 20px', background: '#1a2744' }}
              >
                {/* Label + fraction */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{label}</span>
                  <span style={{
                    fontSize: 14, fontWeight: 800, color: '#F5A623',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {vis}<span style={{ color: '#484F58', fontWeight: 500 }}>/{total}</span>
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 8, background: '#1C2430', borderRadius: 6, overflow: 'hidden', border: '1px solid #21262D' }}>
                  <div style={{
                    width: `${(vis / total) * 100}%`,
                    height: '100%',
                    background: vis === total
                      ? 'linear-gradient(90deg, #3FB950, #58D68D)'
                      : 'linear-gradient(90deg, #1F6FEB, #3A8EFF)',
                    borderRadius: 6,
                    transition: 'width 0.6s ease',
                    minWidth: vis > 0 ? 8 : 0,
                    boxShadow: vis > 0 ? '0 0 8px rgba(31,111,235,0.35)' : 'none',
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Favorite team picker + Standings ─────────────────────────── */}
        <FavoriteTeamPicker userId={userId} currentFavAbbr={favAbbr} />
        <Standings favAbbr={favAbbr} />

      </div>
    </div>
  )
}
