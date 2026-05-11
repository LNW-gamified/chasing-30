import { createClient } from '@/lib/supabase-server'
import MilestoneGrid from '@/components/MilestoneGrid'
import { MILESTONES } from '@/lib/milestones'
import Link from 'next/link'
import { Home, MapPin, Map, Trophy, Plane } from 'lucide-react'
import type { Stadium, StadiumVisit, SpecialEvent, SerializableMilestone } from '@/types'

const NAV = [
  { label: 'Home',  href: '/dashboard',  icon: Home },
  { label: 'Parks', href: '/stadiums',   icon: MapPin },
  { label: 'Map',   href: '/map',        icon: Map },
  { label: 'Goals', href: '/milestones', icon: Trophy },
  { label: 'Trips', href: '/trips',      icon: Plane },
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

  const [{ data: stadiums }, { data: visits }, { data: events }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('special_events').select('*'),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allEvents: SpecialEvent[] = events ?? []

  const earned = MILESTONES.filter(m => m.check(allVisits, allStadiums, allEvents))
  const unearned = MILESTONES.filter(m => !m.check(allVisits, allStadiums, allEvents))
  const totalPoints = earned.reduce((sum, m) => sum + (MILESTONE_POINTS[m.id] ?? 25), 0)
  const currentRank = getRank(totalPoints)
  const nextRank = getNextRank(totalPoints)
  const visitedCount = new Set(allVisits.map(v => v.stadium_id)).size
  const inProgress = computeInProgress(unearned.map(m => m.id), allVisits, allStadiums)

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
        <div style={{ padding: '16px 20px', borderTop: '1px solid #30363D' }}>
          <div style={{ fontSize: 12, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Progress</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#E6EDF3' }}>
            {visitedCount}<span style={{ fontWeight: 400, fontSize: 14, color: '#8B949E' }}> / 30</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="md:ml-[240px]" style={{ minHeight: '100vh', paddingBottom: 80 }}>

        {/* Hero */}
        <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D', padding: '36px 16px 0' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>

            {/* Shield icon */}
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 80, height: 90, marginBottom: 8 }}>
              <svg width={80} height={90} viewBox="0 0 80 90" fill="none" style={{ position: 'absolute', inset: 0 }}>
                <path d="M40 6L9 20V44C9 62 23 78 40 84C57 78 71 62 71 44V20L40 6Z"
                  fill="rgba(245,166,35,0.15)" stroke="#F5A623" strokeWidth={2.5} strokeLinejoin="round" />
              </svg>
              <span style={{ position: 'relative', zIndex: 1, fontSize: 34 }}>{currentRank.icon}</span>
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#E6EDF3', margin: '0 0 6px' }}>
              {currentRank.name}
            </h1>
            <div style={{ fontSize: 15, color: '#8B949E', marginBottom: 24 }}>
              {totalPoints.toLocaleString()} points
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              {[
                { label: 'Earned', value: earned.length },
                { label: 'In Progress', value: inProgress },
                { label: 'Total', value: MILESTONES.length },
              ].map(({ label, value }, i, arr) => (
                <div key={label} style={{
                  flex: 1, maxWidth: 110, textAlign: 'center',
                  borderRight: i < arr.length - 1 ? '1px solid #30363D' : 'none',
                  padding: '0 12px',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#E6EDF3', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Next rank hint */}
            {nextRank && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                backgroundColor: 'rgba(139,148,158,0.08)', padding: '7px 16px',
                borderRadius: 20, fontSize: 13, color: '#8B949E',
                marginBottom: 28,
              }}>
                Next:&nbsp;<strong style={{ color: '#E6EDF3' }}>{nextRank.name}</strong>
                <span style={{ color: '#30363D', margin: '0 2px' }}>·</span>
                {nextRank.minPts - totalPoints} pts away
              </div>
            )}
            {!nextRank && <div style={{ marginBottom: 28 }} />}
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
      </main>

      {/* ── Mobile bottom tab bar ────────────────────────────────── */}
      <div className="md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        backgroundColor: '#161B22', borderTop: '1px solid #30363D',
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
