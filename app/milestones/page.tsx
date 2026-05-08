import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import { MILESTONES } from '@/lib/milestones'
import type { Stadium, StadiumVisit } from '@/types'
import { Trophy, Lock } from 'lucide-react'

export default async function MilestonesPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
  ])

  const allStadiums: Stadium[] = stadiums ?? []
  const allVisits: StadiumVisit[] = visits ?? []

  const earned = MILESTONES.filter((m) => m.check(allVisits, allStadiums))
  const unearned = MILESTONES.filter((m) => !m.check(allVisits, allStadiums))

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
          Milestones
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          {earned.length} of {MILESTONES.length} earned
        </p>
      </div>

      {/* Progress */}
      <div className="card p-4 mb-8">
        <div className="flex justify-between text-xs mb-2" style={{ color: '#64748b' }}>
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

      {/* Earned */}
      {earned.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#a78bfa' }}>
            <Trophy size={16} /> Earned ({earned.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {earned.map((m) => (
              <div
                key={m.id}
                className="card p-5 flex items-center gap-4"
                style={{ borderColor: 'rgba(167,139,250,0.3)', backgroundColor: 'rgba(167,139,250,0.05)' }}
              >
                <div
                  className="text-3xl w-14 h-14 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ backgroundColor: 'rgba(167,139,250,0.15)' }}
                >
                  {m.icon}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>
                    {m.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                    {m.description}
                  </div>
                  <div
                    className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
                  >
                    <Trophy size={10} /> Earned
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unearned */}
      {unearned.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#64748b' }}>
            <Lock size={16} /> Locked ({unearned.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {unearned.map((m) => (
              <div
                key={m.id}
                className="card p-5 flex items-center gap-4 opacity-60"
              >
                <div
                  className="text-3xl w-14 h-14 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ backgroundColor: '#1f2937', filter: 'grayscale(100%)' }}
                >
                  {m.icon}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#94a3b8' }}>
                    {m.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                    {m.description}
                  </div>
                  <div
                    className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#1f2937', color: '#64748b' }}
                  >
                    <Lock size={10} /> Locked
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {earned.length === 0 && (
        <div className="text-center py-16" style={{ color: '#64748b' }}>
          <div className="text-5xl mb-4">🏆</div>
          <div className="font-medium mb-1" style={{ color: '#94a3b8' }}>
            No milestones earned yet
          </div>
          <div className="text-sm">
            Start visiting stadiums and logging games to earn achievements
          </div>
        </div>
      )}
    </AppShell>
  )
}
