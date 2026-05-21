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
  { href: '/dashboard',  label: 'Home',  icon: LayoutDashboard },
  { href: '/stadiums',   label: 'Parks', icon: Building2       },
  { href: '/map',        label: 'Map',   icon: Map             },
  { href: '/milestones', label: 'Goals', icon: Trophy          },
  { href: '/trips',      label: 'Trips', icon: Plane           },
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          backgroundColor: 'rgba(11,17,23,0.96)',
          borderTop: '1px solid #30363D',
          backdropFilter: 'blur(12px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
              style={{ color: active ? '#1F6FEB' : '#8B949E' }}
            >
              <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: '0.65rem', fontWeight: active ? 700 : 400, lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 min-h-screen fixed left-0 top-0 z-40"
        style={{ backgroundColor: '#161B22', borderRight: '1px solid #30363D' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-6 py-6"
          style={{ borderBottom: '1px solid #30363D' }}
        >
          <span className="text-3xl">⚾</span>
          <div>
            <div className="font-black text-xl tracking-tight" style={{ color: '#E6EDF3', lineHeight: 1.1 }}>
              Chasing 30
            </div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: '#1F6FEB', letterSpacing: '0.06em' }}>
              MLB STADIUM TRACKER
            </div>
          </div>
        </div>

        {/* Up Next pill */}
        <div className="px-3 pt-3">
          <UpNextPill />
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
                  backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                  color: active ? '#E6EDF3' : '#8B949E',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = '#1C2430'
                    e.currentTarget.style.color = '#E6EDF3'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#8B949E'
                  }
                }}
              >
                {active && (
                  <div
                    className="absolute left-0 top-2 bottom-2 rounded-r"
                    style={{ width: 3, backgroundColor: '#1F6FEB' }}
                  />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="font-semibold text-base">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 pb-5" style={{ borderTop: '1px solid #30363D' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-colors"
            style={{ color: '#8B949E' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F85149'
              e.currentTarget.style.backgroundColor = 'rgba(248,81,73,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#8B949E'
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
