'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

// Maps MLB team ID → abbreviation (reverse-indexed for fav team matching)
const ABBR_TO_ID: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112,
  CWS: 145, CIN: 113, CLE: 114, COL: 115, DET: 116,
  HOU: 117, KC:  118, LAA: 108, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYM: 121, NYY: 147, OAK: 133,
  PHI: 143, PIT: 134, SD:  135, SF:  137, SEA: 136,
  STL: 138, TB:  139, TEX: 140, TOR: 141, WSH: 120,
}

const DIVISION_META: Record<number, { league: 'AL' | 'NL'; div: 'East' | 'Central' | 'West' }> = {
  200: { league: 'AL', div: 'West'    },
  201: { league: 'AL', div: 'East'    },
  202: { league: 'AL', div: 'Central' },
  203: { league: 'NL', div: 'West'    },
  204: { league: 'NL', div: 'East'    },
  205: { league: 'NL', div: 'Central' },
}

interface TeamRow {
  rank: number
  teamId: number
  teamName: string
  wins: number
  losses: number
  gamesBack: string
}

interface DivisionData {
  league: 'AL' | 'NL'
  div: 'East' | 'Central' | 'West'
  teams: TeamRow[]
}

async function loadStandings(): Promise<DivisionData[]> {
  const year = new Date().getFullYear()
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsType=regularSeason`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const data = await res.json()
    const result: DivisionData[] = []
    for (const record of (data.records ?? [])) {
      const meta = DIVISION_META[record.division?.id as number]
      if (!meta) continue
      const teams: TeamRow[] = (record.teamRecords ?? []).map((tr: any, i: number) => ({
        rank:      i + 1,
        teamId:    tr.team?.id as number,
        teamName:  tr.team?.name as string ?? '',
        wins:      (tr.wins as number) ?? 0,
        losses:    (tr.losses as number) ?? 0,
        gamesBack: (tr.gamesBack as string) === '-' ? '—' : ((tr.gamesBack as string) ?? '—'),
      }))
      result.push({ league: meta.league, div: meta.div, teams })
    }
    return result
  } catch {
    return []
  }
}

interface Props {
  favAbbr: string | null
}

export default function Standings({ favAbbr }: Props) {
  const favTeamId = favAbbr ? (ABBR_TO_ID[favAbbr] ?? null) : null

  const [divisions, setDivisions]     = useState<DivisionData[]>([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [minsAgo, setMinsAgo]         = useState(0)
  const [collapsed, setCollapsed]     = useState(true)
  const [alDiv, setAlDiv]             = useState<'East' | 'Central' | 'West'>('East')
  const [nlDiv, setNlDiv]             = useState<'East' | 'Central' | 'West'>('East')

  // Expand by default on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) setCollapsed(false)
  }, [])

  const poll = useCallback(async () => {
    const data = await loadStandings()
    if (data.length > 0) {
      setDivisions(data)
      setLastUpdated(new Date())
      setMinsAgo(0)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [poll])

  useEffect(() => {
    if (!lastUpdated) return
    const id = setInterval(() => {
      setMinsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60000))
    }, 30_000)
    return () => clearInterval(id)
  }, [lastUpdated])

  const alDivs = divisions.filter(d => d.league === 'AL')
  const nlDivs = divisions.filter(d => d.league === 'NL')

  const updatedLabel = lastUpdated
    ? minsAgo === 0 ? 'Updated just now' : `Updated ${minsAgo}m ago`
    : null

  return (
    <div style={{ marginTop: 24 }}>
      {/* Section label row */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: collapsed ? 0 : '0.75rem', cursor: 'pointer',
        }}
      >
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#8B949E',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Standings
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {updatedLabel && !collapsed && (
            <span style={{ fontSize: 12, color: '#8B949E' }}>{updatedLabel}</span>
          )}
          {collapsed
            ? <ChevronDown size={15} style={{ color: '#8B949E' }} />
            : <ChevronUp   size={15} style={{ color: '#8B949E' }} />
          }
        </div>
      </div>

      {!collapsed && (
        loading ? (
          <div style={{ color: '#8B949E', fontSize: 13, paddingTop: 8 }}>Loading standings…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LeagueCard
              title="AMERICAN LEAGUE"
              divs={alDivs}
              activeDiv={alDiv}
              onDivChange={setAlDiv}
              favTeamId={favTeamId}
            />
            <LeagueCard
              title="NATIONAL LEAGUE"
              divs={nlDivs}
              activeDiv={nlDiv}
              onDivChange={setNlDiv}
              favTeamId={favTeamId}
            />
          </div>
        )
      )}
    </div>
  )
}

function LeagueCard({
  title, divs, activeDiv, onDivChange, favTeamId,
}: {
  title: string
  divs: DivisionData[]
  activeDiv: 'East' | 'Central' | 'West'
  onDivChange: (d: 'East' | 'Central' | 'West') => void
  favTeamId: number | null
}) {
  const TABS = ['East', 'Central', 'West'] as const
  const activeDivData = divs.find(d => d.div === activeDiv)

  return (
    <div style={{
      background: '#161B22', border: '1px solid #30363D',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #30363D' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#8B949E',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
        }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => onDivChange(tab)}
              style={{
                padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: activeDiv === tab ? '#1F6FEB' : 'rgba(48,54,61,0.7)',
                color: activeDiv === tab ? '#fff' : '#8B949E',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Team rows */}
      <div>
        {activeDivData?.teams.map((team, i) => {
          const isFav = favTeamId !== null && team.teamId === favTeamId
          return (
            <div
              key={team.teamId}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0.5rem 1rem',
                borderTop: i > 0 ? '1px solid #30363D' : undefined,
                borderLeft: isFav ? '3px solid #1F6FEB' : '3px solid transparent',
                background: isFav ? 'rgba(31,111,235,0.06)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 13, color: '#8B949E', width: 18, flexShrink: 0, textAlign: 'right' }}>
                {team.rank}
              </span>
              <span style={{
                fontSize: 14, color: '#E6EDF3', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {team.teamName}
              </span>
              <span style={{ fontSize: 14, color: '#8B949E', flexShrink: 0 }}>
                {team.wins}-{team.losses}
              </span>
              <span style={{ fontSize: 13, color: '#8B949E', width: 30, textAlign: 'right', flexShrink: 0 }}>
                {team.gamesBack}
              </span>
            </div>
          )
        }) ?? (
          <div style={{ padding: '1rem', color: '#8B949E', fontSize: 13 }}>No data available</div>
        )}
      </div>
    </div>
  )
}
