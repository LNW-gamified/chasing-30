import { createClient } from '@/lib/supabase-server'
import { MILESTONES } from '@/lib/milestones'
import type { Stadium, StadiumVisit, SpecialEvent, Trip } from '@/types'
import Link from 'next/link'
import { Home, Map, MapPin, Trophy, Plane, Bell, ChevronRight } from 'lucide-react'
import TodayGames, { type TodayGame } from '@/components/TodayGames'
import Standings from '@/components/Standings'

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
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&gameType=R`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const games: TodayGame[] = (data.dates?.[0]?.games ?? []).map((g: any) => {
      const awayAbbr = MLB_ID_TO_ABBR[g.teams?.away?.team?.id as number] ?? 'MLB'
      const homeAbbr = MLB_ID_TO_ABBR[g.teams?.home?.team?.id as number] ?? 'MLB'
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
      }
    })
    return games.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
  } catch {
    return []
  }
}

// ─── Rank ─────────────────────────────────────────────────────────────────────

function computePoints(visitedCount: number, totalGames: number, earned: number): number {
  return visitedCount * 15 + totalGames * 5 + earned * 30
}

function getRank(pts: number): string {
  if (pts >= 2000) return 'Hall of Famer'
  if (pts >= 1200) return 'All-Star'
  if (pts >= 800)  return 'Veteran'
  if (pts >= 500)  return 'Journeyman'
  if (pts >= 300)  return 'Minor Leaguer'
  if (pts >= 150)  return 'Prospect'
  if (pts >= 50)   return 'Farm Hand'
  return 'Rookie'
}

function getMilestonePoints(id: string): number {
  if (id === 'all_stadiums') return 200
  if (id === 'american_league' || id === 'national_league') return 150
  if (id === 'historic_ballparks_all') return 150
  if (id === 'east_coast' || id === 'midwest' || id === 'west_coast') return 100
  if (/^(al|nl)_(east|central|west)$/.test(id)) return 75
  if (id === 'twentyfive_stadiums') return 125
  if (id === 'twenty_stadiums') return 100
  if (id === 'fifteen_stadiums') return 80
  if (id === 'ten_stadiums') return 60
  if (id === 'world_series_attendance' || id === 'international_game') return 75
  if (id === 'all_star_attendance' || id === 'postseason_attendance') return 50
  if (id === 'hall_of_fame_visit' || id === 'field_of_dreams_visit') return 50
  if (id === 'five_stadiums') return 35
  if (id === 'ten_games') return 50
  if (id === 'five_games') return 35
  return 25
}

// ─── Quest icon ───────────────────────────────────────────────────────────────

function questStyle(id: string): { emoji: string; bg: string } {
  if (id === 'five_stadiums')    return { emoji: '🚗', bg: 'rgba(249,115,22,0.15)'  }
  if (id === 'ten_stadiums')     return { emoji: '🔟', bg: 'rgba(31,111,235,0.15)'  }
  if (id === 'fifteen_stadiums') return { emoji: '🏟️', bg: 'rgba(63,185,80,0.15)'  }
  return                                { emoji: '⚡', bg: 'rgba(139,92,246,0.15)'  }
}

// ─── User helpers ─────────────────────────────────────────────────────────────

function getFirstName(user: any): string {
  const full = user?.user_metadata?.full_name ?? user?.user_metadata?.name
  if (full) return (full as string).split(' ')[0]
  const local = (user?.email ?? '').split('@')[0] as string
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return d }
}

// ─── Progress rings ───────────────────────────────────────────────────────────

function HeroRing({ visited, total }: { visited: number; total: number }) {
  const size = 80
  const sw   = 6
  const r    = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const pct  = total > 0 ? visited / total : 0
  const offset = circ - Math.max(pct, visited > 0 ? 0.04 : 0) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#30363D" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#F5A623" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: 'drop-shadow(0 0 6px rgba(245,166,35,0.6))' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#F5A623', lineHeight: 1 }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
    </div>
  )
}

function ProgressRing({ visited, total, size = 130 }: { visited: number; total: number; size?: number }) {
  const sw = 10
  const r    = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const pct  = total > 0 ? visited / total : 0
  const offset = circ - Math.max(pct, visited > 0 ? 0.04 : 0) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#30363D" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#3FB950" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: 'drop-shadow(0 0 16px rgba(63,185,80,0.25))' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 1,
      }}>
        <span style={{ fontSize: 60, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>
          {visited}
        </span>
        <span style={{ fontSize: 18, color: '#8B949E', fontWeight: 500, lineHeight: 1 }}>
          /30
        </span>
      </div>
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Home',  href: '/dashboard',  icon: Home   },
  { label: 'Parks', href: '/stadiums',   icon: MapPin  },
  { label: 'Map',   href: '/map',        icon: Map     },
  { label: 'Goals', href: '/milestones', icon: Trophy  },
  { label: 'Trips', href: '/trips',      icon: Plane   },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: stadiums },
    { data: visits },
    { data: events },
    { data: trips },
    { data: { user } },
  ] = await Promise.all([
    supabase.from('stadiums').select('*').order('league').order('division').order('name'),
    supabase.from('stadium_visits').select('*').order('visit_date', { ascending: false }),
    supabase.from('special_events').select('*'),
    supabase.from('trips').select('*, stadium:stadiums(*)').order('start_date', { ascending: true }),
    supabase.auth.getUser(),
  ])

  const allStadiums: Stadium[]     = stadiums ?? []
  const allVisits:   StadiumVisit[] = visits ?? []
  const allEvents:   SpecialEvent[] = events ?? []
  const allTrips:    Trip[]         = trips ?? []

  const visitedIds   = new Set(allVisits.map(v => v.stadium_id))
  const visitedCount = visitedIds.size

  const earnedMilestones = MILESTONES.filter(m => m.check(allVisits, allStadiums, allEvents))
  const nextQuests       = MILESTONES.filter(m => !m.check(allVisits, allStadiums, allEvents)).slice(0, 3)

  const points = computePoints(visitedCount, allVisits.length, earnedMilestones.length)
  const rank   = getRank(points)
  const name   = getFirstName(user)
  const pct    = Math.round((visitedCount / 30) * 100)

  // Division progress
  const divProgress = [
    { label: 'AL East',    league: 'AL', division: 'East'    },
    { label: 'AL Central', league: 'AL', division: 'Central' },
    { label: 'AL West',    league: 'AL', division: 'West'    },
    { label: 'NL East',    league: 'NL', division: 'East'    },
    { label: 'NL Central', league: 'NL', division: 'Central' },
    { label: 'NL West',    league: 'NL', division: 'West'    },
  ].map(({ label, league, division }) => {
    const group = allStadiums.filter(s => s.league === league && s.division === division)
    const vis   = group.filter(s => visitedIds.has(s.id)).length
    return { label, total: group.length, vis }
  })

  // Fav team abbreviation (for Today's Games)
  const stadiumCounts: Record<string, number> = {}
  for (const v of allVisits) stadiumCounts[v.stadium_id] = (stadiumCounts[v.stadium_id] ?? 0) + 1
  const topId   = Object.entries(stadiumCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const favAbbr = allStadiums.find(s => s.id === topId)?.abbreviation ?? null

  const todayGames = await fetchTodayGames(favAbbr)

  // ─── My Stats ───────────────────────────────────────────────────────────────

  const gamesAttended = allVisits.length

  const totalSpent = allTrips
    .filter(t => t.status === 'completed')
    .reduce((sum, t) =>
      sum + t.actual_tickets + t.actual_travel + t.actual_hotel + t.actual_food + t.actual_parking,
    0)

  const divCounts: Record<string, number> = {}
  for (const s of allStadiums) {
    if (visitedIds.has(s.id)) {
      const key = `${s.league} ${s.division}`
      divCounts[key] = (divCounts[key] ?? 0) + 1
    }
  }
  const divEntries = Object.entries(divCounts).sort((a, b) => b[1] - a[1])
  const favDivision =
    divEntries.length > 0 && (divEntries.length === 1 || divEntries[0][1] > divEntries[1][1])
      ? divEntries[0][0]
      : '—'

  const teamCounts: Record<string, number> = {}
  for (const v of allVisits) {
    if (v.home_team)     teamCounts[v.home_team]     = (teamCounts[v.home_team] ?? 0) + 1
    if (v.visiting_team) teamCounts[v.visiting_team] = (teamCounts[v.visiting_team] ?? 0) + 1
  }
  const teamEntries  = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])
  const mostSeenFull = teamEntries.length > 0 ? teamEntries[0][0] : '—'
  const mostSeenTeam = mostSeenFull === '—' ? '—' : (mostSeenFull.split(' ').pop() ?? mostSeenFull)

  // ─── Next Up ────────────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const nextPlannedTrip = allTrips.find(t =>
    t.status === 'planned' &&
    ((t.start_date && t.start_date >= today) || (t.trip_date && t.trip_date >= today))
  )
  const nearestUnvisited = allStadiums.find(s => !visitedIds.has(s.id))

  // ─── Shared styles ────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#161B22',
    borderRadius: 16,
    border: '1px solid #30363D',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#8B949E',
    textTransform: 'uppercase', letterSpacing: '0.1em',
  }

  const headerBlock = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      background: '#0B1117',
      borderBottom: '1px solid #30363D',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.15 }}>
          ⚾ Chasing 30
        </div>
        <div style={{
          marginTop: 5,
          display: 'inline-flex', alignItems: 'center',
          background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)',
          borderRadius: 999, padding: '2px 10px',
          fontSize: 12, fontWeight: 600, color: '#F5A623',
        }}>
          {rank} · {points} pts
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          aria-label="Notifications"
        >
          <Bell size={18} style={{ color: '#8B949E' }} />
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(31,111,235,0.18)', border: '1px solid rgba(31,111,235,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8B949E', fontWeight: 700, fontSize: '0.9rem',
        }}>
          {name.charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#0B1117', color: '#E6EDF3', minHeight: '100vh', overflowX: 'hidden', maxWidth: '100vw' }}>
      <div style={{ display: 'flex' }}>

        {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
        <aside
          className="hidden md:flex flex-col"
          style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, zIndex: 30,
            background: '#0B1117', borderRight: '1px solid #30363D', overflowY: 'auto',
          }}
        >
          <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid #30363D' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#E6EDF3' }}>⚾ Chasing 30</div>
            <div style={{ fontSize: '0.75rem', color: '#8B949E', marginTop: 2 }}>MLB Stadium Tracker</div>
          </div>
          <nav style={{ flex: 1, padding: '0.75rem' }}>
            {NAV.map(({ label, href, icon: Icon }, i) => {
              const active = i === 0
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 0.875rem', borderRadius: 10, marginBottom: 2,
                  backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                  color: active ? '#E6EDF3' : '#8B949E',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9375rem', textDecoration: 'none',
                  borderLeft: active ? '3px solid #1F6FEB' : '3px solid transparent',
                }}>
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #30363D' }}>
            <div style={{ fontSize: '0.8125rem', color: '#8B949E', marginBottom: 6 }}>
              {visitedCount} / 30 · {pct}% complete
            </div>
            <div style={{ height: 4, background: '#30363D', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#3FB950', borderRadius: 3 }} />
            </div>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main
          className="flex-1 md:pl-60"
          style={{ paddingBottom: '5.5rem', maxWidth: '100%', overflowX: 'hidden' }}
        >
          {/* Header — mobile only (sidebar takes over on desktop) */}
          <div className="md:hidden">
            {headerBlock}
          </div>
          {/* Header — desktop (shows in main content area, not sidebar) */}
          <div className="hidden md:block">
            {headerBlock}
          </div>

          <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '1.25rem 1rem', overflowX: 'hidden', boxSizing: 'border-box' }}>

            {/* ── Hero Progress Card ───────────────────────────────────────── */}
            <div style={{ ...card, padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>
                My Progress
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <ProgressRing visited={visitedCount} total={30} size={150} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.2, marginBottom: 6 }}>
                {visitedCount} of 30 stadiums
              </div>
              <div style={{ fontSize: 14, color: '#8B949E', marginBottom: 14 }}>
                {visitedCount === 30
                  ? 'Legend status achieved!'
                  : `${30 - visitedCount} park${30 - visitedCount !== 1 ? 's' : ''} remaining`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
                <span style={{ color: '#3FB950', fontSize: 14, fontWeight: 600 }}>{pct}% complete</span>
                <span style={{ color: '#30363D' }}>·</span>
                <Link href="/milestones" style={{ color: '#1F6FEB', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  {earnedMilestones.length} milestone{earnedMilestones.length !== 1 ? 's' : ''} earned →
                </Link>
              </div>
              <Link href="/trips" style={{
                display: 'block', textAlign: 'center',
                background: '#1F6FEB', color: '#fff',
                padding: '11px 0', borderRadius: 999,
                fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
              }}>
                Plan Next Trip →
              </Link>
            </div>

            {/* ── Next Up Card ─────────────────────────────────────────────── */}
            <div style={{
              ...card,
              padding: '1rem 1.25rem', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  NEXT UP
                </div>
                {nextPlannedTrip ? (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>
                      {(nextPlannedTrip as any).stadium?.name ?? nextPlannedTrip.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>
                      {fmtDate(nextPlannedTrip.start_date ?? nextPlannedTrip.trip_date)}
                    </div>
                  </div>
                ) : nearestUnvisited ? (
                  <div>
                    <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 2 }}>Suggested</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>
                      {nearestUnvisited.name}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#3FB950' }}>
                    All 30 stadiums visited!
                  </div>
                )}
              </div>
              <Link href="/trips" style={{ fontSize: 14, fontWeight: 600, color: '#1F6FEB', textDecoration: 'none', flexShrink: 0 }}>
                View →
              </Link>
            </div>

            {/* ── Division Progress ─────────────────────────────────────────── */}
            <div style={{ ...card, padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, color: '#E6EDF3', fontSize: 16, marginBottom: '0.875rem' }}>
                Division Progress
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {divProgress.map(({ label, vis, total }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: '#E6EDF3' }}>{label}</span>
                      <span style={{ fontSize: 13, color: '#8B949E' }}>{vis}/{total}</span>
                    </div>
                    <div style={{ height: 7, background: '#30363D', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(vis / total) * 100}%`, height: '100%',
                        background: '#1F6FEB', borderRadius: 4,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── My Stats Card ────────────────────────────────────────────── */}
            <div style={{ ...card, marginBottom: '1.5rem', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.25rem 0.75rem', fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                MY STATS
              </div>
              {/* gap-px + dark bg creates 1px dividers between cells at every breakpoint */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: '#30363D' }}>
                {[
                  { icon: '⚾', value: gamesAttended.toString(),         label: 'Games Attended' },
                  { icon: '💰', value: `$${totalSpent.toLocaleString()}`, label: 'Total Spent'    },
                  { icon: '🏆', value: favDivision,                       label: 'Fav Division'   },
                  { icon: '👁', value: mostSeenTeam,                      label: 'Most Seen'      },
                ].map(({ icon, value, label }) => (
                  <div key={label} style={{ background: '#161B22', padding: 16 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#E6EDF3', lineHeight: 1.1, marginBottom: 4 }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 14, color: '#8B949E' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Today's Games ────────────────────────────────────────────── */}
            {todayGames.length > 0 && (
              <TodayGames initialGames={todayGames} favAbbr={favAbbr} />
            )}

            {/* ── Standings ────────────────────────────────────────────────── */}
            <Standings favAbbr={favAbbr} />

            {/* ── Your Quests ───────────────────────────────────────────────── */}
            {nextQuests.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={sectionLabel}>Your Quests</span>
                  <Link href="/milestones" style={{ fontSize: 13, color: '#1F6FEB', fontWeight: 600, textDecoration: 'none' }}>
                    See All
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nextQuests.map(m => {
                    const { emoji, bg } = questStyle(m.id)
                    return (
                      <Link key={m.id} href="/milestones" style={{ textDecoration: 'none' }}>
                        <div style={{
                          background: '#161B22', borderRadius: 12, border: '1px solid #30363D',
                          padding: '0.875rem 1rem',
                          display: 'flex', alignItems: 'center', gap: '0.875rem',
                        }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                            backgroundColor: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22,
                          }}>
                            {emoji}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#E6EDF3', fontSize: 16, marginBottom: 2 }}>
                              {m.name}
                            </div>
                            <div style={{ color: '#8B949E', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.description}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ color: '#F5A623', fontSize: '0.8rem', fontWeight: 600 }}>
                              +{getMilestonePoints(m.id)}
                            </span>
                            <ChevronRight size={14} style={{ color: '#8B949E' }} />
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────────────────────── */}
      <nav
        className="md:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: 'rgba(11,17,23,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid #30363D',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0.6rem 0 0.5rem' }}>
          {NAV.map(({ label, href, icon: Icon }, i) => {
            const active = i === 0
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  minWidth: 44, textDecoration: 'none',
                  color: active ? '#1F6FEB' : '#8B949E',
                }}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, lineHeight: 1 }}>{label}</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
