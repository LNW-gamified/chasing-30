import { createClient } from '@/lib/supabase-server'
import MilestoneGrid from '@/components/MilestoneGrid'
import { MILESTONES } from '@/lib/milestones'
import { STATIC_EXPERIENCES } from '@/lib/static-experiences'
import Link from 'next/link'
import type { Stadium, StadiumVisit, SpecialEvent, SpecialVisit, DestinationVisit, SerializableMilestone } from '@/types'
import SpecialVisitButton from '@/components/SpecialVisitButton'
import { DESTINATIONS, DESTINATION_GROUPS, destinationLocation } from '@/lib/destinations'
import { RankBadge } from '@/components/RankBadge'
import { Map, ClipboardList, Trophy } from 'lucide-react'

export const RANK_TIERS = [
  { name: 'Sandlot Kid',       minPts: 0,    icon: '⚾', description: 'Where every legend begins' },
  { name: 'Minor Leaguer',     minPts: 75,   icon: '🚌', description: 'Working your way up' },
  { name: 'September Call-Up', minPts: 200,  icon: '📈', description: 'The bigs are calling' },
  { name: 'Rotation Ace',      minPts: 400,  icon: '🔥', description: "You're the real deal" },
  { name: 'All-Star',          minPts: 700,  icon: '⭐', description: 'The fans voted you in' },
  { name: 'Hall of Famer',     minPts: 1200, icon: '🏆', description: 'Your plaque is waiting' },
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
  factory_tour: 50, full_experience: 100,
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

function computeEarnDate(
  m: typeof MILESTONES[number],
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[],
  allSpecialVisits: SpecialVisit[],
  allDestVisits: DestinationVisit[]
): string | null {
  const sorted = [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))
  for (let i = 0; i < sorted.length; i++) {
    if (m.check(sorted.slice(0, i + 1), allStadiums, allEvents, allSpecialVisits, allDestVisits)) {
      return sorted[i].visit_date
    }
  }
  // Fallback for event/special-visit-based milestones
  const eventDate = [...allEvents].sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))[0]?.event_date
  const svDate = [...allSpecialVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0]?.visit_date
  const dvDate = [...allDestVisits].sort((a, b) => (a.visit_date ?? '').localeCompare(b.visit_date ?? ''))[0]?.visit_date
  const fallback = [eventDate, svDate, dvDate].filter(Boolean).sort()[0]
  return fallback ?? null
}

function toSerializable(
  ms: typeof MILESTONES,
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[],
  allSpecialVisits: SpecialVisit[],
  allDestVisits: DestinationVisit[]
): SerializableMilestone[] {
  return ms.map(({ id, name, description, icon, check }) => ({
    id, name, description, icon,
    earnDate: computeEarnDate({ id, name, description, icon, check }, allVisits, allStadiums, allEvents, allSpecialVisits, allDestVisits),
  }))
}

export default async function MilestonesPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }, { data: events }, { data: claims }, { data: specialVisits }, { data: destVisits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
    supabase.from('special_events').select('*'),
    supabase.from('achievement_claims').select('achievement_id'),
    supabase.from('special_visits').select('*').order('visit_date', { ascending: false }),
    supabase.from('destination_visits').select('*, destination:destinations(*)').order('visit_date', { ascending: false }),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []
  const allEvents: SpecialEvent[] = events ?? []
  const allSpecialVisits: SpecialVisit[] = (specialVisits ?? []) as SpecialVisit[]
  const allDestVisits: DestinationVisit[] = (destVisits ?? []) as DestinationVisit[]

  const earned   = MILESTONES.filter(m =>  m.check(allVisits, allStadiums, allEvents, allSpecialVisits, allDestVisits))
  const unearned = MILESTONES.filter(m => !m.check(allVisits, allStadiums, allEvents, allSpecialVisits, allDestVisits))
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
    <div>
      <main style={{ minHeight: '100vh' }}>

        {/* ── Gamified Hero ─────────────────────────────────────── */}
        <div style={{ backgroundColor: '#0D1117', borderBottom: '1px solid #30363D', padding: '32px 16px 28px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.15em' }}>The Record Books</span>
          </div>
          {/* Background radial glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', position: 'relative' }}>

            {/* Animated rank badge */}
            <div className="rank-badge-glow" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <RankBadge rankName={currentRank.name} size={100} />
            </div>

            {/* Rank name + description */}
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: '#F5A623', textTransform: 'uppercase', marginBottom: 6 }}>
              Current Rank
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#E6EDF3', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              {currentRank.name}
            </h1>
            <div style={{ fontSize: 14, color: '#8B949E', fontStyle: 'italic', marginBottom: 6 }}>
              {currentRank.description}
            </div>
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
          earned={toSerializable(earned, allVisits, allStadiums, allEvents, allSpecialVisits, allDestVisits)}
          unearned={toSerializable(unearned, allVisits, allStadiums, allEvents, allSpecialVisits, allDestVisits)}
          allVisits={allVisits}
          allStadiums={allStadiums}
          allEvents={allEvents}
          currentRankName={currentRank.name}
          rankTiers={RANK_TIERS}
        />

        {/* ── Baseball Destinations section ─────────────────────────── */}
        {(() => {
          const visitedSlugs = new Set(allDestVisits.map((dv: any) => dv.destination?.slug).filter(Boolean))
          const visitedCount = visitedSlugs.size
          return (
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 0' }}>
              <div style={{ borderTop: '1px solid #30363D', paddingTop: 28, marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Map size={18} color="#8B949E" /> Baseball Destinations
                    </div>
                    <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>
                      {visitedCount}/{DESTINATIONS.length} visited
                    </div>
                  </div>
                  <Link href="/trips" style={{
                    padding: '8px 16px', borderRadius: 20, border: 'none',
                    backgroundColor: '#1F6FEB', color: '#fff',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}>
                    Plan Trip
                  </Link>
                </div>

                {DESTINATION_GROUPS.map(group => {
                  const groupDests = DESTINATIONS.filter(d => group.types.includes(d.type))
                  const groupVisited = groupDests.filter(d => visitedSlugs.has(d.slug)).length
                  return (
                    <div key={group.label} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {group.icon} {group.label}
                        <span style={{ fontSize: 12, color: '#484F58' }}>({groupVisited}/{groupDests.length})</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {groupDests.map(d => {
                          const isVisited = visitedSlugs.has(d.slug)
                          return (
                            <div key={d.slug} style={{
                              background: `linear-gradient(135deg, ${d.heroColor[0]}, ${d.heroColor[1]})`,
                              borderRadius: 12, padding: '12px 14px',
                              border: isVisited ? '1.5px solid #F5A623' : '1px solid #30363D',
                              position: 'relative', overflow: 'hidden',
                              opacity: isVisited ? 1 : 0.6,
                            }}>
                              {isVisited && (
                                <div style={{
                                  position: 'absolute', top: 8, right: 8,
                                  width: 20, height: 20, borderRadius: '50%',
                                  background: '#F5A623', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 900,
                                }}>✓</div>
                              )}
                              <div style={{ fontSize: 24, marginBottom: 6 }}>{d.icon}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3 }}>{d.name}</div>
                              <div style={{ fontSize: 10, color: '#8B949E', marginTop: 2 }}>{destinationLocation(d)}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Special Visits section ────────────────────────────────── */}
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 40px' }}>
          <div style={{ borderTop: '1px solid #30363D', paddingTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardList size={18} color="#8B949E" /> Special Visits
                </div>
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
    </div>
  )
}
