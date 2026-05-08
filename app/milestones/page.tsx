import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import MilestoneGrid from '@/components/MilestoneGrid'
import { MILESTONES } from '@/lib/milestones'
import type { Stadium, StadiumVisit, SpecialEvent, SerializableMilestone } from '@/types'

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

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
          Milestones
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a8b8c8' }}>
          {earned.length} of {MILESTONES.length} earned
        </p>
      </div>

      {/* Progress */}
      <div className="card p-4 mb-8">
        <div className="flex justify-between text-xs mb-2" style={{ color: '#a8b8c8' }}>
          <span>{earned.length} earned</span>
          <span>{unearned.length} remaining</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 8, backgroundColor: '#1f2937' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(earned.length / MILESTONES.length) * 100}%`,
              backgroundColor: '#a78bfa',
            }}
          />
        </div>
      </div>

      {earned.length === 1 && (
        <div
          className="card p-5 mb-6 flex items-center gap-4"
          style={{
            borderColor: 'rgba(251,191,36,0.4)',
            backgroundColor: 'rgba(251,191,36,0.06)',
            boxShadow: '0 0 24px rgba(251,191,36,0.1)',
          }}
        >
          <div className="text-4xl flex-shrink-0">🎉</div>
          <div>
            <div className="font-bold text-base" style={{ color: '#fbbf24' }}>
              First milestone unlocked!
            </div>
            <div className="text-sm mt-0.5" style={{ color: '#b8c8d8' }}>
              You earned <strong style={{ color: '#f1f5f9' }}>{earned[0].name}</strong> — the journey has begun.
            </div>
          </div>
          <div className="ml-auto text-2xl flex-shrink-0">🏆</div>
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
