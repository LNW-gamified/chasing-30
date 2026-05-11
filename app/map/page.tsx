import { createClient } from '@/lib/supabase-server'
import StadiumMap from '@/components/StadiumMap'
import type { Stadium, StadiumVisit, StadiumWithVisit } from '@/types'
import Link from 'next/link'
import { Home, MapPin, Map as MapIcon, Trophy, Plane } from 'lucide-react'

const NAV = [
  { label: 'Home',  href: '/dashboard',  icon: Home    },
  { label: 'Parks', href: '/stadiums',   icon: MapPin  },
  { label: 'Map',   href: '/map',        icon: MapIcon },
  { label: 'Goals', href: '/milestones', icon: Trophy  },
  { label: 'Trips', href: '/trips',      icon: Plane   },
]

export default async function MapPage() {
  const supabase = await createClient()

  const [{ data: stadiums }, { data: visits }] = await Promise.all([
    supabase.from('stadiums').select('*'),
    supabase.from('stadium_visits').select('*'),
  ])

  const allStadiums: Stadium[]    = stadiums ?? []
  const allVisits:   StadiumVisit[] = visits ?? []

  const visitMap = new Map<string, StadiumVisit[]>()
  for (const v of allVisits) {
    const list = visitMap.get(v.stadium_id) ?? []
    list.push(v)
    visitMap.set(v.stadium_id, list)
  }

  const stadiumsWithVisit: StadiumWithVisit[] = allStadiums.map(s => ({
    ...s,
    visited: visitMap.has(s.id),
    visits:  visitMap.get(s.id) ?? [],
  }))

  const visitedCount = stadiumsWithVisit.filter(s => s.visited).length

  return (
    <div style={{ position: 'relative', height: '100svh', overflow: 'hidden', backgroundColor: '#0B1117' }}>

      {/* ── Desktop sidebar (fixed left, 240px) ──────────────────────── */}
      <aside className="hidden md:flex flex-col" style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, zIndex: 50,
        backgroundColor: '#161B22', borderRight: '1px solid #30363D',
      }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#E6EDF3', letterSpacing: '-0.5px' }}>
            ⚾ Chasing 30
          </div>
        </div>
        <nav style={{ flex: 1, padding: '4px 12px' }}>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === '/map'
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                color: active ? '#E6EDF3' : '#8B949E',
                backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                fontWeight: active ? 700 : 500, fontSize: 15, textDecoration: 'none',
              }}>
                <Icon size={20} color={active ? '#1F6FEB' : '#8B949E'} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #30363D' }}>
          <div style={{ fontSize: 12, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Progress
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#E6EDF3' }}>
            {visitedCount}<span style={{ fontWeight: 400, fontSize: 14, color: '#8B949E' }}> / 30</span>
          </div>
          <div style={{ marginTop: 8, height: 5, backgroundColor: '#30363D', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(visitedCount / 30) * 100}%`, height: '100%', backgroundColor: '#3FB950', borderRadius: 3 }} />
          </div>
        </div>
      </aside>

      {/* ── Map area (full height, offset for sidebar on desktop) ─────── */}
      <div className="md:ml-[240px]" style={{ height: '100svh', position: 'relative' }}>
        <StadiumMap stadiums={stadiumsWithVisit} />
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────────── */}
      <div className="md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: '#161B22', borderTop: '1px solid #30363D',
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = href === '/map'
          return (
            <Link key={href} href={href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', textDecoration: 'none', padding: '10px 0', minHeight: 56,
              color: active ? '#1F6FEB' : '#8B949E', gap: 3,
            }}>
              <Icon size={22} color={active ? '#1F6FEB' : '#8B949E'} />
              {active && <span style={{ fontSize: 11, fontWeight: 700, color: '#1F6FEB' }}>{label}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
