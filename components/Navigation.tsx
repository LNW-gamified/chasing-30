'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard,
  Map,
  Building2,
  Trophy,
  Plane,
  LogOut,
} from 'lucide-react'
import UpNextPill from '@/components/UpNextPill'

const NAV_ITEMS = [
  { href: '/dashboard',      label: 'Home',      icon: LayoutDashboard },
  { href: '/stadiums',       label: 'Ballparks', icon: Building2       },
  { href: '/map',            label: 'Map',       icon: Map             },
  { href: '/milestones',     label: 'Records',   icon: Trophy          },
  { href: '/trips',          label: 'Road Trips', icon: Plane          },
]

export default function Navigation() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          backgroundColor: 'rgba(11,17,23,0.96)',
          borderTop: '1px solid #30363D',
          backdropFilter: 'blur(12px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          display: 'flex',
          minHeight: 68,
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                minHeight: 68, paddingTop: 8, paddingBottom: 4, gap: 4,
                textDecoration: 'none',
                color: active ? '#1F6FEB' : 'rgba(255,255,255,0.65)',
              }}
            >
              <Icon size={active ? 30 : 26} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, lineHeight: 1 }}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 fixed left-0 top-0 bottom-0 z-40"
        style={{
          backgroundColor: '#0B1117',
          borderRight: '1px solid #30363D',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid #30363D' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#E6EDF3' }}>⚾ Chasing 30</div>
          <div style={{ fontSize: '0.75rem', color: '#8B949E', marginTop: 2 }}>MLB Stadium Tracker</div>
        </div>

        {/* Up Next pill */}
        <div style={{ padding: '12px 12px 0' }}>
          <UpNextPill />
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '0.75rem' }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 0.875rem', borderRadius: 10, marginBottom: 2,
                  backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                  color: active ? '#E6EDF3' : '#8B949E',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9375rem', textDecoration: 'none',
                  borderLeft: active ? '3px solid #1F6FEB' : '3px solid transparent',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid #30363D' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.625rem 0.875rem', borderRadius: 10, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8B949E', fontWeight: 400, fontSize: '0.9375rem',
            }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
