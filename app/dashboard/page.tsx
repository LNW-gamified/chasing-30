import { createClient } from '@/lib/supabase-server'
import { MILESTONES } from '@/lib/milestones'
import type { Stadium, StadiumVisit, SpecialEvent } from '@/types'
import Link from 'next/link'
import { Home, Map, MapPin, Trophy, Plane, Bell, ChevronRight } from 'lucide-react'
import TodayGames, { type TodayGame } from '@/components/TodayGames'

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
    const today = new Date().toISOString().split('T')[0]
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
    // Favorite team's game first
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
  if (id === 'five_stadiums')    return { emoji: '🚗', bg: 'rgba(249,115,22,0.13)'  }
  if (id === 'ten_stadiums')     return { emoji: '🔟', bg: 'rgba(59,130,246,0.13)'  }
  if (id === 'fifteen_stadiums') return { emoji: '🏟️', bg: 'rgba(34,197,94,0.13)'  }
  return                                { emoji: '⚡', bg: 'rgba(139,92,246,0.13)'  }
}

// ─── User helpers ─────────────────────────────────────────────────────────────

function getFirstName(user: any): string {
  const full = user?.user_metadata?.full_name ?? user?.user_metadata?.name
  if (full) return (full as string).split(' ')[0]
  const local = (user?.email ?? '').split('@')[0] as string
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Progress ring (SVG, no hooks — server component safe) ────────────────────

function LightRing({ visited, total }: { visited: number; total: number }) {
  const size = 120
  const sw   = 8
  const r    = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const pct  = total > 0 ? visited / total : 0
  const offset = circ - Math.max(pct, visited > 0 ? 0.04 : 0) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#E5E7EB" strokeWidth={sw}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#22C55E" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: 'drop-shadow(0 0 5px rgba(34,197,94,0.4))' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 1,
      }}>
        <span style={{ fontSize: 48, fontWeight: 800, color: '#111111', lineHeight: 1 }}>
          {visited}
        </span>
        <span style={{ fontSize: 16, color: '#888888', fontWeight: 500, lineHeight: 1 }}>
          /30
        </span>
      </div>
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Home',  href: '/dashboard',  icon: Home,   active: true  },
  { label: 'Parks', href: '/stadiums',   icon: MapPin,  active: false },
  { label: 'Map',   href: '/map',        icon: Map,     active: false },
  { label: 'Goals', href: '/milestones', icon: Trophy,  active: false },
  { label: 'Trips', href: '/trips',      icon: Plane,   active: false },
]

// ─── Section label style ──────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#888888',
  textTransform: 'uppercase', letterSpacing: '0.1em',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: stadiums },
    { data: visits },
    { data: events },
    { data: { user } },
  ] = await Promise.all([
    supabase.from('stadiums').select('*').order('league').order('division').order('name'),
    supabase.from('stadium_visits').select('*').order('visit_date', { ascending: false }),
    supabase.from('special_events').select('*'),
    supabase.auth.getUser(),
  ])

  const allStadiums: Stadium[]    = stadiums ?? []
  const allVisits:   StadiumVisit[] = visits ?? []
  const allEvents:   SpecialEvent[] = events ?? []

  const visitedIds    = new Set(allVisits.map(v => v.stadium_id))
  const visitedCount  = visitedIds.size

  const earnedMilestones = MILESTONES.filter(m => m.check(allVisits, allStadiums, allEvents))
  const nextQuests       = MILESTONES.filter(m => !m.check(allVisits, allStadiums, allEvents)).slice(0, 3)

  const points  = computePoints(visitedCount, allVisits.length, earnedMilestones.length)
  const rank    = getRank(points)
  const name    = getFirstName(user)
  const greeting = getGreeting()

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

  // Favorite team = most-visited stadium's abbreviation
  const stadiumCounts: Record<string, number> = {}
  for (const v of allVisits) stadiumCounts[v.stadium_id] = (stadiumCounts[v.stadium_id] ?? 0) + 1
  const topId   = Object.entries(stadiumCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const favAbbr = allStadiums.find(s => s.id === topId)?.abbreviation ?? null

  const todayGames = await fetchTodayGames(favAbbr)

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 16,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  }

  return (
    <div style={{ background: '#F8F8F8', color: '#111111', minHeight: '100vh' }}>
      <div style={{ display: 'flex' }}>

        {/* ── Desktop sidebar ──────────────────────────────────────────── */}
        <aside
          className="hidden md:flex flex-col"
          style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, zIndex: 30,
            background: '#FFFFFF', borderRight: '1px solid #EEEEEE', overflowY: 'auto',
          }}
        >
          <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid #EEEEEE' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111111' }}>⚾ Chasing 30</div>
            <div style={{ fontSize: '0.75rem', color: '#888888', marginTop: 2 }}>MLB Stadium Tracker</div>
          </div>
          <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
            {NAV.map(({ label, href, icon: Icon, active }) => (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 0.875rem', borderRadius: 12, marginBottom: 4,
                backgroundColor: active ? 'rgba(59,130,246,0.09)' : 'transparent',
                color: active ? '#3B82F6' : '#888888',
                fontWeight: active ? 700 : 500,
                fontSize: '0.9rem', textDecoration: 'none',
                borderLeft: active ? '3px solid #3B82F6' : '3px solid transparent',
              }}>
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #EEEEEE' }}>
            <div style={{ ...sectionLabel, marginBottom: 4 }}>Overall</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#111111', lineHeight: 1 }}>
              {visitedCount}
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#888888' }}> / 30</span>
            </div>
            <div style={{ marginTop: 8, height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(visitedCount / 30) * 100}%`, height: '100%', background: '#22C55E', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888888', marginTop: 4 }}>
              {Math.round((visitedCount / 30) * 100)}% complete
            </div>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────── */}
        <main className="flex-1 md:pl-60" style={{ paddingBottom: '5.5rem' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem 1rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#111111', lineHeight: 1.15, margin: 0 }}>
                  {greeting},<br />{name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: '0.8rem', background: '#F0F0F0', color: '#555555', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                    🏟️ {rank} · {points} pts
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <button
                  style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF', border: '1px solid #EEEEEE', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  aria-label="Notifications"
                >
                  <Bell size={17} style={{ color: '#888888' }} />
                </button>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                  {name.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Mission card */}
            <div style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                    YOUR MISSION
                  </div>
                  <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.3 }}>
                    Chasing 30 · {visitedCount} of 30 stadiums
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', marginTop: 4 }}>
                    {visitedCount === 30 ? 'Legend status achieved!' : `${30 - visitedCount} park${30 - visitedCount !== 1 ? 's' : ''} remaining`}
                  </div>
                </div>
                <Link href="/stadiums" style={{
                  background: 'rgba(255,255,255,0.2)', color: '#FFFFFF',
                  padding: '8px 18px', borderRadius: 999, fontWeight: 700,
                  fontSize: '0.875rem', textDecoration: 'none', flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.3)',
                  backdropFilter: 'blur(4px)',
                }}>
                  Plan →
                </Link>
              </div>
            </div>

            {/* Progress + Division grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: '1.5rem' }}>

              {/* My Stadiums card */}
              <div style={{ ...card, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1rem' }}>🏟️</span>
                  <span style={{ fontWeight: 700, color: '#111111', fontSize: '0.9rem' }}>My Stadiums</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <LightRing visited={visitedCount} total={30} />
                  <div>
                    <div style={{ color: '#888888', fontSize: '0.78rem', marginBottom: 6 }}>stadiums visited</div>
                    <div style={{ color: '#22C55E', fontSize: '0.82rem', fontWeight: 700 }}>
                      {Math.round((visitedCount / 30) * 100)}% complete
                    </div>
                    <Link href="/milestones" style={{ color: '#3B82F6', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', marginTop: 6, display: 'block' }}>
                      {earnedMilestones.length} milestone{earnedMilestones.length !== 1 ? 's' : ''} earned →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Division Progress card */}
              <div style={{ ...card, padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#111111', fontSize: '0.9rem', marginBottom: '0.875rem' }}>
                  Division Progress
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {divProgress.map(({ label, vis, total }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.78rem', color: '#555555' }}>{label}</span>
                        <span style={{ fontSize: '0.78rem', color: '#888888', fontWeight: 600 }}>
                          {vis}/{total}
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${(vis / total) * 100}%`, height: '100%',
                          background: '#3B82F6', borderRadius: 4,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Today's Games — client component handles polling + sorting */}
            {todayGames.length > 0 && (
              <TodayGames initialGames={todayGames} favAbbr={favAbbr} />
            )}

            {/* Your Quests */}
            {nextQuests.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={sectionLabel}>Your Quests</span>
                  <Link href="/milestones" style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }}>
                    See All
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nextQuests.map(m => {
                    const { emoji, bg } = questStyle(m.id)
                    return (
                      <Link key={m.id} href="/milestones" style={{ textDecoration: 'none' }}>
                        <div style={{
                          ...card, borderRadius: 12,
                          padding: '0.875rem 1rem',
                          display: 'flex', alignItems: 'center', gap: '0.875rem',
                          cursor: 'pointer',
                        }}>
                          {/* Quest icon: 44px square with colored background */}
                          <div style={{
                            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                            backgroundColor: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22,
                          }}>
                            {emoji}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#111111', fontSize: '0.88rem', marginBottom: 2 }}>
                              {m.name}
                            </div>
                            <div style={{ color: '#888888', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.description}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{
                              background: 'rgba(34,197,94,0.1)', color: '#16A34A',
                              fontSize: '0.72rem', fontWeight: 800,
                              padding: '3px 9px', borderRadius: 999,
                            }}>
                              +{getMilestonePoints(m.id)}
                            </span>
                            <ChevronRight size={14} style={{ color: '#CCCCCC' }} />
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

      {/* ── Mobile bottom tab bar ─────────────────────────────────────── */}
      <nav
        className="md:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: '#FFFFFF', borderTop: '1px solid #EEEEEE',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0.6rem 0 0.5rem' }}>
          {NAV.map(({ label, href, icon: Icon, active }) => (
            <Link key={href} href={href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 44, textDecoration: 'none' }}>
              <Icon size={22} style={{ color: active ? '#3B82F6' : '#CCCCCC' }} />
              {active && <span style={{ fontSize: '0.58rem', color: '#3B82F6', fontWeight: 700, lineHeight: 1 }}>{label}</span>}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
