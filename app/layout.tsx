import type { Metadata } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Chasing 30',
  description: 'Personal MLB stadium tracker and trip planner',
}

const RANK_TIERS = [
  { name: 'Rookie',       minPts: 0,    icon: '🌱' },
  { name: 'Bench Player', minPts: 75,   icon: '⚾' },
  { name: 'Starter',      minPts: 200,  icon: '🏟️' },
  { name: 'All-Star',     minPts: 400,  icon: '⭐' },
  { name: 'MVP',          minPts: 700,  icon: '🏆' },
  { name: 'Legend',       minPts: 1200, icon: '🌟' },
]

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000))
}

function computeXP(visitedCount: number, gamesCount: number): number {
  let xp = 0
  if (gamesCount >= 1)   xp += 25
  if (visitedCount >= 5)  xp += 50
  if (visitedCount >= 10) xp += 75
  if (visitedCount >= 15) xp += 100
  if (visitedCount >= 20) xp += 125
  if (visitedCount >= 25) xp += 150
  if (visitedCount >= 30) xp += 300
  if (gamesCount >= 5)   xp += 35
  if (gamesCount >= 10)  xp += 50
  return xp
}

function getRank(xp: number) {
  return [...RANK_TIERS].reverse().find(r => xp >= r.minPts) ?? RANK_TIERS[0]
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <html lang="en" className="h-full">
        <body className="h-full" style={{ backgroundColor: '#0B1117' }}>{children}</body>
      </html>
    )
  }

  const today = new Date().toLocaleDateString('en-CA')

  const [{ data: trips }, { data: visits }] = await Promise.all([
    supabase.from('trips')
      .select('id, name, start_date, stadium:stadiums(name, abbreviation)')
      .eq('status', 'planned')
      .gte('start_date', today)
      .order('start_date')
      .limit(1),
    supabase.from('stadium_visits').select('stadium_id'),
  ])

  const allVisits = visits ?? []
  const visitedCount = new Set(allVisits.map((v: any) => v.stadium_id)).size
  const gamesCount = allVisits.length
  const xp = computeXP(visitedCount, gamesCount)
  const rank = getRank(xp)

  const nextTripRaw = trips?.[0] ?? null
  const stadium = nextTripRaw ? (nextTripRaw as any).stadium : null
  const nextTrip = nextTripRaw && stadium ? {
    id: nextTripRaw.id,
    stadiumName: stadium.name,
    stadiumAbbr: stadium.abbreviation,
    daysAway: daysUntil(nextTripRaw.start_date),
  } : null

  const userInitial = user.email?.[0]?.toUpperCase() ?? '?'

  return (
    <html lang="en" className="h-full">
      <body className="h-full" style={{ backgroundColor: '#0B1117' }}>
        <AppShell
          nextTrip={nextTrip}
          visitedCount={visitedCount}
          rankName={rank.name}
          rankIcon={rank.icon}
          rankXp={xp}
          userInitial={userInitial}
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
