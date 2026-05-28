'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Building2, Map, Trophy, Plane, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import TeamLogo from '@/components/TeamLogo'

export interface NextTripInfo {
  id: string
  stadiumName: string
  stadiumAbbr: string
  daysAway: number
}

interface Props {
  children: React.ReactNode
  nextTrip: NextTripInfo | null
  visitedCount: number
  rankName: string
  rankIcon: string
  rankXp: number
  userInitial: string
}

// Desktop sidebar shows all items; Map excluded from mobile bottom nav
const DESKTOP_NAV = [
  { href: '/dashboard',  label: 'Home',      icon: LayoutDashboard },
  { href: '/stadiums',   label: 'Ballparks', icon: Building2        },
  { href: '/map',        label: 'Map',       icon: Map              },
  { href: '/milestones', label: 'Records',   icon: Trophy           },
  { href: '/trips',      label: 'Road Trips', icon: Plane           },
]

// Mobile: Map removed
const MOBILE_NAV = [
  { href: '/dashboard',  label: 'Home',      icon: LayoutDashboard },
  { href: '/stadiums',   label: 'Ballparks', icon: Building2        },
  { href: '/milestones', label: 'Records',   icon: Trophy           },
  { href: '/trips',      label: 'Road Trips', icon: Plane           },
]

function daysLabel(days: number): string {
  if (days === 0) return 'Today!'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AppShell({ children, nextTrip, visitedCount, rankName, rankIcon, rankXp, userInitial }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const pct = Math.round((visitedCount / 30) * 100)
  const hasTrip = !!nextTrip
  const tripLabel = nextTrip ? daysLabel(nextTrip.daysAway) : ''

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col" style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 256, zIndex: 40,
        backgroundColor: '#0B1117', borderRight: '1px solid #30363D', overflowY: 'auto',
      }}>
        {/* Logo + Rank + Avatar */}
        <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid #30363D' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#E6EDF3', lineHeight: 1.2 }}>⚾ Chasing 30</div>
              <div style={{ fontSize: '0.75rem', color: '#8B949E', marginTop: 2 }}>MLB Stadium Tracker</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '3px 10px', borderRadius: 999, backgroundColor: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)' }}>
                <span style={{ fontSize: 12 }}>{rankIcon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F5A623' }}>{rankName}</span>
                <span style={{ fontSize: 10, color: '#8B949E', fontWeight: 600 }}>· {rankXp} pts</span>
              </div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(31,111,235,0.18)', border: '1px solid rgba(31,111,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B949E', fontWeight: 700, fontSize: '0.875rem' }}>
              {userInitial}
            </div>
          </div>
        </div>

        {/* Up Next card */}
        {nextTrip && (
          <div style={{ padding: '12px 12px 0' }}>
            <Link href={`/trips/${nextTrip.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, textDecoration: 'none', backgroundColor: 'rgba(31,111,235,0.08)', border: '1px solid rgba(31,111,235,0.2)' }}>
              {nextTrip.stadiumAbbr && <TeamLogo abbreviation={nextTrip.stadiumAbbr} size={28} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1F6FEB', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Next Stop</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextTrip.stadiumName}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#F5A623', flexShrink: 0 }}>{tripLabel}</span>
            </Link>
          </div>
        )}

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '0.75rem' }}>
          {DESKTOP_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname)
            return (
              <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 10, marginBottom: 2, backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent', color: active ? '#E6EDF3' : '#8B949E', fontWeight: active ? 600 : 400, fontSize: '0.9375rem', textDecoration: 'none', borderLeft: active ? '3px solid #1F6FEB' : '3px solid transparent' }}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Progress + Sign out */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #30363D' }}>
          <div style={{ fontSize: '0.8125rem', color: '#8B949E', marginBottom: 6 }}>{visitedCount} / 30 · {pct}% complete</div>
          <div style={{ height: 4, background: '#30363D', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#3FB950', borderRadius: 3 }} />
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.875rem', borderRadius: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', fontWeight: 400, fontSize: '0.875rem' }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main area (offset by sidebar on desktop) */}
      <div className="md:ml-64">
        {/* Mobile sticky header */}
        <header className="flex md:hidden items-center justify-between" style={{ position: 'sticky', top: 0, zIndex: 30, height: 48, backgroundColor: 'rgba(11,17,23,0.97)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid #30363D', padding: '0 16px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#E6EDF3' }}>⚾ Chasing 30</div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(31,111,235,0.18)', border: '1px solid rgba(31,111,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B949E', fontWeight: 700, fontSize: '0.875rem' }}>{userInitial}</div>
        </header>

        {/* Page content */}
        <div style={{ paddingBottom: 56 }} className="appshell-content">
          {children}
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="flex md:hidden" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, height: 56, backgroundColor: 'rgba(11,17,23,0.75)', borderTop: '1px solid rgba(48,54,61,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname)
            return (
              <Link key={href} href={href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', padding: '8px 0', gap: 3, color: active ? '#1F6FEB' : 'rgba(230,237,243,0.6)' }}>
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                {active && <span style={{ fontSize: '0.6rem', fontWeight: 700, lineHeight: 1 }}>{label}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) { .appshell-content { padding-bottom: 0 !important; } }
        .appshell-content { padding-bottom: 56px; }
      `}</style>
    </>
  )
}
