'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { Search, Check, ChevronRight } from 'lucide-react'
import type { Stadium, StadiumVisit } from '@/types'
import TeamLogo from '@/components/TeamLogo'

type SortKey = 'name' | 'team' | 'state' | 'league' | 'division'
type FilterLeague = 'all' | 'AL' | 'NL'
type FilterDivision = 'all' | 'East' | 'Central' | 'West'
type FilterVisited = 'all' | 'visited' | 'unvisited'

const TEAM_GRADIENTS: Record<string, [string, string]> = {
  LAA: ['#003263', '#BA0021'], ARI: ['#A71930', '#1A1A1A'],
  BAL: ['#1A1A1A', '#DF4601'], BOS: ['#0C2340', '#BD3039'],
  CHC: ['#0E3386', '#CC3433'], CWS: ['#27251F', '#C4CED4'],
  CIN: ['#C6011F', '#1A1A1A'], CLE: ['#00385D', '#E31937'],
  COL: ['#33006F', '#C4CED4'], DET: ['#0C2C56', '#FA4616'],
  HOU: ['#002D62', '#EB6E1F'], KC:  ['#004687', '#BD9B60'],
  LAD: ['#005A9C', '#EF3E42'], MIA: ['#00A3E0', '#EF3340'],
  MIL: ['#12284B', '#FFC52F'], MIN: ['#002B5C', '#D31145'],
  NYM: ['#002D72', '#FF5910'], NYY: ['#003087', '#C4CED4'],
  OAK: ['#003831', '#EFB21E'], PHI: ['#002D72', '#E81828'],
  PIT: ['#27251F', '#FDB827'], SD:  ['#2F241D', '#FFC425'],
  SF:  ['#27251F', '#FD5A1E'], SEA: ['#0C2C56', '#005C5C'],
  STL: ['#0C2340', '#C41E3A'], TB:  ['#092C5C', '#8FBCE6'],
  TEX: ['#003278', '#C0111F'], TOR: ['#134A8E', '#1D2D5C'],
  WSH: ['#14225A', '#AB0003'], ATL: ['#13274F', '#CE1141'],
}

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
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: '#ffffff' }}>
          Stadiums
        </h1>
        <p className="text-base mt-0.5" style={{ color: '#64748b' }}>
          {visitedCount} of 30 visited
        </p>
      </div>

      {/* Progress strip */}
      <div className="mb-5">
        <div className="flex justify-between text-base mb-1.5" style={{ color: '#64748b' }}>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>{visitedCount} visited</span>
          <span>{30 - visitedCount} remaining</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${(visitedCount / 30) * 100}%`,
              background: 'linear-gradient(90deg, #16a34a, #22c55e)',
              boxShadow: visitedCount > 0 ? '0 0 12px rgba(34,197,94,0.4)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search stadium, team, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filters-scroll flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
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

      <div className="text-base mb-4" style={{ color: '#64748b' }}>
        Showing {filtered.length} of 30 parks
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#64748b' }}>
          Loading stadiums...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          {filtered.map((stadium) => {
            const visited = visitedIds.has(stadium.id)
            const colors = TEAM_GRADIENTS[stadium.abbreviation] ?? ['#0f1729', '#131d35']
            return (
              <Link
                key={stadium.id}
                href={`/stadiums/${stadium.id}`}
                className="card card-hover flex items-stretch overflow-hidden"
                style={{
                  height: 88,
                  ...(visited
                    ? {
                        borderLeft: '3px solid #22c55e',
                        boxShadow: '0 0 24px rgba(34,197,94,0.08), 0 4px 24px rgba(0,0,0,0.25)',
                      }
                    : {}),
                }}
              >
                {/* Team color strip */}
                <div
                  style={{
                    width: 76,
                    background: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.25)',
                  }} />
                  <TeamLogo
                    abbreviation={stadium.abbreviation}
                    size={46}
                    style={{ position: 'relative', zIndex: 1 }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex items-center gap-3 px-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base truncate" style={{ color: '#ffffff' }}>
                      {stadium.name}
                    </div>
                    <div className="text-base truncate mt-0.5" style={{ color: '#94a3b8' }}>
                      {stadium.team}
                    </div>
                    <div className="flex gap-2 mt-1 items-center">
                      <span className="badge badge-blue" style={{ fontSize: '0.72rem', padding: '1px 7px' }}>
                        {stadium.league} {stadium.division}
                      </span>
                      <span className="text-base" style={{ color: '#4a5568' }}>
                        {stadium.city}, {stadium.state}
                      </span>
                    </div>
                  </div>

                  {/* Right: visited badge */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {visited ? (
                      <div className="stamp-visited">
                        <div style={{
                          border: '1.5px dashed rgba(34,197,94,0.65)',
                          backgroundColor: 'rgba(34,197,94,0.08)',
                          borderRadius: 4,
                          padding: '3px 8px',
                          transform: 'rotate(-3deg)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          <Check size={11} style={{ color: '#22c55e', strokeWidth: 3 }} />
                          <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 700, letterSpacing: '0.1em' }}>
                            VISITED
                          </span>
                        </div>
                        {visitCounts[stadium.id] > 0 && (
                          <div className="text-base text-right mt-1" style={{ color: '#22c55e', fontWeight: 600 }}>
                            {visitCounts[stadium.id]}×
                          </div>
                        )}
                      </div>
                    ) : (
                      <ChevronRight size={18} style={{ color: '#4a5568' }} />
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
