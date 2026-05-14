'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Search, Home, MapPin, Map, Trophy, Plane, X } from 'lucide-react'
import type { Stadium } from '@/types'
import TeamLogo from '@/components/TeamLogo'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterVisited = 'all' | 'visited' | 'unvisited'
type Category = 'mlb' | 'historical' | 'spring'
type SortKey = 'team' | 'name' | 'state' | 'division'
interface VisitRow { stadium_id: string; visit_date: string }

// ─── Team colors ──────────────────────────────────────────────────────────────

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

// ─── Real-world capacity & year fallbacks ─────────────────────────────────────

const STADIUM_INFO: Record<string, { capacity: number; opened: number }> = {
  ARI: { capacity: 48686, opened: 1998 }, ATL: { capacity: 41084, opened: 2017 },
  BAL: { capacity: 44970, opened: 1992 }, BOS: { capacity: 37755, opened: 1912 },
  CHC: { capacity: 41649, opened: 1914 }, CWS: { capacity: 40615, opened: 1991 },
  CIN: { capacity: 42319, opened: 2003 }, CLE: { capacity: 34830, opened: 1994 },
  COL: { capacity: 46897, opened: 1995 }, DET: { capacity: 41083, opened: 2000 },
  HOU: { capacity: 41168, opened: 2000 }, KC:  { capacity: 37903, opened: 1973 },
  LAA: { capacity: 45517, opened: 1966 }, LAD: { capacity: 56000, opened: 1962 },
  MIA: { capacity: 36742, opened: 2012 }, MIL: { capacity: 41900, opened: 2001 },
  MIN: { capacity: 38544, opened: 2010 }, NYM: { capacity: 41922, opened: 2009 },
  NYY: { capacity: 47309, opened: 2009 }, OAK: { capacity: 46765, opened: 1966 },
  PHI: { capacity: 43651, opened: 2004 }, PIT: { capacity: 38747, opened: 2001 },
  SD:  { capacity: 40162, opened: 2004 }, SF:  { capacity: 41265, opened: 2000 },
  SEA: { capacity: 47929, opened: 1999 }, STL: { capacity: 44383, opened: 2006 },
  TB:  { capacity: 25000, opened: 1990 }, TEX: { capacity: 40518, opened: 2020 },
  TOR: { capacity: 49286, opened: 1989 }, WSH: { capacity: 41313, opened: 2008 },
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Home',  href: '/dashboard',  icon: Home   },
  { label: 'Parks', href: '/stadiums',   icon: MapPin  },
  { label: 'Map',   href: '/map',        icon: Map     },
  { label: 'Goals', href: '/milestones', icon: Trophy  },
  { label: 'Trips', href: '/trips',      icon: Plane   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return d }
}

function fmtCap(n: number | null | undefined): string {
  return n ? n.toLocaleString() : '—'
}

// ─── Stadium card ─────────────────────────────────────────────────────────────

function StadiumCard({
  stadium, visited, visitDate,
}: {
  stadium: Stadium
  visited: boolean
  visitDate?: string
}) {
  const accent   = TEAM_ACCENT[stadium.abbreviation] ?? '#1F6FEB'
  const capacity = stadium.capacity ?? STADIUM_INFO[stadium.abbreviation]?.capacity ?? null
  const opened   = stadium.opened   ?? STADIUM_INFO[stadium.abbreviation]?.opened   ?? null

  return (
    <Link href={`/stadiums/${stadium.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div style={{
        backgroundColor: '#161B22',
        border: visited ? '1px solid rgba(63,185,80,0.45)' : '1px solid #30363D',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        opacity: visited ? 1 : 0.68,
        boxShadow: visited ? '0 0 14px rgba(63,185,80,0.12)' : 'none',
        transition: 'opacity 0.15s, border-color 0.15s',
        cursor: 'pointer',
      }}
        className="stadium-card"
      >
        {/* Visited checkmark badge */}
        {visited && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            width: 18, height: 18, borderRadius: '50%',
            backgroundColor: '#3FB950', border: '2px solid #161B22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: '#0B1117', fontWeight: 900, lineHeight: 1,
          }}>✓</div>
        )}

        {/* Team color accent bar */}
        <div style={{ height: 4, backgroundColor: accent, flexShrink: 0 }} />

        {/* Card body */}
        <div style={{
          padding: '12px 10px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', flex: 1, gap: 0,
        }}>

          {/* Logo */}
          <div style={{ marginBottom: 8, marginTop: 2 }}>
            <TeamLogo abbreviation={stadium.abbreviation} size={44} />
          </div>

          {/* Team name */}
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#E6EDF3',
            lineHeight: 1.2, marginBottom: 3,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            width: '100%',
          }}>
            {stadium.team}
          </div>

          {/* Stadium name */}
          <div style={{
            fontSize: 11, color: '#C9D1D9', lineHeight: 1.35, marginBottom: 2,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            width: '100%',
          }}>
            {stadium.name}
          </div>

          {/* City */}
          <div style={{ fontSize: 11, color: '#C9D1D9', marginBottom: 8 }}>
            {stadium.city}, {stadium.state}
          </div>

          {/* Capacity / Year */}
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 10 }}>
            {fmtCap(capacity)} cap · Est. {opened ?? '—'}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Visit state */}
          {visited ? (
            <div style={{ textAlign: 'center' }}>
              <span style={{
                display: 'inline-block',
                fontSize: 11, fontWeight: 700, color: '#3FB950',
                backgroundColor: 'rgba(63,185,80,0.12)',
                padding: '3px 10px', borderRadius: 999,
                marginBottom: visitDate ? 4 : 0,
              }}>
                Visited ✓
              </span>
              {visitDate && (
                <div style={{ fontSize: 11, color: '#C9D1D9' }}>
                  {fmtDate(visitDate)}
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: 'rgba(201,209,217,0.5)', fontStyle: 'italic' }}>
              Not Yet
            </span>
          )}

        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StadiumsPage() {
  const [stadiums, setStadiums]     = useState<Stadium[]>([])
  const [visits, setVisits]         = useState<VisitRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sortKey, setSortKey]       = useState<SortKey>('team')
  const [filterLeague, setFilterLeague] = useState<'all' | 'AL' | 'NL'>('all')
  const [filterVisited, setFilterVisited] = useState<FilterVisited>('all')
  const [activeCategory, setActiveCategory] = useState<Category>('mlb')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('stadiums').select('*').order('team'),
      supabase.from('stadium_visits').select('stadium_id, visit_date').order('visit_date', { ascending: false }),
    ]).then(([{ data: s }, { data: v }]) => {
      setStadiums(s ?? [])
      setVisits((v as VisitRow[]) ?? [])
      setLoading(false)
    })
  }, [])

  const visitedIds = useMemo(() => new Set(visits.map(v => v.stadium_id)), [visits])

  const latestVisit = useMemo(() => {
    const map: Record<string, string> = {}
    visits.forEach(v => { if (!map[v.stadium_id]) map[v.stadium_id] = v.visit_date })
    return map
  }, [visits])

  const visitedCount = visitedIds.size
  const pct = Math.round((visitedCount / 30) * 100)

  const filtered = useMemo(() => {
    if (activeCategory !== 'mlb') return []
    let list = stadiums.filter(s => {
      const q = search.toLowerCase()
      if (q && !s.name.toLowerCase().includes(q) && !s.team.toLowerCase().includes(q) && !s.city.toLowerCase().includes(q)) return false
      if (filterLeague !== 'all' && s.league !== filterLeague) return false
      if (filterVisited === 'visited' && !visitedIds.has(s.id)) return false
      if (filterVisited === 'unvisited' && visitedIds.has(s.id)) return false
      return true
    })
    list.sort((a, b) => (a[sortKey] as string).localeCompare(b[sortKey] as string))
    return list
  }, [stadiums, search, sortKey, filterLeague, filterVisited, visitedIds, activeCategory])

  const CATEGORIES: { key: Category; label: string }[] = [
    { key: 'mlb',        label: 'MLB'             },
    { key: 'historical', label: 'Historical'      },
    { key: 'spring',     label: 'Spring Training' },
  ]

  const VISIT_FILTERS: { key: FilterVisited; label: string; count: number }[] = [
    { key: 'all',       label: 'All',     count: 30                },
    { key: 'visited',   label: 'Visited', count: visitedCount      },
    { key: 'unvisited', label: 'Not Yet', count: 30 - visitedCount },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B1117', color: '#E6EDF3', overflowX: 'hidden' }}>

      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
          backgroundColor: '#0B1117', borderRight: '1px solid #30363D', zIndex: 40,
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #30363D' }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#E6EDF3' }}>⚾ Chasing 30</div>
          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>MLB Stadium Tracker</div>
        </div>
        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === '/stadiums'
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                  color: active ? '#E6EDF3' : '#8B949E',
                  backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                  fontWeight: active ? 600 : 400, fontSize: 15,
                  textDecoration: 'none',
                  borderLeft: active ? '3px solid #1F6FEB' : '3px solid transparent',
                }}
              >
                <Icon size={18} color={active ? '#1F6FEB' : '#8B949E'} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #30363D' }}>
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 6 }}>
            {visitedCount} / 30 · {pct}% complete
          </div>
          <div style={{ height: 4, backgroundColor: '#30363D', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: '#3FB950', transition: 'width 0.5s' }} />
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="md:ml-[240px]" style={{ minHeight: '100vh', paddingBottom: 80 }}>

        {/* ── Hero progress banner ─────────────────────────────── */}
        <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  My Parks
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#E6EDF3', lineHeight: 1.1, marginBottom: 4 }}>
                  {visitedCount} of 30 visited
                </div>
                <div style={{ fontSize: 14, color: '#8B949E' }}>
                  Chasing all 30 MLB ballparks
                </div>
              </div>
              {/* Search toggle */}
              <button
                onClick={() => { setShowSearch(v => !v); if (showSearch) setSearch('') }}
                aria-label="Toggle search"
                style={{
                  background: 'rgba(139,148,158,0.1)', border: '1px solid #30363D',
                  borderRadius: '50%', width: 36, height: 36, flexShrink: 0,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {showSearch ? <X size={16} color="#8B949E" /> : <Search size={16} color="#8B949E" />}
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ height: 8, backgroundColor: '#30363D', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: '#3FB950', transition: 'width 0.5s' }} />
            </div>

            {/* Quick stats */}
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#3FB950' }}>{visitedCount}</span>
                <span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>visited</span>
              </div>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3' }}>{30 - visitedCount}</span>
                <span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>remaining</span>
              </div>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#F5A623' }}>{pct}%</span>
                <span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Category tabs ────────────────────────────────────── */}
        <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {CATEGORIES.map(({ key, label }) => {
                const active = activeCategory === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    style={{
                      padding: '12px 18px', fontSize: 14, fontWeight: active ? 700 : 500,
                      cursor: 'pointer', background: 'none', border: 'none',
                      color: active ? '#E6EDF3' : '#8B949E',
                      borderBottom: active ? '2px solid #1F6FEB' : '2px solid transparent',
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Filters (sticky) ─────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          backgroundColor: '#0B1117', borderBottom: '1px solid #30363D',
        }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '10px 16px' }}>

            {showSearch && (
              <input
                type="text"
                placeholder="Search team, stadium, city..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, marginBottom: 10,
                  border: '1.5px solid #30363D', fontSize: 14,
                  backgroundColor: '#1C2430', color: '#E6EDF3',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Visit filter pills */}
              {VISIT_FILTERS.map(({ key, label, count }) => {
                const active = filterVisited === key
                return (
                  <button
                    key={key}
                    onClick={() => setFilterVisited(key)}
                    style={{
                      padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                      backgroundColor: active ? 'rgba(31,111,235,0.15)' : 'transparent',
                      color: active ? '#E6EDF3' : '#8B949E',
                      border: active ? '1.5px solid #1F6FEB' : '1.5px solid #30363D',
                    }}
                  >
                    {label} <span style={{ fontWeight: 400, fontSize: 12 }}>({count})</span>
                  </button>
                )
              })}

              {/* Sort + league controls */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <select
                  value={filterLeague}
                  onChange={e => setFilterLeague(e.target.value as 'all' | 'AL' | 'NL')}
                  style={{
                    padding: '5px 8px', borderRadius: 8, border: '1.5px solid #30363D',
                    fontSize: 13, color: '#8B949E', backgroundColor: '#1C2430', cursor: 'pointer',
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
                    padding: '5px 8px', borderRadius: 8, border: '1.5px solid #30363D',
                    fontSize: 13, color: '#8B949E', backgroundColor: '#1C2430', cursor: 'pointer',
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

        {/* ── Card grid ────────────────────────────────────────── */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#8B949E', fontSize: 15 }}>
              Loading parks…
            </div>
          ) : activeCategory !== 'mlb' ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#8B949E', fontSize: 15 }}>
              {activeCategory === 'historical'
                ? 'No historical ballparks tracked yet.'
                : 'No spring training parks tracked yet.'}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#8B949E', fontSize: 15 }}>
              No parks match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map(stadium => (
                <StadiumCard
                  key={stadium.id}
                  stadium={stadium}
                  visited={visitedIds.has(stadium.id)}
                  visitDate={latestVisit[stadium.id]}
                />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* ── Mobile bottom tab bar (flex md:hidden — no inline display) ── */}
      <div
        className="flex md:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          backgroundColor: 'rgba(11,17,23,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid #30363D',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
                color: active ? '#1F6FEB' : '#8B949E', gap: 3,
              }}
            >
              <Icon size={22} color={active ? '#1F6FEB' : '#8B949E'} strokeWidth={active ? 2.5 : 1.8} />
              {active && (
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#1F6FEB', lineHeight: 1 }}>
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <style>{`.stadium-card:hover { border-color: #484F58 !important; opacity: 1 !important; }`}</style>
    </div>
  )
}
