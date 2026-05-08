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
