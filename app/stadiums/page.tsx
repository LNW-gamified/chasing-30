'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Search, Check, ChevronRight, Home, MapPin, Map, Trophy, Plane, X } from 'lucide-react'
import type { Stadium, StadiumVisit } from '@/types'
import TeamLogo from '@/components/TeamLogo'

type SortKey = 'name' | 'team' | 'state' | 'league' | 'division'
type FilterLeague = 'all' | 'AL' | 'NL'
type FilterDivision = 'all' | 'East' | 'Central' | 'West'
type FilterVisited = 'all' | 'visited' | 'unvisited'
type Category = 'mlb' | 'historical' | 'spring'

const TEAM_ACCENT: Record<string, string> = {
  NYY: '#003087', BOS: '#BD3039', LAD: '#005A9C', CHC: '#0E3386',
  CWS: '#27251F', STL: '#C41E3A', ATL: '#CE1141', NYM: '#002D72',
  PHI: '#E81828', WSH: '#AB0003', MIA: '#00A3E0', PIT: '#FDB827',
  CIN: '#C6011F', MIL: '#FFC52F', HOU: '#EB6E1F', TEX: '#003278',
  LAA: '#BA0021', OAK: '#003831', SEA: '#0C2C56', SD:  '#2F241D',
  COL: '#33006F', ARI: '#A71930', SF:  '#FD5A1E', MIN: '#002B5C',
  CLE: '#E31937', DET: '#0C2340', KC:  '#004687', BAL: '#DF4601',
  TB:  '#092C5C', TOR: '#134A8E',
}

const NAV = [
  { label: 'Home',  href: '/dashboard',  icon: Home },
  { label: 'Parks', href: '/stadiums',   icon: MapPin },
  { label: 'Map',   href: '/map',        icon: Map },
  { label: 'Goals', href: '/milestones', icon: Trophy },
  { label: 'Trips', href: '/trips',      icon: Plane },
]

function HeaderRing({ visited, total }: { visited: number; total: number }) {
  const size = 52
  const sw = 4
  const r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const pct = total === 0 ? 0 : visited / total
  const dash = pct * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#ffffff" strokeWidth={sw}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={10} fontWeight={700}
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

export default function StadiumsPage() {
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [visits, setVisits] = useState<StadiumVisit[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('team')
  const [filterLeague, setFilterLeague] = useState<FilterLeague>('all')
  const [filterDivision, setFilterDivision] = useState<FilterDivision>('all')
  const [filterVisited, setFilterVisited] = useState<FilterVisited>('all')
  const [activeCategory, setActiveCategory] = useState<Category>('mlb')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('stadiums').select('*').order('team'),
      supabase.from('stadium_visits').select('stadium_id'),
    ]).then(([{ data: s }, { data: v }]) => {
      setStadiums(s ?? [])
      setVisits((v as StadiumVisit[]) ?? [])
      setLoading(false)
    })
  }, [])

  const visitedIds = useMemo(() => new Set(visits.map((v) => v.stadium_id)), [visits])

  const visitCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    visits.forEach((v) => { counts[v.stadium_id] = (counts[v.stadium_id] ?? 0) + 1 })
    return counts
  }, [visits])

  const filtered = useMemo(() => {
    if (activeCategory !== 'mlb') return []
    let list = stadiums.filter((s) => {
      const q = search.toLowerCase()
      if (q && !s.name.toLowerCase().includes(q) && !s.team.toLowerCase().includes(q) && !s.city.toLowerCase().includes(q)) return false
      if (filterLeague !== 'all' && s.league !== filterLeague) return false
      if (filterDivision !== 'all' && s.division !== filterDivision) return false
      if (filterVisited === 'visited' && !visitedIds.has(s.id)) return false
      if (filterVisited === 'unvisited' && visitedIds.has(s.id)) return false
      return true
    })
    list.sort((a, b) => (a[sortKey] as string).localeCompare(b[sortKey] as string))
    return list
  }, [stadiums, search, sortKey, filterLeague, filterDivision, filterVisited, visitedIds, activeCategory])

  const visitedCount = visitedIds.size
  const notVisitedCount = 30 - visitedCount

  const CATEGORIES: { key: Category; label: string }[] = [
    { key: 'mlb', label: 'MLB' },
    { key: 'historical', label: 'Historical' },
    { key: 'spring', label: 'Spring Training' },
  ]

  const VISIT_FILTERS: { key: FilterVisited; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: 30 },
    { key: 'visited', label: 'Visited', count: visitedCount },
    { key: 'unvisited', label: 'Not Yet', count: notVisitedCount },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#111111' }}>

      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
          backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', zIndex: 40,
        }}
      >
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#111827', letterSpacing: '-0.5px' }}>
            ⚾ Chasing 30
          </div>
        </div>
        <nav style={{ flex: 1, padding: '4px 12px' }}>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === '/stadiums'
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                  color: active ? '#1a472a' : '#6b7280',
                  backgroundColor: active ? 'rgba(26,71,42,0.08)' : 'transparent',
                  fontWeight: active ? 700 : 500, fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                <Icon size={20} color={active ? '#1a472a' : '#9ca3af'} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Progress
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#111827' }}>
            {visitedCount}
            <span style={{ fontWeight: 400, fontSize: 14, color: '#9ca3af' }}> / 30</span>
          </div>
          <div style={{ height: 4, backgroundColor: '#f3f4f6', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, transition: 'width 0.5s',
              width: `${(visitedCount / 30) * 100}%`,
              background: 'linear-gradient(90deg, #1a472a, #2d6a4f)',
            }} />
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="md:ml-[240px]" style={{ minHeight: '100vh', paddingBottom: 80 }}>

        {/* Green gradient header */}
        <div style={{ background: 'linear-gradient(180deg, #1a472a 0%, #2d6a4f 100%)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px 0' }}>

            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  Parks
                </h1>
                <p style={{ margin: '5px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.72)' }}>
                  {visitedCount} of 30 visited
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
                <button
                  onClick={() => { setShowSearch(v => !v); if (showSearch) setSearch('') }}
                  aria-label="Toggle search"
                  style={{
                    background: 'rgba(255,255,255,0.18)', border: 'none',
                    borderRadius: '50%', width: 36, height: 36,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {showSearch
                    ? <X size={17} color="white" />
                    : <Search size={17} color="white" />
                  }
                </button>
                <HeaderRing visited={visitedCount} total={30} />
              </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 8, paddingBottom: 18 }}>
              {CATEGORIES.map(({ key, label }) => {
                const active = activeCategory === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    style={{
                      padding: '7px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                      backgroundColor: active ? '#ffffff' : 'transparent',
                      color: active ? '#1a472a' : '#ffffff',
                      border: active ? 'none' : '1.5px solid rgba(255,255,255,0.5)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Filter row (white, sticky) */}
        <div style={{
          backgroundColor: '#ffffff', borderBottom: '1px solid #f3f4f6',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '10px 16px' }}>

            {/* Search input (toggled) */}
            {showSearch && (
              <div style={{ marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Search team, stadium, city..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '9px 14px', borderRadius: 8,
                    border: '1.5px solid #d1d5db', fontSize: 14,
                    backgroundColor: '#f9fafb', color: '#111827',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Chips + sort */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {VISIT_FILTERS.map(({ key, label, count }) => {
                const active = filterVisited === key
                return (
                  <button
                    key={key}
                    onClick={() => setFilterVisited(key)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                      backgroundColor: active ? '#111827' : 'transparent',
                      color: active ? '#ffffff' : '#6b7280',
                      border: active ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
                    }}
                  >
                    {label} <span style={{ fontWeight: 400 }}>[{count}]</span>
                  </button>
                )
              })}

              {/* Sort */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <select
                  value={filterLeague}
                  onChange={e => setFilterLeague(e.target.value as FilterLeague)}
                  style={{
                    padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                    fontSize: 13, color: '#6b7280', backgroundColor: '#ffffff', cursor: 'pointer',
                  }}
                >
                  <option value="all">All</option>
                  <option value="AL">AL</option>
                  <option value="NL">NL</option>
                </select>
                <select
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value as SortKey)}
                  style={{
                    padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                    fontSize: 13, color: '#6b7280', backgroundColor: '#ffffff', cursor: 'pointer',
                  }}
                >
                  <option value="team">Team</option>
                  <option value="name">Stadium</option>
                  <option value="state">State</option>
                  <option value="division">Division</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stadium list */}
        <div style={{ maxWidth: 800, margin: '0 auto', backgroundColor: '#ffffff' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#9ca3af', fontSize: 15 }}>
              Loading parks...
            </div>
          ) : activeCategory !== 'mlb' ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#9ca3af', fontSize: 15 }}>
              {activeCategory === 'historical'
                ? 'No historical ballparks tracked yet.'
                : 'No spring training parks tracked yet.'}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#9ca3af', fontSize: 15 }}>
              No parks match your filters.
            </div>
          ) : (
            filtered.map((stadium) => {
              const visited = visitedIds.has(stadium.id)
              const accent = TEAM_ACCENT[stadium.abbreviation] ?? '#1a472a'
              return (
                <Link
                  key={stadium.id}
                  href={`/stadiums/${stadium.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '14px 16px',
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: '#ffffff',
                      opacity: visited ? 1 : 0.9,
                    }}
                    className="parks-row"
                  >
                    {/* Left accent bar */}
                    <div style={{
                      width: 4, borderRadius: 2, alignSelf: 'stretch',
                      backgroundColor: accent, flexShrink: 0, marginRight: 14,
                    }} />

                    {/* Thumbnail + checkmark */}
                    <div style={{ position: 'relative', marginRight: 14, flexShrink: 0 }}>
                      <div style={{
                        width: 60, height: 60, borderRadius: 12,
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        <TeamLogo abbreviation={stadium.abbreviation} size={46} />
                      </div>
                      {visited && (
                        <div style={{
                          position: 'absolute', bottom: -4, right: -4,
                          width: 20, height: 20, borderRadius: '50%',
                          backgroundColor: '#22c55e',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '2px solid #ffffff',
                        }}>
                          <Check size={11} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', lineHeight: 1.2 }}>
                        {stadium.team}
                      </div>
                      <div style={{
                        fontSize: 14, color: '#6b7280', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {stadium.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {stadium.city}, {stadium.state}
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight size={18} color="#d1d5db" style={{ flexShrink: 0, marginLeft: 8 }} />
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </main>

      {/* ── Floating Map button ───────────────────────────────────── */}
      <Link
        href="/map"
        className="fixed right-4 z-50 bottom-20 md:bottom-6"
        style={{ textDecoration: 'none' }}
      >
        <div style={{
          backgroundColor: '#0f172a', color: '#ffffff',
          padding: '10px 20px', borderRadius: 24,
          fontWeight: 700, fontSize: 15,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          🗺 Map
        </div>
      </Link>

      {/* ── Mobile bottom tab bar ─────────────────────────────────── */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb',
          display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = href === '/stadiums'
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', textDecoration: 'none',
                padding: '10px 0', minHeight: 56,
                color: active ? '#1a472a' : '#9ca3af', gap: 3,
              }}
            >
              <Icon size={22} color={active ? '#1a472a' : '#9ca3af'} />
              {active && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1a472a' }}>
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <style>{`
        .parks-row:hover { background-color: #fafafa !important; }
      `}</style>
    </div>
  )
}
