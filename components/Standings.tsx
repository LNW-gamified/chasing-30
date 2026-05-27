'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'

const DIVISION_META: Record<number, { league: 'AL' | 'NL' }> = {
  200: { league: 'AL' },
  201: { league: 'AL' },
  202: { league: 'AL' },
  203: { league: 'NL' },
  204: { league: 'NL' },
  205: { league: 'NL' },
}

const ID_TO_ABBR: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC',  119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'OAK',
  134: 'PIT', 135: 'SD',  136: 'SEA', 137: 'SF',  138: 'STL',
  139: 'TB',  140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI',
  144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

const TEAM_PRIMARY: Record<string, string> = {
  ARI: '#A71930', ATL: '#CE1141', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#888D8D', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2C56', HOU: '#EB6E1F', KC:  '#004687',
  LAA: '#BA0021', LAD: '#005A9C', MIA: '#00A3E0', MIL: '#12284B',
  MIN: '#D31145', NYM: '#003087', NYY: '#003087', OAK: '#003831',
  PHI: '#E81828', PIT: '#27251F', SD:  '#2F241D', SF:  '#FD5A1E',
  SEA: '#005C5C', STL: '#C41E3A', TB:  '#092C5C', TEX: '#003278',
  TOR: '#134A8E', WSH: '#AB0003',
}

interface TeamRow {
  rank: number
  teamId: number
  teamAbbr: string
  teamName: string
  wins: number
  losses: number
  winPct: string
}

interface LeagueData {
  league: 'AL' | 'NL'
  teams: TeamRow[]
}

function fmtPct(raw: any): string {
  const n = parseFloat(String(raw ?? 0))
  if (isNaN(n) || n <= 0) return '.000'
  if (n >= 1) return '1.000'
  return n.toFixed(3).slice(1) // "0.567" → ".567"
}

async function loadStandings(): Promise<LeagueData[]> {
  const year = new Date().getFullYear()
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsType=regularSeason`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const data = await res.json()

    const alTeams: TeamRow[] = []
    const nlTeams: TeamRow[] = []

    for (const record of (data.records ?? [])) {
      const meta = DIVISION_META[record.division?.id as number]
      if (!meta) continue
      for (const tr of (record.teamRecords ?? [])) {
        const teamId: number = tr.team?.id
        const wins   = (tr.wins   as number) ?? 0
        const losses = (tr.losses as number) ?? 0
        const row: TeamRow = {
          rank:     0,
          teamId,
          teamAbbr: ID_TO_ABBR[teamId] ?? '',
          teamName: (tr.team?.name as string) ?? '',
          wins,
          losses,
          winPct:   fmtPct(tr.winningPercentage ?? (wins + losses > 0 ? wins / (wins + losses) : 0)),
        }
        if (meta.league === 'AL') alTeams.push(row)
        else                      nlTeams.push(row)
      }
    }

    const rank = (teams: TeamRow[]) =>
      [...teams]
        .sort((a, b) => {
          const d = parseFloat(b.winPct) - parseFloat(a.winPct)
          return d !== 0 ? d : b.wins - a.wins
        })
        .map((t, i) => ({ ...t, rank: i + 1 }))

    return [
      { league: 'AL', teams: rank(alTeams) },
      { league: 'NL', teams: rank(nlTeams) },
    ]
  } catch {
    return []
  }
}

interface Props {
  favAbbr: string | null
}

export default function Standings({ favAbbr }: Props) {
  const [leagues, setLeagues]         = useState<LeagueData[]>([])
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [minsAgo, setMinsAgo]         = useState(0)
  const [collapsed, setCollapsed]     = useState(false)

  const poll = useCallback(async () => {
    const data = await loadStandings()
    if (data.length > 0) {
      setLeagues(data)
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

  const updatedLabel = lastUpdated
    ? minsAgo === 0 ? 'Updated just now' : `Updated ${minsAgo}m ago`
    : null

  const al = leagues.find(l => l.league === 'AL')
  const nl = leagues.find(l => l.league === 'NL')

  return (
    <div style={{ marginTop: 24 }}>
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
            {al && <LeagueTable title="American League" teams={al.teams} favAbbr={favAbbr} />}
            {nl && <LeagueTable title="National League"  teams={nl.teams} favAbbr={favAbbr} />}
          </div>
        )
      )}
    </div>
  )
}

function LeagueTable({
  title, teams, favAbbr,
}: {
  title: string
  teams: TeamRow[]
  favAbbr: string | null
}) {
  return (
    <div style={{
      background: '#161B22', border: '1px solid #30363D',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Table header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0.6rem 1rem',
        borderBottom: '1px solid #30363D',
        fontSize: 11, fontWeight: 600, color: '#8B949E',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        <span style={{ width: 18, flexShrink: 0 }}>#</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>W</span>
        <span style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>L</span>
        <span style={{ width: 36, textAlign: 'right', flexShrink: 0 }}>PCT</span>
      </div>

      {teams.length === 0 ? (
        <div style={{ padding: '1rem', color: '#8B949E', fontSize: 13 }}>No data available</div>
      ) : (
        teams.map((team, i) => {
          const isFav  = favAbbr !== null && team.teamAbbr === favAbbr
          const accent = isFav ? (TEAM_PRIMARY[team.teamAbbr] ?? '#1F6FEB') : null
          return (
            <div
              key={team.teamId}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0.4rem 1rem',
                borderTop: i > 0 ? '1px solid rgba(48,54,61,0.5)' : undefined,
                borderLeft: accent ? `3px solid ${accent}` : '3px solid transparent',
                background: accent ? `${accent}0F` : 'transparent',
              }}
            >
              <span style={{
                fontSize: 11, color: '#484F58', width: 18,
                flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
              }}>
                {team.rank}
              </span>

              <TeamLogo abbreviation={team.teamAbbr} size={20} />

              <span style={{
                fontSize: 13, color: isFav ? '#E6EDF3' : '#C9D1D9',
                fontWeight: isFav ? 700 : 400,
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {team.teamName}
              </span>

              <span style={{
                fontSize: 12, color: '#8B949E',
                width: 22, textAlign: 'center', flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {team.wins}
              </span>
              <span style={{
                fontSize: 12, color: '#8B949E',
                width: 22, textAlign: 'center', flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {team.losses}
              </span>
              <span style={{
                fontSize: 12, color: isFav ? '#E6EDF3' : '#8B949E',
                fontWeight: isFav ? 600 : 400,
                width: 36, textAlign: 'right', flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {team.winPct}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
