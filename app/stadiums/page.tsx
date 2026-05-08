'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { Search, Check, Circle, ChevronRight } from 'lucide-react'
import type { Stadium, StadiumVisit } from '@/types'
import TeamLogo from '@/components/TeamLogo'

type SortKey = 'name' | 'team' | 'state' | 'league' | 'division'
type FilterLeague = 'all' | 'AL' | 'NL'
type FilterDivision = 'all' | 'East' | 'Central' | 'West'
type FilterVisited = 'all' | 'visited' | 'unvisited'

export default function StadiumsPage() {
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [visits, setVisits] = useState<StadiumVisit[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [filterLeague, setFilterLeague] = useState<FilterLeague>('all')
  const [filterDivision, setFilterDivision] = useState<FilterDivision>('all')
  const [filterVisited, setFilterVisited] = useState<FilterVisited>('all')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('stadiums').select('*').order('name'),
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
    let list = stadiums.filter((s) => {
      const q = search.toLowerCase()
      if (q && !s.name.toLowerCase().includes(q) && !s.team.toLowerCase().includes(q) && !s.city.toLowerCase().includes(q)) return false
      if (filterLeague !== 'all' && s.league !== filterLeague) return false
      if (filterDivision !== 'all' && s.division !== filterDivision) return false
      if (filterVisited === 'visited' && !visitedIds.has(s.id)) return false
      if (filterVisited === 'unvisited' && visitedIds.has(s.id)) return false
      return true
    })

    list.sort((a, b) => {
      const av = a[sortKey] as string
      const bv = b[sortKey] as string
      return av.localeCompare(bv)
    })

    return list
  }, [stadiums, visits, search, sortKey, filterLeague, filterDivision, filterVisited, visitedIds])

  const visitedCount = visitedIds.size

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
          Stadiums
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a8b8c8' }}>
          {visitedCount} of 30 visited
        </p>
      </div>

      {/* Progress bar */}
      <div className="card p-4 mb-6">
        <div className="flex justify-between text-xs mb-2" style={{ color: '#a8b8c8' }}>
          <span>{visitedCount} visited</span>
          <span>{30 - visitedCount} remaining</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 8, backgroundColor: '#1f2937' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(visitedCount / 30) * 100}%`, backgroundColor: '#22c55e' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        {/* Search — full width on all screens */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a8b8c8' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2rem' }}
            placeholder="Search stadium, team, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter selects — horizontal scroll on mobile */}
        <div className="filters-scroll flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <select className="input flex-shrink-0" style={{ width: 'auto', minWidth: '8rem' }} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="name">Sort: Name</option>
            <option value="team">Sort: Team</option>
            <option value="state">Sort: State</option>
            <option value="league">Sort: League</option>
            <option value="division">Sort: Division</option>
          </select>

          <select className="input flex-shrink-0" style={{ width: 'auto', minWidth: '5.5rem' }} value={filterLeague} onChange={(e) => setFilterLeague(e.target.value as FilterLeague)}>
            <option value="all">All Leagues</option>
            <option value="AL">AL</option>
            <option value="NL">NL</option>
          </select>

          <select className="input flex-shrink-0" style={{ width: 'auto', minWidth: '6.5rem' }} value={filterDivision} onChange={(e) => setFilterDivision(e.target.value as FilterDivision)}>
            <option value="all">All Divisions</option>
            <option value="East">East</option>
            <option value="Central">Central</option>
            <option value="West">West</option>
          </select>

          <select className="input flex-shrink-0" style={{ width: 'auto', minWidth: '6.5rem' }} value={filterVisited} onChange={(e) => setFilterVisited(e.target.value as FilterVisited)}>
            <option value="all">All</option>
            <option value="visited">Visited</option>
            <option value="unvisited">Not Visited</option>
          </select>
        </div>
      </div>

      {/* Count */}
      <div className="text-xs mb-4" style={{ color: '#a8b8c8' }}>
        Showing {filtered.length} of 30 stadiums
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: '#a8b8c8' }}>
          Loading stadiums...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((stadium) => {
            const visited = visitedIds.has(stadium.id)
            return (
              <Link
                key={stadium.id}
                href={`/stadiums/${stadium.id}`}
                className="card card-hover p-4 flex items-center gap-3"
              >
                {/* Visited stamp or empty placeholder */}
                <div className="flex-shrink-0" style={{ width: 44 }}>
                  {visited ? (
                    <div className="stamp-visited">
                      <div style={{
                        width: 44,
                        height: 26,
                        borderRadius: 3,
                        border: '1.5px dashed rgba(34,197,94,0.7)',
                        backgroundColor: 'rgba(34,197,94,0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        transform: 'rotate(-4deg)',
                      }}>
                        <Check size={10} style={{ color: '#22c55e', strokeWidth: 3 }} />
                        <span style={{
                          fontSize: '0.62rem',
                          color: '#22c55e',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          fontFamily: 'monospace',
                          lineHeight: 1,
                        }}>VISITED</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      width: 44,
                      height: 26,
                      borderRadius: 3,
                      border: '1.5px dashed #2d3748',
                      opacity: 0.4,
                    }} />
                  )}
                </div>

                {/* Content with team logo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <TeamLogo abbreviation={stadium.abbreviation} size={30} />
                    <div className="font-semibold text-sm truncate" style={{ color: '#f1f5f9' }}>
                      {stadium.name}
                    </div>
                  </div>
                  <div className="text-xs truncate" style={{ color: '#a8b8c8' }}>
                    {stadium.team}
                  </div>
                  <div className="flex gap-2 mt-1 items-center flex-wrap">
                    <span className="badge badge-blue" style={{ fontSize: '0.82rem' }}>
                      {stadium.league}
                    </span>
                    <span className="badge badge-gray" style={{ fontSize: '0.82rem' }}>
                      {stadium.division}
                    </span>
                    <span className="text-xs" style={{ color: '#a8b8c8' }}>
                      {stadium.city}, {stadium.state}
                    </span>
                    {visited && visitCounts[stadium.id] > 0 && (
                      <span className="text-xs font-medium" style={{ color: '#22c55e' }}>
                        {visitCounts[stadium.id]} game{visitCounts[stadium.id] !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} style={{ color: '#536476', flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
