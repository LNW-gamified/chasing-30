import type { Metadata } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import InstallPrompt from '@/components/InstallPrompt'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'

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

const RANK_TIERS = [
  { name: 'Sandlot Kid',       minPts: 0,    icon: '⚾', description: 'Where every legend begins' },
  { name: 'Minor Leaguer',     minPts: 75,   icon: '🚌', description: 'Working your way up' },
  { name: 'September Call-Up', minPts: 200,  icon: '📈', description: 'The bigs are calling' },
  { name: 'Rotation Ace',      minPts: 400,  icon: '🔥', description: "You're the real deal" },
  { name: 'All-Star',          minPts: 700,  icon: '⭐', description: 'The fans voted you in' },
  { name: 'Hall of Famer',     minPts: 1200, icon: '🏆', description: 'Your plaque is waiting' },
]

function daysUntil(dateStr: string): number {
  const todayLA = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const today   = new Date(todayLA + 'T00:00:00')
  const target  = new Date(dateStr  + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000))
}

function computeXP(visitedCount: number, gamesCount: number): number {
  let xp = 0
  if (gamesCount >= 1)    xp += 25
  if (visitedCount >= 5)  xp += 50
  if (visitedCount >= 10) xp += 75
  if (visitedCount >= 15) xp += 100
  if (visitedCount >= 20) xp += 125
  if (visitedCount >= 25) xp += 150
  if (visitedCount >= 30) xp += 300
  if (gamesCount >= 5)    xp += 35
  if (gamesCount >= 10)   xp += 50
  return xp
}

function getRank(xp: number) {
  return [...RANK_TIERS].reverse().find(r => xp >= r.minPts) ?? RANK_TIERS[0]
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
    </>
  )

  if (!user) {
    return (
      <html lang="en" className="h-full">
        <head>{sharedHead}</head>
        <body className="h-full" style={{ backgroundColor: '#0a0e1a' }}>
          <ServiceWorkerRegistrar />
          {children}
        </body>
      </html>
    )
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  const [{ data: trips }, { data: visits }] = await Promise.all([
    supabase.from('trips')
      .select('id, name, start_date, stadium:stadiums(name, abbreviation)')
      .eq('status', 'planned')
      .gte('start_date', today)
      .order('start_date', { ascending: true, nullsFirst: false })
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
      <head>{sharedHead}</head>
      <body className="h-full" style={{ backgroundColor: '#0a0e1a' }}>
        <ServiceWorkerRegistrar />
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
        <InstallPrompt />
      </body>
    </html>
  )
}
