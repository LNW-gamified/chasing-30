'use client'

import { useState } from 'react'
import { Trophy, Lock, X, MapPin, Calendar } from 'lucide-react'
import type { SerializableMilestone, StadiumVisit, Stadium, SpecialEvent } from '@/types'

interface EarningContext {
  date: string
  location?: string
}

function getNthUniqueVisit(n: number, sorted: StadiumVisit[], stadiums: Stadium[]): EarningContext | null {
  const seen = new Set<string>()
  for (const v of sorted) {
    if (!seen.has(v.stadium_id)) {
      seen.add(v.stadium_id)
      if (seen.size === n) {
        return { date: v.visit_date, location: stadiums.find(s => s.id === v.stadium_id)?.name }
      }
    }
  }
  return null
}

function getCompletionContext(group: Stadium[], sorted: StadiumVisit[], stadiums: Stadium[]): EarningContext | null {
  const groupIds = new Set(group.map(s => s.id))
  const seen = new Set<string>()
  for (const v of sorted) {
    if (groupIds.has(v.stadium_id) && !seen.has(v.stadium_id)) {
      seen.add(v.stadium_id)
      if (seen.size === groupIds.size) {
        return { date: v.visit_date, location: stadiums.find(s => s.id === v.stadium_id)?.name }
      }
    }
  }
  return null
}

function getSerializableMilestoneContext(
  milestone: SerializableMilestone,
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[]
): EarningContext | null {
  const sv = [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))
  const se = [...allEvents].sort((a, b) => a.event_date.localeCompare(b.event_date))
  const sn = (id: string) => allStadiums.find(s => s.id === id)?.name

  switch (milestone.id) {
    case 'first_game': return sv[0] ? { date: sv[0].visit_date, location: sn(sv[0].stadium_id) } : null
    case 'five_games': return sv[4] ? { date: sv[4].visit_date, location: sn(sv[4].stadium_id) } : null
    case 'ten_games': return sv[9] ? { date: sv[9].visit_date, location: sn(sv[9].stadium_id) } : null
    case 'five_stadiums': return getNthUniqueVisit(5, sv, allStadiums)
    case 'ten_stadiums': return getNthUniqueVisit(10, sv, allStadiums)
    case 'fifteen_stadiums': return getNthUniqueVisit(15, sv, allStadiums)
    case 'twenty_stadiums': return getNthUniqueVisit(20, sv, allStadiums)
    case 'twentyfive_stadiums': return getNthUniqueVisit(25, sv, allStadiums)
    case 'all_stadiums': return getNthUniqueVisit(30, sv, allStadiums)
    case 'al_east': return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'East'), sv, allStadiums)
    case 'al_central': return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'Central'), sv, allStadiums)
    case 'al_west': return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'West'), sv, allStadiums)
    case 'nl_east': return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'East'), sv, allStadiums)
    case 'nl_central': return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'Central'), sv, allStadiums)
    case 'nl_west': return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'West'), sv, allStadiums)
    case 'american_league': return getCompletionContext(allStadiums.filter(s => s.league === 'AL'), sv, allStadiums)
    case 'national_league': return getCompletionContext(allStadiums.filter(s => s.league === 'NL'), sv, allStadiums)
    case 'east_coast': return getCompletionContext(allStadiums.filter(s => s.division === 'East'), sv, allStadiums)
    case 'midwest': return getCompletionContext(allStadiums.filter(s => s.division === 'Central'), sv, allStadiums)
    case 'west_coast': return getCompletionContext(allStadiums.filter(s => s.division === 'West'), sv, allStadiums)
    case 'first_special_event': {
      const e = se[0]
      return e ? { date: e.event_date, location: e.stadium_name ?? e.venue_name ?? undefined } : null
    }
    case 'world_series_attendance': {
      const e = se.find(e => e.event_type === 'world_series')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'all_star_attendance': {
      const e = se.find(e => e.event_type === 'all_star_game')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'postseason_attendance': {
      const e = se.find(e => e.event_type === 'postseason')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'spring_training_attendance': {
      const e = se.find(e => e.event_type === 'spring_training')
      return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null
    }
    case 'minor_league_attendance': {
      const e = se.find(e => e.event_type === 'minor_league')
      return e ? { date: e.event_date, location: e.venue_name ?? e.stadium_name ?? undefined } : null
    }
    case 'hall_of_fame_visit': {
      const e = se.find(e => e.event_type === 'historic_ballpark' && e.venue_name === 'National Baseball Hall of Fame')
      return e ? { date: e.event_date, location: 'Cooperstown, NY' } : null
    }
    case 'field_of_dreams_visit': {
      const e = se.find(e => e.event_type === 'historic_ballpark' && e.venue_name === 'Field of Dreams')
      return e ? { date: e.event_date, location: 'Dyersville, IA' } : null
    }
    case 'international_game': {
      const e = se.find(e => e.event_type === 'international')
      return e ? { date: e.event_date, location: e.stadium_name ?? e.city ?? undefined } : null
    }
    case 'historic_ballparks_all': {
      const VENUES = ['Louisville Slugger Museum & Factory', 'National Baseball Hall of Fame', 'Negro Leagues Baseball Museum', 'Field of Dreams', 'Rickwood Field']
      const historic = se.filter(e => e.event_type === 'historic_ballpark' && e.venue_name && VENUES.includes(e.venue_name))
      const seen = new Set<string>()
      for (const e of historic) {
        seen.add(e.venue_name!)
        if (seen.size === VENUES.length) return { date: e.event_date, location: e.venue_name ?? undefined }
      }
      return null
    }
    default: return null
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

interface Props {
  earned: SerializableMilestone[]
  unearned: SerializableMilestone[]
  allVisits: StadiumVisit[]
  allStadiums: Stadium[]
  allEvents: SpecialEvent[]
}

export default function MilestoneGrid({ earned, unearned, allVisits, allStadiums, allEvents }: Props) {
  const [selected, setSelected] = useState<{ milestone: SerializableMilestone; isEarned: boolean } | null>(null)

  const context = selected?.isEarned
    ? getSerializableMilestoneContext(selected.milestone, allVisits, allStadiums, allEvents)
    : null

  function EarnedCard({ m }: { m: SerializableMilestone }) {
    return (
      <button
        onClick={() => setSelected({ milestone: m, isEarned: true })}
        className="w-full text-left achievement-earned transition-all duration-200"
        style={{
          backgroundColor: 'rgba(20,28,50,0.9)',
          border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 12,
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(167,139,250,0.6)'
          e.currentTarget.style.backgroundColor = 'rgba(167,139,250,0.08)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)'
          e.currentTarget.style.backgroundColor = 'rgba(20,28,50,0.9)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <div
          style={{
            width: 72, height: 72,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(139,92,246,0.15) 100%)',
            border: '1px solid rgba(167,139,250,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.2rem',
            flexShrink: 0,
            boxShadow: '0 0 20px rgba(167,139,250,0.2)',
          }}
        >
          {m.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-base mb-0.5" style={{ color: '#ffffff' }}>
            {m.name}
          </div>
          <div className="text-base" style={{ color: '#94a3b8' }}>
            {m.description}
          </div>
          <div
            className="inline-flex items-center gap-1.5 mt-2 text-base px-2.5 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
          >
            <Trophy size={11} /> Earned
          </div>
        </div>
      </button>
    )
  }

  function LockedCard({ m }: { m: SerializableMilestone }) {
    return (
      <button
        onClick={() => setSelected({ milestone: m, isEarned: false })}
        className="w-full text-left transition-all duration-200"
        style={{
          backgroundColor: 'rgba(15,23,41,0.6)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12,
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          cursor: 'pointer',
          opacity: 0.65,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.85'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.65'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width: 72, height: 72,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.2rem',
              filter: 'grayscale(100%) brightness(0.5)',
            }}
          >
            {m.icon}
          </div>
          <div
            style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 22, height: 22,
              backgroundColor: '#0a0f1e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Lock size={11} style={{ color: '#4a5568' }} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-base mb-0.5" style={{ color: '#64748b' }}>
            {m.name}
          </div>
          <div className="text-base" style={{ color: '#4a5568' }}>
            {m.description}
          </div>
          <div
            className="inline-flex items-center gap-1.5 mt-2 text-base px-2.5 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#4a5568' }}
          >
            <Lock size={11} /> Locked
          </div>
        </div>
      </button>
    )
  }

  return (
    <>
      {earned.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} style={{ color: '#a78bfa' }} />
            <span className="text-lg font-bold" style={{ color: '#a78bfa' }}>Earned ({earned.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {earned.map(m => <EarnedCard key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {unearned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Lock size={18} style={{ color: '#4a5568' }} />
            <span className="text-lg font-bold" style={{ color: '#4a5568' }}>Locked ({unearned.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {unearned.map(m => <LockedCard key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {earned.length === 0 && unearned.length === 0 && (
        <div className="text-center py-20" style={{ color: '#64748b' }}>
          <div className="text-4xl mb-4">🏆</div>
          <div className="text-lg font-semibold mb-1" style={{ color: '#94a3b8' }}>No milestones yet</div>
          <div className="text-base">Start visiting stadiums to earn achievements</div>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm relative overflow-hidden"
            style={{
              backgroundColor: '#131d35',
              border: selected.isEarned ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16,
              boxShadow: selected.isEarned
                ? '0 0 60px rgba(167,139,250,0.2), 0 24px 64px rgba(0,0,0,0.6)'
                : '0 24px 64px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header gradient for earned */}
            {selected.isEarned && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 120,
                background: 'linear-gradient(180deg, rgba(139,92,246,0.2) 0%, transparent 100%)',
                pointerEvents: 'none',
              }} />
            )}

            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg z-10 transition-colors"
              style={{ color: '#64748b', backgroundColor: 'rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b' }}
            >
              <X size={18} />
            </button>

            <div className="p-7 relative z-10">
              {/* Icon */}
              <div
                className="mx-auto mb-5 flex items-center justify-center"
                style={{
                  width: 88, height: 88,
                  borderRadius: 20,
                  background: selected.isEarned
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(139,92,246,0.15) 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: selected.isEarned ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  fontSize: '3rem',
                  filter: selected.isEarned ? 'none' : 'grayscale(100%) brightness(0.5)',
                  boxShadow: selected.isEarned ? '0 0 30px rgba(167,139,250,0.3)' : 'none',
                }}
              >
                {selected.milestone.icon}
              </div>

              <div className="text-xl font-black text-center mb-2" style={{ color: '#ffffff' }}>
                {selected.milestone.name}
              </div>
              <div className="text-base text-center mb-5" style={{ color: '#94a3b8' }}>
                {selected.milestone.description}
              </div>

              {selected.isEarned ? (
                <>
                  <div className="flex justify-center mb-4">
                    <div
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-base font-bold"
                      style={{ backgroundColor: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
                    >
                      <Trophy size={14} /> Achievement Unlocked
                    </div>
                  </div>
                  {context && (
                    <div
                      className="flex flex-col gap-3 p-4 rounded-xl"
                      style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-2.5 text-base" style={{ color: '#ffffff' }}>
                        <Calendar size={15} style={{ color: '#a78bfa', flexShrink: 0 }} />
                        {formatDate(context.date)}
                      </div>
                      {context.location && (
                        <div className="flex items-center gap-2.5 text-base" style={{ color: '#ffffff' }}>
                          <MapPin size={15} style={{ color: '#a78bfa', flexShrink: 0 }} />
                          {context.location}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-center">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-base font-semibold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <Lock size={14} /> Not yet earned — keep going
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
