import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import MilestoneGrid from '@/components/MilestoneGrid'
import { MILESTONES } from '@/lib/milestones'
import type { Stadium, StadiumVisit, SpecialEvent, SerializableMilestone } from '@/types'
import { Trophy } from 'lucide-react'

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

  const earned = MILESTONES.filter((m) => m.check(allVisits, allStadiums, allEvents))
  const unearned = MILESTONES.filter((m) => !m.check(allVisits, allStadiums, allEvents))
  const pct = Math.round((earned.length / MILESTONES.length) * 100)

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: '#ffffff' }}>
          Milestones
        </h1>
        <p className="text-base mt-0.5" style={{ color: '#64748b' }}>
          Achievements for your MLB journey
        </p>
      </div>

      {/* Progress hero */}
      <div
        className="card mb-8 p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.06) 100%)',
          borderColor: 'rgba(139,92,246,0.2)',
        }}
      >
        <div className="flex items-center gap-5 flex-wrap">
          <div
            style={{
              width: 72, height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(139,92,246,0.15))',
              border: '1px solid rgba(167,139,250,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 24px rgba(167,139,250,0.2)',
            }}
          >
            <Trophy size={32} style={{ color: '#a78bfa' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-end gap-2 mb-2">
              <span className="font-black" style={{ fontSize: '3rem', color: '#a78bfa', lineHeight: 1, letterSpacing: '-0.04em' }}>
                {earned.length}
              </span>
              <span className="text-xl font-semibold mb-1" style={{ color: '#64748b' }}>/ {MILESTONES.length}</span>
              <span className="text-lg mb-1 ml-1" style={{ color: '#64748b' }}>earned</span>
            </div>
            <div className="rounded-full overflow-hidden mb-1.5" style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                  boxShadow: earned.length > 0 ? '0 0 12px rgba(167,139,250,0.5)' : 'none',
                }}
              />
            </div>
            <div className="text-base" style={{ color: '#64748b' }}>
              {pct}% complete · {unearned.length} to unlock
            </div>
          </div>
        </div>
      </div>

      {/* First milestone banner */}
      {earned.length === 1 && (
        <div
          className="card p-5 mb-6 flex items-center gap-4"
          style={{
            borderColor: 'rgba(251,191,36,0.35)',
            background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.04) 100%)',
            boxShadow: '0 0 32px rgba(251,191,36,0.1)',
          }}
        >
          <div className="text-4xl flex-shrink-0">🎉</div>
          <div>
            <div className="font-bold text-base" style={{ color: '#fbbf24' }}>First achievement unlocked!</div>
            <div className="text-base mt-0.5" style={{ color: '#94a3b8' }}>
              You earned <strong style={{ color: '#ffffff' }}>{earned[0].name}</strong> — the journey has begun.
            </div>
          </div>
          <div className="ml-auto text-3xl flex-shrink-0">🏆</div>
        </div>
      )}

      <MilestoneGrid
        earned={toSerializable(earned)}
        unearned={toSerializable(unearned)}
        allVisits={allVisits}
        allStadiums={allStadiums}
        allEvents={allEvents}
      />
    </AppShell>
  )
}
