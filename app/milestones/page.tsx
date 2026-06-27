import { createClient } from '@/lib/supabase-server'
import MilestoneGrid from '@/components/MilestoneGrid'
import { MILESTONES } from '@/lib/milestones'
import { STATIC_EXPERIENCES } from '@/lib/static-experiences'
import type { Stadium, StadiumVisit, SpecialEvent, BaseballLifeEntry, DestinationVisit, SerializableMilestone } from '@/types'
import SpecialVisitButton from '@/components/SpecialVisitButton'
import { RankBadge } from '@/components/RankBadge'
import { Trophy } from 'lucide-react'

export const RANK_TIERS = [
  { name: 'Sandlot Kid',       minPts: 0,    icon: '⚾', description: 'Where every legend begins' },
  { name: 'Minor Leaguer',     minPts: 75,   icon: '🚌', description: 'Working your way up' },
  { name: 'September Call-Up', minPts: 200,  icon: '📈', description: 'The bigs are calling' },
  { name: 'Rotation Ace',      minPts: 400,  icon: '🔥', description: "You're the real deal" },
  { name: 'All-Star',          minPts: 700,  icon: '⭐', description: 'The fans voted you in' },
  { name: 'Hall of Famer',     minPts: 1200, icon: '🏆', description: 'Your plaque is waiting' },
]

export const MILESTONE_POINTS: Record<string, number> = {
  // Ladder milestone points are computed per-tier in totalPoints below
  al_east: 50, al_central: 50, al_west: 50, nl_east: 50, nl_central: 50, nl_west: 50,
  american_league: 100, national_league: 100,
  world_series_attendance: 150, all_star_attendance: 100, postseason_attendance: 100,
  spring_training_attendance: 50,
  hall_of_fame_visit: 75, field_of_dreams_visit: 75,
  louisville_slugger_visit: 50, rawlings_factory_visit: 50,
  negro_leagues_visit: 75, doubleday_visit: 50,
  international_game: 100, historic_ballparks_all: 200,
  full_experience: 100,
  walk_off_witness: 75, double_walk_off: 125,
  no_hit_wonder: 150, perfect_day: 300, committee_work: 100,
  extra_credit: 50, marathon_man: 75,
  lights_out: 50, grand_slam_witness: 75,
  full_cycle: 150, history_maker: 200,
  run_factory: 50, pitchers_duel: 75,
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
  const visitedIds = new Set(allVisits.map(v => v.stadium_id))
  let count = 0
  for (const id of unearnedIds) {
    if (/^(al|nl)_(east|central|west)$/.test(id)) {
      const league = id.startsWith('al') ? 'AL' : 'NL'
      const div = id.includes('east') ? 'East' : id.includes('central') ? 'Central' : 'West'
      const divS = allStadiums.filter(s => s.league === league && s.division === div)
      if (divS.some(s => visitedIds.has(s.id))) { count++; continue }
    } else if (['american_league', 'national_league'].includes(id)) {
      if (visitedIds.size > 0) { count++; continue }
    }
  }
  return count
}

function computeEarnDate(
  m: typeof MILESTONES[number],
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[],
  allBle: BaseballLifeEntry[],
  allDestVisits: DestinationVisit[]
): string | null {
  const sorted = [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))
  for (let i = 0; i < sorted.length; i++) {
    if (m.check(sorted.slice(0, i + 1), allStadiums, allEvents, allBle, allDestVisits)) {
      return sorted[i].visit_date
    }
  }
  const eventDate = [...allEvents].sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))[0]?.event_date
  const bleDate = [...allBle].sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0]?.visit_date
  const dvDate = [...allDestVisits].sort((a, b) => (a.visit_date ?? '').localeCompare(b.visit_date ?? ''))[0]?.visit_date
  const fallback = [eventDate, bleDate, dvDate].filter(Boolean).sort()[0]
  return fallback ?? null
}

function toSerializable(
  ms: typeof MILESTONES,
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[],
  allBle: BaseballLifeEntry[],
  allDestVisits: DestinationVisit[]
): SerializableMilestone[] {
  return ms.map((m) => ({
    id: m.id, name: m.name, description: m.description, icon: m.icon,
    earnDate: m.tiers ? null : computeEarnDate(m, allVisits, allStadiums, allEvents, allBle, allDestVisits),
    tiers: m.tiers,
    currentValue: m.getValue ? m.getValue(allVisits, allStadiums, allEvents, allBle, allDestVisits) : undefined,
  }))
}

export default async function MilestonesPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: events }, { data: claims }, { data: bleRows }, { data: destVisits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('special_events').select('*'),
    supabase.from('achievement_claims').select('achievement_id'),
    supabase.from('baseball_life_entries').select('*').order('visit_date', { ascending: false }),
    supabase.from('destination_visits').select('*, destination:destinations(*)').order('visit_date', { ascending: false }),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allEvents: SpecialEvent[] = events ?? []
  const allBle: BaseballLifeEntry[] = (bleRows ?? []) as BaseballLifeEntry[]
  const allDestVisits: DestinationVisit[] = (destVisits ?? []) as DestinationVisit[]

  const ladderMilestones  = MILESTONES.filter(m => m.tiers != null)
  const regularMilestones = MILESTONES.filter(m => m.tiers == null)

  const earned   = regularMilestones.filter(m =>  m.check(allVisits, allStadiums, allEvents, allBle, allDestVisits))
  const unearned = regularMilestones.filter(m => !m.check(allVisits, allStadiums, allEvents, allBle, allDestVisits))

  const ladderPoints = ladderMilestones.reduce((sum, m) => {
    const val = m.getValue ? m.getValue(allVisits, allStadiums, allEvents, allBle, allDestVisits) : 0
    return sum + (m.tiers ?? []).filter(t => t.threshold <= val).reduce((s, t) => s + t.points, 0)
  }, 0)
  const totalPoints = earned.reduce((sum, m) => sum + (MILESTONE_POINTS[m.id] ?? 25), 0) + ladderPoints

  const currentRank = getRank(totalPoints)
  const nextRank = getNextRank(totalPoints)
  const visitedCount = new Set(allVisits.map(v => v.stadium_id)).size
  const inProgress = computeInProgress(unearned.map(m => m.id), allVisits, allStadiums)

  const claimedIds = new Set((claims ?? []).map(c => c.achievement_id))
  const earnedStaticCount = STATIC_EXPERIENCES.filter(s => claimedIds.has(s.id)).length

  const earnedLadderCount = ladderMilestones.filter(m =>
    m.getValue ? m.getValue(allVisits, allStadiums, allEvents, allBle, allDestVisits) >= (m.tiers?.[0]?.threshold ?? 1) : false
  ).length

  const totalAchievements = MILESTONES.length + STATIC_EXPERIENCES.length
  const totalEarned = earned.length + earnedStaticCount + earnedLadderCount

  return (
    <div>
      <main style={{ minHeight: '100vh' }}>

        {/* ── Gamified Hero ─────────────────────────────────────── */}
        <div style={{ backgroundColor: '#0D1117', borderBottom: '1px solid #30363D', padding: '32px 16px 28px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, maxWidth: 560, margin: '0 auto 8px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.15em' }}>The Record Books</span>
            <SpecialVisitButton label="+ Log Entry" variant="secondary" />
          </div>
          {/* Background radial glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', position: 'relative' }}>

            {/* Animated rank badge */}
            <div className="rank-badge-glow" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <RankBadge rankName={currentRank.name} size={140} />
            </div>

            {/* Rank name + description */}
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: '#F5A623', textTransform: 'uppercase', marginBottom: 6 }}>
              Current Rank
            </div>
            <h1 style={{ fontSize: 48, fontWeight: 900, color: '#E6EDF3', margin: '0 0 4px', letterSpacing: '-1px', fontFamily: "'Oswald', sans-serif" }}>
              {currentRank.name}
            </h1>
            <div style={{ fontSize: 14, color: '#8B949E', fontStyle: 'italic', marginBottom: 6 }}>
              {nextRank ? `${nextRank.minPts - totalPoints} XP from ${nextRank.name}` : 'The all-time greats. Welcome.'}
            </div>
            {/* XP Progress bar */}
            {nextRank ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F5A623' }}>{currentRank.icon} {currentRank.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#8B949E' }}>{nextRank.icon} {nextRank.name}</span>
                </div>
                <div style={{ position: 'relative', height: 18, background: '#1C2430', borderRadius: 10, overflow: 'hidden', border: '1px solid #30363D' }}>
                  <div style={{
                    position: 'absolute', inset: '0 auto 0 0',
                    width: `${Math.min(100, Math.round((totalPoints - currentRank.minPts) / (nextRank.minPts - currentRank.minPts) * 100))}%`,
                    background: 'linear-gradient(90deg, #F5A623, #E8820C)',
                    borderRadius: 10, transition: 'width 0.6s ease',
                    minWidth: totalPoints > currentRank.minPts ? 12 : 0,
                  }} />
                  <div className="xp-bar-shine" />
                </div>
                <div style={{ fontSize: 13, color: '#8B949E', marginTop: 6, fontFamily: "'Inter', sans-serif" }}>
                  <strong style={{ color: '#E6EDF3' }}>{totalPoints.toLocaleString()} XP</strong> · {nextRank.minPts - totalPoints} more to reach {nextRank.name}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <div style={{ position: 'relative', height: 18, background: 'linear-gradient(90deg, #F5A623, #E8820C)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(245,166,35,0.3)' }}>
                  <div className="xp-bar-shine" />
                </div>
                <div style={{ fontSize: 12, color: '#3FB950', marginTop: 6, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Trophy size={13} /> Max Rank Achieved
                </div>
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
          earned={toSerializable(earned, allVisits, allStadiums, allEvents, allBle, allDestVisits)}
          unearned={toSerializable(unearned, allVisits, allStadiums, allEvents, allBle, allDestVisits)}
          ladders={toSerializable(ladderMilestones, allVisits, allStadiums, allEvents, allBle, allDestVisits)}
          allVisits={allVisits}
          allStadiums={allStadiums}
          allEvents={allEvents}
          allBle={allBle}
          currentRankName={currentRank.name}
          rankTiers={RANK_TIERS}
        />

      </main>
    </div>
  )
}
