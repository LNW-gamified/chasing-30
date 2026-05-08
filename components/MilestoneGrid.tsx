'use client'

import { useState } from 'react'
import { Trophy, Lock, X, MapPin, Calendar } from 'lucide-react'
import type { Milestone, StadiumVisit, Stadium, SpecialEvent } from '@/types'

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

function getMilestoneContext(
  milestone: Milestone,
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
  earned: Milestone[]
  unearned: Milestone[]
  allVisits: StadiumVisit[]
  allStadiums: Stadium[]
  allEvents: SpecialEvent[]
}

export default function MilestoneGrid({ earned, unearned, allVisits, allStadiums, allEvents }: Props) {
  const [selected, setSelected] = useState<{ milestone: Milestone; isEarned: boolean } | null>(null)

  const context = selected?.isEarned
    ? getMilestoneContext(selected.milestone, allVisits, allStadiums, allEvents)
    : null

  function MilestoneCard({ m, isEarned }: { m: Milestone; isEarned: boolean }) {
    return (
      <button
        onClick={() => setSelected({ milestone: m, isEarned })}
        className="card p-5 flex items-center gap-4 w-full text-left transition-all duration-150"
        style={
          isEarned
            ? { borderColor: 'rgba(167,139,250,0.3)', backgroundColor: 'rgba(167,139,250,0.05)' }
            : { opacity: 0.65 }
        }
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = isEarned ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.15)' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = isEarned ? '1' : '0.65'; e.currentTarget.style.borderColor = isEarned ? 'rgba(167,139,250,0.3)' : '' }}
      >
        <div
          className="text-3xl w-14 h-14 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ backgroundColor: isEarned ? 'rgba(167,139,250,0.15)' : '#1f2937', filter: isEarned ? undefined : 'grayscale(100%)' }}
        >
          {m.icon}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm" style={{ color: isEarned ? '#f1f5f9' : '#b8c8d8' }}>
            {m.name}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#a8b8c8' }}>
            {m.description}
          </div>
          <div
            className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-0.5 rounded-full"
            style={isEarned
              ? { backgroundColor: 'rgba(167,139,250,0.2)', color: '#a78bfa' }
              : { backgroundColor: '#1f2937', color: '#a8b8c8' }}
          >
            {isEarned ? <><Trophy size={10} /> Earned</> : <><Lock size={10} /> Locked</>}
          </div>
        </div>
      </button>
    )
  }

  return (
    <>
      {earned.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#a78bfa' }}>
            <Trophy size={16} /> Earned ({earned.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {earned.map(m => <MilestoneCard key={m.id} m={m} isEarned />)}
          </div>
        </div>
      )}

      {unearned.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#a8b8c8' }}>
            <Lock size={16} /> Locked ({unearned.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {unearned.map(m => <MilestoneCard key={m.id} m={m} isEarned={false} />)}
          </div>
        </div>
      )}

      {earned.length === 0 && unearned.length === 0 && (
        <div className="text-center py-16" style={{ color: '#a8b8c8' }}>
          <div className="text-5xl mb-4">🏆</div>
          <div className="font-medium mb-1" style={{ color: '#b8c8d8' }}>No milestones earned yet</div>
          <div className="text-sm">Start visiting stadiums and logging games to earn achievements</div>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="card p-7 max-w-sm w-full relative"
            style={selected.isEarned ? { borderColor: 'rgba(167,139,250,0.4)' } : {}}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 p-1 rounded"
              style={{ color: '#a8b8c8' }}
            >
              <X size={18} />
            </button>

            <div className="text-5xl text-center mb-4">{selected.milestone.icon}</div>
            <div className="text-xl font-bold text-center mb-2" style={{ color: '#f1f5f9' }}>
              {selected.milestone.name}
            </div>
            <div className="text-sm text-center mb-5" style={{ color: '#b8c8d8' }}>
              {selected.milestone.description}
            </div>

            {selected.isEarned ? (
              <>
                <div className="flex justify-center mb-4">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                    style={{ backgroundColor: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
                  >
                    <Trophy size={13} /> Earned
                  </div>
                </div>
                {context && (
                  <div
                    className="flex flex-col gap-3 p-4 rounded-xl"
                    style={{ backgroundColor: '#0d1424' }}
                  >
                    <div className="flex items-center gap-2.5 text-sm" style={{ color: '#f1f5f9' }}>
                      <Calendar size={15} style={{ color: '#a78bfa', flexShrink: 0 }} />
                      {formatDate(context.date)}
                    </div>
                    {context.location && (
                      <div className="flex items-center gap-2.5 text-sm" style={{ color: '#f1f5f9' }}>
                        <MapPin size={15} style={{ color: '#a78bfa', flexShrink: 0 }} />
                        {context.location}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-center mt-2">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                  style={{ backgroundColor: '#1f2937', color: '#a8b8c8' }}
                >
                  <Lock size={13} /> Not yet earned
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
