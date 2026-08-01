'use client'

import { useState, useEffect, useCallback } from 'react'
import TeamLogo from '@/components/TeamLogo'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { TEAM_PRIMARY } from '@/lib/team-colors'

// ─── Constants ────────────────────────────────────────────────────────────────

const ID_TO_ABBR: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC',  119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'OAK',
  134: 'PIT', 135: 'SD',  136: 'SEA', 137: 'SF',  138: 'STL',
  139: 'TB',  140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI',
  144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

const ABBR_TO_ID = Object.fromEntries(Object.entries(ID_TO_ABBR).map(([id, abbr]) => [abbr, parseInt(id)]))


// division id → { league, name }
const DIV: Record<number, { league: 'AL' | 'NL'; name: string }> = {
  200: { league: 'AL', name: 'AL West'    },
  201: { league: 'AL', name: 'AL East'    },
  202: { league: 'AL', name: 'AL Central' },
  203: { league: 'NL', name: 'NL West'    },
  204: { league: 'NL', name: 'NL East'    },
  205: { league: 'NL', name: 'NL Central' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PennantTeam {
  teamId: number
  abbr: string
  name: string
  wins: number
  losses: number
  divGB: string
  wcGB: string
  last10: string
  streak: string
  trend: 'up' | 'down' | 'flat'
  clinched: boolean
  clinchIndicator: string | null
  magicNumber: string | null
  eliminationNumber: string | null
  wildCardEliminationNumber: string | null
  divisionRank: number
  divisionId: number
  wildCardRank: number | null
}

interface PennantData {
  divisionName: string
  league: 'AL' | 'NL'
  division: PennantTeam[]
  wildCard: PennantTeam[]
  leaders: PennantTeam[]
}

// Display order for the division-leaders strip — matches the Standings section
const DIVISION_DISPLAY_ORDER = ['West', 'Central', 'East']

// ─── Fetch ────────────────────────────────────────────────────────────────────

function normGB(raw: any): string {
  if (raw == null || raw === '-' || raw === '') return '—'
  return String(raw)
}

async function loadPennantData(favAbbr: string): Promise<PennantData | null> {
  const favId = ABBR_TO_ID[favAbbr]
  if (!favId) return null

  const year = new Date().getFullYear()
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsTypes=regularSeason`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()

    // Find which division+league the fav team belongs to
    let favDivId = -1
    let favLeague: 'AL' | 'NL' | null = null
    let divisionName = ''
    for (const record of data.records ?? []) {
      const found = (record.teamRecords ?? []).find((t: any) => t.team?.id === favId)
      if (found) {
        favDivId   = record.division?.id ?? -1
        favLeague  = DIV[favDivId]?.league ?? null
        divisionName = DIV[favDivId]?.name ?? ''
        break
      }
    }
    if (favDivId === -1 || !favLeague) return null

    const division: PennantTeam[] = []
    const leagueAll: PennantTeam[] = []

    for (const record of data.records ?? []) {
      const divId = record.division?.id as number
      const divMeta = DIV[divId]
      if (!divMeta || divMeta.league !== favLeague) continue

      for (const tr of record.teamRecords ?? []) {
        const teamId = tr.team?.id as number
        const abbr   = ID_TO_ABBR[teamId] ?? ''
        const wins   = (tr.wins  as number) ?? 0
        const losses = (tr.losses as number) ?? 0

        // Last 10
        const l10 = (tr.records?.splitRecords ?? []).find((s: any) => s.type === 'lastTen')
        const last10 = l10 ? `${l10.wins}-${l10.losses}` : '—'

        // Trend from streak
        const sType = tr.streak?.streakType ?? ''
        const sNum  = (tr.streak?.streakNumber ?? 0) as number
        const trend: 'up' | 'down' | 'flat' =
          sType === 'wins'   && sNum >= 3 ? 'up' :
          sType === 'losses' && sNum >= 3 ? 'down' : 'flat'

        const magicNumber  = tr.magicNumber  && tr.magicNumber  !== '-' ? String(tr.magicNumber)  : null
        const elimNumber   = tr.eliminationNumber && tr.eliminationNumber !== '-' ? String(tr.eliminationNumber) : null
        const wcElimNumber = tr.wildCardEliminationNumber && tr.wildCardEliminationNumber !== '-' ? String(tr.wildCardEliminationNumber) : null
        const divRank      = parseInt(tr.divisionRank ?? '99')
        const wcRank       = tr.wildCardRank != null ? parseInt(tr.wildCardRank) : null

        const row: PennantTeam = {
          teamId, abbr,
          name: tr.team?.name ?? '',
          wins, losses,
          divGB: normGB(tr.gamesBack),
          wcGB:  normGB(tr.wildCardGamesBack),
          last10, streak: tr.streak?.streakCode ?? '',
          trend,
          clinched:          tr.clinched ?? false,
          clinchIndicator:   tr.clinchIndicator ?? null,
          magicNumber,
          eliminationNumber: elimNumber,
          wildCardEliminationNumber: wcElimNumber,
          divisionRank:      divRank,
          divisionId:        divId,
          wildCardRank:      wcRank != null && !isNaN(wcRank) ? wcRank : null,
        }

        if (divId === favDivId) division.push(row)
        leagueAll.push(row)
      }
    }

    // Sort division by rank
    division.sort((a, b) => a.divisionRank - b.divisionRank)

    // Wild card: use the API's own wildCardRank rather than re-deriving order
    // from the GB strings — MLB applies tiebreakers (head-to-head, etc.) that
    // can't be reconstructed from wins/losses alone. Division leaders have no
    // wildCardRank (they're not in the race), which excludes them for free.
    const wildCard = leagueAll
      .filter(t => t.wildCardRank != null)
      .sort((a, b) => (a.wildCardRank as number) - (b.wildCardRank as number))
      .slice(0, 6)

    // Division leaders: the #1 team in each of the league's 3 divisions,
    // ordered to match the Standings section (West, Central, East).
    const leaders = leagueAll
      .filter(t => t.divisionRank === 1)
      .sort((a, b) => {
        const orderOf = (t: PennantTeam) => DIVISION_DISPLAY_ORDER.findIndex(d => DIV[t.divisionId]?.name.endsWith(d))
        return orderOf(a) - orderOf(b)
      })

    return { divisionName, league: favLeague, division, wildCard, leaders }
  } catch {
    return null
  }
}

// ─── Interval helper ──────────────────────────────────────────────────────────

function pollInterval(): number {
  const h = new Date().getHours()
  // During game hours (noon–midnight): every 15 min; otherwise hourly
  return (h >= 12 && h < 24) ? 15 * 60 * 1000 : 60 * 60 * 1000
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const COL_W  = 28
const COL_L  = 28
const COL_GB = 36
const COL_L10 = 42
const COL_TREND = 24

function TableHeader({ gbLabel }: { gbLabel: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '5px 12px',
      borderBottom: '1px solid #30363D',
      fontSize: 12, fontWeight: 700, color: '#8B949E',
      textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>
      <span style={{ flex: 1 }} />
      <span style={{ width: COL_W,    textAlign: 'center', flexShrink: 0 }}>W</span>
      <span style={{ width: COL_L,    textAlign: 'center', flexShrink: 0 }}>L</span>
      <span style={{ width: COL_GB,   textAlign: 'right',  flexShrink: 0 }}>{gbLabel}</span>
      <span style={{ width: COL_L10,  textAlign: 'right',  flexShrink: 0 }}>L10</span>
      <span style={{ width: COL_TREND, flexShrink: 0 }} />
    </div>
  )
}

function TeamRow({
  team, isFav, gbValue, showCutline,
}: {
  team: PennantTeam
  isFav: boolean
  gbValue: string
  showCutline: boolean
}) {
  const accent = isFav ? (TEAM_PRIMARY[team.abbr] ?? '#1F6FEB') : null

  const clinchBadge = (() => {
    if (!team.clinchIndicator) return null
    if (team.clinchIndicator === 'x' || team.clinchIndicator === 'z')
      return { label: 'DIV', color: '#3FB950' }
    if (team.clinchIndicator === 'y')
      return { label: 'WC', color: '#58A6FF' }
    if (team.clinchIndicator === 'e')
      return { label: 'ELIM', color: '#F85149' }
    return null
  })()

  return (
    <>
      {showCutline && (
        <div style={{
          borderTop: '1px dashed rgba(248,81,73,0.3)',
          margin: '0 12px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F85149', letterSpacing: '0.08em', padding: '2px 0' }}>
            ── WC LINE ──
          </span>
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 12px',
        borderLeft: accent ? `3px solid ${accent}` : '3px solid transparent',
        background: accent ? `${accent}12` : 'transparent',
      }}>
        {/* Logo + name */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <TeamLogo abbreviation={team.abbr} size={20} />
          <span style={{
            fontSize: 13, fontWeight: isFav ? 700 : 500,
            color: isFav ? '#E6EDF3' : '#C9D1D9',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {team.abbr}
          </span>
          {clinchBadge && (
            <span style={{
              fontSize: 13, fontWeight: 800, padding: '1px 5px', borderRadius: 20,
              color: clinchBadge.color, backgroundColor: `${clinchBadge.color}18`,
              border: `1px solid ${clinchBadge.color}44`, flexShrink: 0,
            }}>
              {clinchBadge.label}
            </span>
          )}
          {team.eliminationNumber && !clinchBadge && (
            <span style={{
              fontSize: 13, fontWeight: 700, padding: '1px 5px', borderRadius: 20, flexShrink: 0,
              color: '#F85149', backgroundColor: 'rgba(248,81,73,0.08)',
              border: '1px solid rgba(248,81,73,0.25)',
            }}>
              E{team.eliminationNumber}
            </span>
          )}
        </div>

        {/* Stats */}
        <span style={{ width: COL_W,  textAlign: 'center', flexShrink: 0, fontSize: 12, color: '#8B949E', fontVariantNumeric: 'tabular-nums' }}>{team.wins}</span>
        <span style={{ width: COL_L,  textAlign: 'center', flexShrink: 0, fontSize: 12, color: '#8B949E', fontVariantNumeric: 'tabular-nums' }}>{team.losses}</span>
        <span style={{
          width: COL_GB, textAlign: 'right', flexShrink: 0, fontSize: 12, fontVariantNumeric: 'tabular-nums',
          color: gbValue === '—' ? '#F5A623' : '#8B949E', fontWeight: gbValue === '—' ? 700 : 400,
        }}>
          {gbValue}
        </span>
        <span style={{ width: COL_L10, textAlign: 'right', flexShrink: 0, fontSize: 13, color: '#8B949E', fontVariantNumeric: 'tabular-nums' }}>
          {team.last10}
        </span>
        <span style={{ width: COL_TREND, textAlign: 'center', flexShrink: 0 }}>
          {team.trend === 'up'   && <TrendingUp   size={13} color="#3FB950" strokeWidth={2.5} />}
          {team.trend === 'down' && <TrendingDown size={13} color="#F85149" strokeWidth={2.5} />}
          {team.trend === 'flat' && <Minus        size={13} color="#8B949E" strokeWidth={2} />}
        </span>
      </div>
    </>
  )
}

function FavStatusCard({ division, divisionName, favAbbr }: { division: PennantTeam[]; divisionName: string; favAbbr: string }) {
  const favTeam = division.find(t => t.abbr === favAbbr)
  if (!favTeam) return null

  const leader   = division[0]
  const runnerUp = division[1]
  const isLeader   = favTeam.divisionRank === 1
  const clinchedDivision = favTeam.clinchIndicator === 'x' || favTeam.clinchIndicator === 'z'
  const eliminated = favTeam.clinchIndicator === 'e'

  let bigNumber: string | null = null
  let bigLabel = ''
  let headline = ''
  let detail = ''

  if (eliminated) {
    headline = `${favTeam.name} eliminated`
    detail = `Their shot at the ${divisionName} and a Wild Card spot is over for this season.`
  } else if (clinchedDivision) {
    headline = `${favTeam.name} clinched the ${divisionName}! 🎉`
    detail = `Champs — on to October.`
  } else if (isLeader) {
    bigNumber = favTeam.magicNumber
    bigLabel = 'Magic Number'
    headline = `${favTeam.name} lead the ${divisionName}`
    detail = runnerUp
      ? `Any combination of ${favTeam.abbr} wins + ${runnerUp.abbr} losses adding up to ${favTeam.magicNumber ?? '—'} clinches it.`
      : `${favTeam.magicNumber ?? '—'} combined wins/losses clinches the division.`
  } else {
    bigNumber = favTeam.eliminationNumber
    bigLabel = 'Elimination #'
    headline = `${favTeam.name} chasing ${leader?.name ?? 'the leader'}`
    detail = [
      favTeam.eliminationNumber ? `${favTeam.eliminationNumber} away from being knocked out of the ${divisionName} race.` : null,
      favTeam.wildCardEliminationNumber ? `Wild Card elimination #: ${favTeam.wildCardEliminationNumber}.` : null,
    ].filter(Boolean).join(' ')
  }

  return (
    <div style={{
      background: '#161B22', border: '1px solid #30363D', borderRadius: 12,
      padding: 16, display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <TeamLogo abbreviation={favTeam.abbr} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 2 }}>{headline}</div>
        <div style={{ fontSize: 12.5, color: '#8B949E', lineHeight: 1.4 }}>{detail}</div>
      </div>
      {bigNumber && (
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div className="rank-badge-glow" style={{ fontSize: 30, fontWeight: 900, color: '#F5A623', lineHeight: 1 }}>
            {bigNumber}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8B949E', letterSpacing: '0.06em', marginTop: 2 }}>
            {bigLabel}
          </div>
        </div>
      )}
    </div>
  )
}

function DivisionLeadersStrip({ leaders, favAbbr }: { leaders: PennantTeam[]; favAbbr: string }) {
  return (
    <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #30363D', background: '#1C2430' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3' }}>Division Leaders</span>
      </div>
      {leaders.map((team, i) => {
        const isFav   = team.abbr === favAbbr
        const accent  = isFav ? (TEAM_PRIMARY[team.abbr] ?? '#1F6FEB') : null
        const divName = DIV[team.divisionId]?.name ?? ''
        return (
          <div
            key={team.teamId}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              borderTop: i > 0 ? '1px solid rgba(48,54,61,0.5)' : undefined,
              borderLeft: accent ? `3px solid ${accent}` : '3px solid transparent',
              background: accent ? `${accent}12` : 'transparent',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', width: 72, flexShrink: 0 }}>{divName}</span>
            <TeamLogo abbreviation={team.abbr} size={20} />
            <span style={{
              fontSize: 13, fontWeight: isFav ? 700 : 500,
              color: isFav ? '#E6EDF3' : '#C9D1D9', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {team.name}
            </span>
            <span style={{ fontSize: 12, color: '#8B949E', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {team.wins}-{team.losses}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PennantRace({ favAbbr }: { favAbbr: string }) {
  const [data, setData]           = useState<PennantData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [minsAgo, setMinsAgo]     = useState(0)

  const poll = useCallback(async () => {
    const result = await loadPennantData(favAbbr)
    if (result) { setData(result); setLastUpdated(new Date()); setMinsAgo(0) }
    setLoading(false)
  }, [favAbbr])

  // Self-scheduling timer that adjusts interval based on time of day
  useEffect(() => {
    poll()
    let timerId: ReturnType<typeof setTimeout>
    const schedule = () => {
      timerId = setTimeout(() => { poll(); schedule() }, pollInterval())
    }
    schedule()
    return () => clearTimeout(timerId)
  }, [poll])

  // "Updated X min ago" counter
  useEffect(() => {
    if (!lastUpdated) return
    const id = setInterval(
      () => setMinsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60_000)),
      30_000,
    )
    return () => clearInterval(id)
  }, [lastUpdated])

  const updLabel = lastUpdated
    ? minsAgo === 0 ? 'Updated just now' : `Updated ${minsAgo}m ago`
    : null

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
        paddingLeft: 14, borderLeft: '3px solid #F5A623',
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
          🏆 The Pennant Race
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {updLabel && <span style={{ fontSize: 13, color: '#8B949E' }}>{updLabel}</span>}
          <button
            onClick={poll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', display: 'flex', padding: 2 }}
            title="Refresh"
          >
            <RefreshCw size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#8B949E', fontSize: 13, paddingTop: 4 }}>Loading standings…</div>
      ) : !data ? (
        <div style={{ color: '#8B949E', fontSize: 13 }}>Standings unavailable.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Fav team status: magic number / elimination countdown ── */}
          <FavStatusCard division={data.division} divisionName={data.divisionName} favAbbr={favAbbr} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* ── Division Leaders ───────────────────────────────── */}
            <DivisionLeadersStrip leaders={data.leaders} favAbbr={favAbbr} />

            {/* ── Wild Card ──────────────────────────────────────── */}
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                padding: '8px 12px', borderBottom: '1px solid #30363D',
                background: '#1C2430',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3' }}>
                  {data.league} Wild Card
                </span>
              </div>
              <TableHeader gbLabel="WC GB" />
              {data.wildCard.map((team, i) => (
                <TeamRow
                  key={team.teamId}
                  team={team}
                  isFav={team.abbr === favAbbr}
                  gbValue={team.wcGB}
                  showCutline={i === 3}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
