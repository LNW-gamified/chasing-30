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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: stadiums },
    { data: visits },
    { data: events },
    { data: trips },
    { data: { user } },
    { data: specialVisits },
    { data: destVisits },
  ] = await Promise.all([
    supabase.from('stadiums').select('*').order('league').order('division').order('name'),
    supabase.from('stadium_visits').select('*').order('visit_date', { ascending: false }),
    supabase.from('special_events').select('*'),
    supabase.from('trips').select('*, stadium:stadiums(*)').order('start_date', { ascending: true }),
    supabase.auth.getUser(),
    supabase.from('special_visits').select('*'),
    supabase.from('destination_visits').select('destination_id'),
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

  const visitedIds   = new Set(allVisits.map(v => v.stadium_id))
  const visitedCount = visitedIds.size

  const earnedMilestones = MILESTONES.filter(m => m.check(allVisits, allStadiums, allEvents, allSpecialVisits))

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

  // Fav team abbreviation (user-selected)
  const favAbbr = (userSettings as any)?.favorite_team_abbr ?? null

  const todayGames = await fetchTodayGames(favAbbr)

  const destinationsVisited = new Set((destVisits ?? []).map((dv: any) => dv.destination_id)).size

  // ─── My Stats ───────────────────────────────────────────────────────────────

  const gamesAttended      = allVisits.length
  const specialVisitCount  = allSpecialVisits.length

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

  // ─── Shared styles ────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#161B22',
    borderRadius: 16,
    border: '1px solid #30363D',
  }

  return (
    <div style={{ color: '#E6EDF3', overflowX: 'hidden', maxWidth: '100%' }}>
          <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '1.25rem 1rem', overflowX: 'hidden', boxSizing: 'border-box' }}>

            {/* ── Hero Progress Card ───────────────────────────────────────── */}
            <div style={{ ...card, padding: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
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
              <DashboardSpecialVisitButton />
            </div>

            {/* ── My Stats Card ────────────────────────────────────────────── */}
            <div style={{ ...card, marginBottom: '1.25rem', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.25rem 0.75rem', fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                MY STATS
              </div>
              {/* gap-px + dark bg creates 1px dividers between cells at every breakpoint */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px" style={{ background: '#30363D' }}>
                {[
                  { Icon: CalendarDays,   value: gamesAttended.toString(),      label: 'Games Attended'       },
                  { Icon: ClipboardList,  value: specialVisitCount.toString(),  label: 'Special Visits'       },
                  { Icon: MapPin,         value: destinationsVisited.toString(), label: 'Destinations Visited' },
                  { Icon: DollarSign,     value: formatCurrency(totalSpent),    label: 'Total Spent'          },
                  { Icon: Trophy,         value: favDivision,                   label: 'Fav Division'         },
                  { Icon: Eye,            value: mostSeenTeam,                  label: 'Most Seen'            },
                ].map(({ Icon, value, label }) => (
                  <div key={label} style={{ background: '#161B22', padding: 16 }}>
                    <Icon size={22} color="#1F6FEB" strokeWidth={1.8} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#E6EDF3', lineHeight: 1.1, marginBottom: 4 }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 13, color: '#8B949E' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Division Progress ─────────────────────────────────────────── */}
            <div style={{ ...card, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 600, color: '#E6EDF3', fontSize: 16, marginBottom: '0.875rem' }}>
                Division Progress
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {divProgress.map(({ label, vis, total }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: '#E6EDF3' }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1F6FEB' }}>{vis}/{total}</span>
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

            {/* ── Today's Games ────────────────────────────────────────────── */}
            <FavoriteTeamPicker userId={userId} currentFavAbbr={favAbbr} />
            {todayGames.length > 0 && (
              <TodayGames initialGames={todayGames} favAbbr={favAbbr} />
            )}

            {/* ── Standings ────────────────────────────────────────────────── */}
            <Standings favAbbr={favAbbr} />

          </div>
    </div>
  )
}
