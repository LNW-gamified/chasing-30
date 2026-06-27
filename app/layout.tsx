import type { Metadata } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import InstallPrompt from '@/components/InstallPrompt'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import { MILESTONES } from '@/lib/milestones'
import { RANK_TIERS, MILESTONE_POINTS } from '@/lib/ranks'
import type { StadiumVisit, Stadium, SpecialEvent, BaseballLifeEntry } from '@/types'

export const metadata: Metadata = {
  title: 'Chasing 30',
  description: 'Track your journey to visit all 30 MLB ballparks',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chasing 30',
  },
}

function daysUntil(dateStr: string): number {
  const todayLA = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const today   = new Date(todayLA + 'T00:00:00')
  const target  = new Date(dateStr  + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000))
}


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sharedHead = (
    <>
      <meta name="theme-color" content="#0a0e1a" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Chasing 30" />
      <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      <link rel="manifest" href="/manifest.json" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700;900&family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet" />
    </>
  )

  if (!user) {
    return (
      <html lang="en" className="h-full">
        <head>{sharedHead}</head>
        <body className="h-full" style={{ backgroundColor: '#0a0e1a', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
          <ServiceWorkerRegistrar />
          {children}
        </body>
      </html>
    )
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  const [{ data: trips }, { data: visits }, { data: stadiums }, { data: events }, { data: bleEntries }] = await Promise.all([
    supabase.from('trips')
      .select('id, name, start_date, stadium:stadiums(name, abbreviation)')
      .eq('status', 'planned')
      .gte('start_date', today)
      .order('start_date', { ascending: true, nullsFirst: false })
      .limit(1),
    supabase.from('stadium_visits').select('*'),
    supabase.from('stadiums').select('*'),
    supabase.from('special_events').select('*'),
    supabase.from('baseball_life_entries').select('id, category'),
  ])

  const allVisits: StadiumVisit[] = visits ?? []
  const allStadiums: Stadium[] = stadiums ?? []
  const allEvents: SpecialEvent[] = events ?? []
  const allBaseballLife: BaseballLifeEntry[] = (bleEntries ?? []) as BaseballLifeEntry[]

  const visitedCount = new Set(allVisits.map(v => v.stadium_id)).size
  const gamesCount = allVisits.length

  const ladderMilestones = MILESTONES.filter(m => m.tiers != null)
  const regularMilestones = MILESTONES.filter(m => m.tiers == null)
  const earned = regularMilestones.filter(m => m.check(allVisits, allStadiums, allEvents, allBaseballLife))

  const ladderPoints = ladderMilestones.reduce((sum, m) => {
    const val = m.getValue ? m.getValue(allVisits, allStadiums, allEvents, allBaseballLife) : 0
    return sum + (m.tiers ?? []).filter(t => t.threshold <= val).reduce((s, t) => s + t.points, 0)
  }, 0)
  const xp = earned.reduce((sum, m) => sum + (MILESTONE_POINTS[m.id] ?? 25), 0) + ladderPoints

  const rank = [...RANK_TIERS].reverse().find(r => xp >= r.minPts) ?? RANK_TIERS[0]
  const xpNext = RANK_TIERS.find(r => r.minPts > xp) ?? null
  const xpMin = rank.minPts

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
      <head>{sharedHead}</head>
      <body className="h-full" style={{ backgroundColor: '#0a0e1a' }}>
        <ServiceWorkerRegistrar />
        <AppShell
          nextTrip={nextTrip}
          visitedCount={visitedCount}
          rankName={rank.name}
          rankIcon={rank.icon}
          rankXp={xp}
          rankXpMin={xpMin}
          rankXpNext={xpNext?.minPts ?? null}
          userInitial={userInitial}
          userId={user.id}
          userEmail={user.email ?? ''}
          memberSince={user.created_at ?? new Date().toISOString()}
          gamesCount={gamesCount}
        >
          {children}
        </AppShell>
        <InstallPrompt />
      </body>
    </html>
  )
}
