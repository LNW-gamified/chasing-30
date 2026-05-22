import { createClient } from '@/lib/supabase-server'
import MilestoneGrid from '@/components/MilestoneGrid'
import { MILESTONES } from '@/lib/milestones'
import { STATIC_EXPERIENCES } from '@/lib/static-experiences'
import Link from 'next/link'
import { Home, MapPin, Map, Trophy, Plane, Star } from 'lucide-react'
import type { Stadium, StadiumVisit, SpecialEvent, SpecialVisit, SerializableMilestone } from '@/types'
import UpNextPill from '@/components/UpNextPill'
import SpecialVisitButton from '@/components/SpecialVisitButton'

const NAV = [
  { label: 'Home',   href: '/dashboard',     icon: Home  },
  { label: 'Parks',  href: '/stadiums',      icon: MapPin },
  { label: 'Map',    href: '/map',           icon: Map   },
  { label: 'Goals',  href: '/milestones',    icon: Trophy },
  { label: 'Trips',  href: '/trips',         icon: Plane },
  { label: 'Events', href: '/special-events', icon: Star },
]

export const RANK_TIERS = [
  { name: 'Rookie',       minPts: 0,    icon: '🌱' },
  { name: 'Bench Player', minPts: 75,   icon: '⚾' },
  { name: 'Starter',      minPts: 200,  icon: '🏟️' },
  { name: 'All-Star',     minPts: 400,  icon: '⭐' },
  { name: 'MVP',          minPts: 700,  icon: '🏆' },
  { name: 'Legend',       minPts: 1200, icon: '🌟' },
]

export const MILESTONE_POINTS: Record<string, number> = {
  first_game: 25, five_stadiums: 50, ten_stadiums: 75,
  fifteen_stadiums: 100, twenty_stadiums: 125, twentyfive_stadiums: 150, all_stadiums: 300,
  al_east: 50, al_central: 50, al_west: 50, nl_east: 50, nl_central: 50, nl_west: 50,
  american_league: 100, national_league: 100,
  east_coast: 100, midwest: 100, west_coast: 100,
  five_games: 35, ten_games: 50,
  world_series_attendance: 150, all_star_attendance: 100, postseason_attendance: 100,
  spring_training_attendance: 50, minor_league_attendance: 50,
  hall_of_fame_visit: 75, field_of_dreams_visit: 75,
  international_game: 100, historic_ballparks_all: 200,
  first_special_event: 30,
}

function getRank(pts: number) {
  return [...RANK_TIERS].reverse().find(r => pts >= r.minPts) ?? RANK_TIERS[0]
}

function getNextRank(pts: number) {
  return RANK_TIERS.find(r => r.minPts > pts) ?? null
}

function computeInProgress(
  unearnedIds: string[],
  allVisits: StadiumVisit[],
  allStadiums: Stadium[]
): number {
  const visitedCount = new Set(allVisits.map(v => v.stadium_id)).size
  const visitedIds = new Set(allVisits.map(v => v.stadium_id))
  let count = 0
  for (const id of unearnedIds) {
    if (['five_stadiums','ten_stadiums','fifteen_stadiums','twenty_stadiums','twentyfive_stadiums','all_stadiums'].includes(id)) {
      if (visitedCount > 0) { count++; continue }
    } else if (['five_games','ten_games'].includes(id)) {
      if (allVisits.length > 0) { count++; continue }
    } else if (/^(al|nl)_(east|central|west)$/.test(id)) {
      const league = id.startsWith('al') ? 'AL' : 'NL'
      const div = id.includes('east') ? 'East' : id.includes('central') ? 'Central' : 'West'
      const divS = allStadiums.filter(s => s.league === league && s.division === div)
      if (divS.some(s => visitedIds.has(s.id))) { count++; continue }
    } else if (['american_league','national_league','east_coast','midwest','west_coast'].includes(id)) {
      if (visitedCount > 0) { count++; continue }
    }
  }
  return count
}

function toSerializable(ms: typeof MILESTONES): SerializableMilestone[] {
  return ms.map(({ id, name, description, icon }) => ({ id, name, description, icon }))
}

export default async function MilestonesPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: events }, { data: claims }, { data: specialVisits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('special_events').select('*'),
    supabase.from('achievement_claims').select('achievement_id'),
    supabase.from('special_visits').select('*').order('visit_date', { ascending: false }),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allEvents: SpecialEvent[] = events ?? []
  const allSpecialVisits: SpecialVisit[] = (specialVisits ?? []) as SpecialVisit[]

  const earned = MILESTONES.filter(m => m.check(allVisits, allStadiums, allEvents, allSpecialVisits))
  const unearned = MILESTONES.filter(m => !m.check(allVisits, allStadiums, allEvents, allSpecialVisits))
  const totalPoints = earned.reduce((sum, m) => sum + (MILESTONE_POINTS[m.id] ?? 25), 0)
  const currentRank = getRank(totalPoints)
  const nextRank = getNextRank(totalPoints)
  const visitedCount = new Set(allVisits.map(v => v.stadium_id)).size
  const inProgress = computeInProgress(unearned.map(m => m.id), allVisits, allStadiums)

  const claimedIds = new Set((claims ?? []).map(c => c.achievement_id))
  const earnedStaticCount = STATIC_EXPERIENCES.filter(s => claimedIds.has(s.id)).length
  const totalAchievements = MILESTONES.length + STATIC_EXPERIENCES.length
  const totalEarned = earned.length + earnedStaticCount

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>

      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col" style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
        backgroundColor: '#161B22', borderRight: '1px solid #30363D', zIndex: 40,
      }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#E6EDF3', letterSpacing: '-0.5px' }}>
            ⚾ Chasing 30
          </div>
        </div>
        <nav style={{ flex: 1, padding: '4px 12px' }}>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === '/milestones'
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                color: active ? '#E6EDF3' : '#8B949E',
                backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                fontWeight: active ? 700 : 500, fontSize: 15, textDecoration: 'none',
              }}>
                <Icon size={20} color={active ? '#1F6FEB' : '#8B949E'} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #30363D' }}>
          <UpNextPill />
          <div style={{ fontSize: 12, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 8 }}>Progress</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#E6EDF3' }}>
            {visitedCount}<span style={{ fontWeight: 400, fontSize: 14, color: '#8B949E' }}> / 30</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="md:ml-[240px]" style={{ minHeight: '100vh', paddingBottom: 80 }}>

        {/* ── Gamified Hero ─────────────────────────────────────── */}
        <div style={{ backgroundColor: '#0D1117', borderBottom: '1px solid #30363D', padding: '32px 16px 28px', overflow: 'hidden', position: 'relative' }}>
          {/* Background radial glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', position: 'relative' }}>

            {/* Animated rank badge */}
            <div className="rank-badge-glow" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 100, height: 112, marginBottom: 12 }}>
              <svg width={100} height={112} viewBox="0 0 100 112" fill="none" style={{ position: 'absolute', inset: 0 }}>
                <path d="M50 6L10 22V54C10 78 28 98 50 106C72 98 90 78 90 54V22L50 6Z"
                  fill="url(#rankGrad)" stroke="#F5A623" strokeWidth={2} strokeLinejoin="round" />
                <defs>
                  <linearGradient id="rankGrad" x1="50" y1="6" x2="50" y2="106" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgba(245,166,35,0.25)" />
                    <stop offset="1" stopColor="rgba(245,100,10,0.1)" />
                  </linearGradient>
                </defs>
              </svg>
              <span style={{ position: 'relative', zIndex: 1, fontSize: 42, lineHeight: 1 }}>{currentRank.icon}</span>
            </div>

            {/* Rank name */}
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: '#F5A623', textTransform: 'uppercase', marginBottom: 6 }}>
              Current Rank
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#E6EDF3', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              {currentRank.name}
            </h1>
            <div style={{ fontSize: 15, color: '#8B949E', marginBottom: 24 }}>
              {totalPoints.toLocaleString()} XP
            </div>

            {/* XP Progress bar */}
            {nextRank ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F5A623' }}>{currentRank.icon} {currentRank.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#8B949E' }}>{nextRank.icon} {nextRank.name}</span>
                </div>
                <div style={{ position: 'relative', height: 12, background: '#1C2430', borderRadius: 8, overflow: 'hidden', border: '1px solid #30363D' }}>
                  <div style={{
                    position: 'absolute', inset: '0 auto 0 0',
                    width: `${Math.min(100, Math.round((totalPoints - currentRank.minPts) / (nextRank.minPts - currentRank.minPts) * 100))}%`,
                    background: 'linear-gradient(90deg, #F5A623, #E8820C)',
                    borderRadius: 8, transition: 'width 0.6s ease',
                    minWidth: totalPoints > currentRank.minPts ? 12 : 0,
                  }} />
                  <div className="xp-bar-shine" />
                </div>
                <div style={{ fontSize: 12, color: '#8B949E', marginTop: 6 }}>
                  <strong style={{ color: '#E6EDF3' }}>{nextRank.minPts - totalPoints}</strong> XP to {nextRank.name}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <div style={{ position: 'relative', height: 12, background: 'linear-gradient(90deg, #F5A623, #E8820C)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(245,166,35,0.3)' }}>
                  <div className="xp-bar-shine" />
                </div>
                <div style={{ fontSize: 12, color: '#3FB950', marginTop: 6, fontWeight: 700 }}>🏆 Max Rank Achieved</div>
              </div>
            )}

            {/* Stat pills */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 20px', borderRadius: 14, background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.25)', minWidth: 80 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#3FB950', lineHeight: 1 }}>{totalEarned}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3FB950', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Earned</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 20px', borderRadius: 14, background: 'rgba(31,111,235,0.1)', border: '1px solid rgba(31,111,235,0.25)', minWidth: 80 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#58A6FF', lineHeight: 1 }}>{inProgress}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#58A6FF', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>In Progress</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 20px', borderRadius: 14, background: 'rgba(139,148,158,0.08)', border: '1px solid #30363D', minWidth: 80 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{totalAchievements}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</span>
              </div>
            </div>

          </div>
        </div>

        {/* MilestoneGrid (client, handles everything interactive) */}
        <MilestoneGrid
          earned={toSerializable(earned)}
          unearned={toSerializable(unearned)}
          allVisits={allVisits}
          allStadiums={allStadiums}
          allEvents={allEvents}
          currentRankName={currentRank.name}
          rankTiers={RANK_TIERS}
        />

        {/* ── Special Visits section ────────────────────────────────── */}
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 40px' }}>
          <div style={{ borderTop: '1px solid #30363D', paddingTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3' }}>📋 Special Visits</div>
                <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>
                  {(specialVisits ?? []).length > 0
                    ? `${(specialVisits ?? []).length} logged`
                    : 'Minor league, spring training, tours & more'}
                </div>
              </div>
              <SpecialVisitButton label="Log Visit" variant="primary" />
            </div>

            {(specialVisits ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(specialVisits ?? []).slice(0, 5).map((sv: any) => {
                  const TYPE_EMOJI: Record<string, string> = {
                    minor_league: '⚾', spring_training: '🌞', international: '🌍',
                    all_star: '🏆', world_series: '🎯', playoff: '🥇',
                    stadium_tour: '🏭', college: '🎓', independent: '🏟️', other: '📺',
                  }
                  const emoji = TYPE_EMOJI[sv.visit_type] ?? '📋'
                  const label = sv.visit_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                  const dt = new Date(sv.visit_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  return (
                    <div key={sv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, backgroundColor: '#161B22', border: '1px solid #30363D' }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sv.venue}</div>
                        <div style={{ fontSize: 12, color: '#8B949E' }}>{label} · {dt}</div>
                      </div>
                    </div>
                  )
                })}
                {(specialVisits ?? []).length > 5 && (
                  <div style={{ textAlign: 'center', fontSize: 13, color: '#8B949E', paddingTop: 4 }}>
                    +{(specialVisits ?? []).length - 5} more
                  </div>
                )}
              </div>
            )}

            {(specialVisits ?? []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#484F58', fontSize: 13 }}>
                No special visits yet. Tap Log Visit to add your first!
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Mobile top header ────────────────────────────────────── */}
      <div className="flex md:hidden items-center justify-between" style={{
        position: 'sticky', top: 0, zIndex: 30,
        backgroundColor: 'rgba(11,17,23,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #30363D', padding: '8px 16px',
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>🏆 Goals</span>
        <UpNextPill compact />
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────── */}
      <div className="flex md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        backgroundColor: '#161B22', borderTop: '1px solid #30363D',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = href === '/milestones'
          return (
            <Link key={href} href={href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', textDecoration: 'none', padding: '10px 0', minHeight: 56,
              color: active ? '#1F6FEB' : '#8B949E', gap: 3,
            }}>
              <Icon size={22} color={active ? '#1F6FEB' : '#8B949E'} />
              {active && <span style={{ fontSize: 11, fontWeight: 700, color: '#1F6FEB' }}>{label}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
