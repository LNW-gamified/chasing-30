'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard,
  Map,
  Building2,
  BarChart3,
  Trophy,
  Plane,
  LogOut,
  Star,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/stadiums', label: 'Parks', icon: Building2 },
  { href: '/special-events', label: 'Events', icon: Star },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/milestones', label: 'Goals', icon: Trophy },
  { href: '/trips', label: 'Trips', icon: Plane },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="md:hidden flex items-center px-5 py-3"
        style={{ backgroundColor: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-2xl mr-2">⚾</span>
        <span className="font-black text-lg tracking-tight" style={{ color: '#ffffff' }}>Chasing 30</span>
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          backgroundColor: 'rgba(10,15,30,0.96)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
              style={{ color: active ? '#3b82f6' : '#4a5568' }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: '0.58rem', fontWeight: active ? 700 : 400, lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 min-h-screen fixed left-0 top-0 z-40"
        style={{ backgroundColor: '#080d1a', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-6 py-6"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-3xl">⚾</span>
          <div>
            <div className="font-black text-xl tracking-tight" style={{ color: '#ffffff', lineHeight: 1.1 }}>
              Chasing 30
            </div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: '#3b82f6', letterSpacing: '0.06em' }}>
              MLB STADIUM TRACKER
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 py-3 rounded-xl transition-all duration-150 relative overflow-hidden"
                style={{
                  paddingLeft: active ? '1.25rem' : '1rem',
                  paddingRight: '1rem',
                  backgroundColor: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: active ? '#ffffff' : '#64748b',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.color = '#94a3b8'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#64748b'
                  }
                }}
              >
                {/* Left accent bar */}
                {active && (
                  <div
                    className="absolute left-0 top-2 bottom-2 rounded-r"
                    style={{ width: 3, backgroundColor: '#3b82f6' }}
                  />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="font-semibold text-base">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-colors"
            style={{ color: '#4a5568' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#4a5568'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <LogOut size={20} />
            <span className="font-medium text-base">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
