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
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/stadiums', label: 'Stadiums', icon: Building2 },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/milestones', label: 'Milestones', icon: Trophy },
  { href: '/trips', label: 'Trips', icon: Plane },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile header */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: '#0d1424', borderBottom: '1px solid #1f2937' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚾</span>
          <span className="font-bold text-lg" style={{ color: '#f1f5f9' }}>
            Chasing 30
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ color: '#94a3b8' }}
          className="p-1"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 pt-14"
          style={{ backgroundColor: '#0a0e1a' }}
        >
          <nav className="flex flex-col p-4 gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: active ? '#60a5fa' : '#94a3b8',
                  }}
                >
                  <Icon size={20} />
                  <span className="font-medium">{label}</span>
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg mt-4"
              style={{ color: '#ef4444' }}
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 min-h-screen fixed left-0 top-0 z-40"
        style={{ backgroundColor: '#0d1424', borderRight: '1px solid #1f2937' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-6 py-5"
          style={{ borderBottom: '1px solid #1f2937' }}
        >
          <span className="text-2xl">⚾</span>
          <div>
            <div className="font-bold text-base" style={{ color: '#f1f5f9' }}>
              Chasing 30
            </div>
            <div className="text-xs" style={{ color: '#64748b' }}>
              MLB Stadium Tracker
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
                style={{
                  backgroundColor: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: active ? '#60a5fa' : '#94a3b8',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                    e.currentTarget.style.color = '#f1f5f9'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#94a3b8'
                  }
                }}
              >
                <Icon size={18} />
                <span className="font-medium text-sm">{label}</span>
                {active && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#3b82f6' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3" style={{ borderTop: '1px solid #1f2937' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
