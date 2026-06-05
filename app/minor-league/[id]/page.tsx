'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft, Users, CalendarDays, Trophy, Share2, Plus, MessageSquare,
  Building2, Map, ChevronRight, CloudRain, Wind, Save, Pencil, ExternalLink,
} from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'
import MiLBLogo from '@/components/MiLBLogo'
import BaseballLifeForm from '@/components/BaseballLifeForm'
import { TEAM_BTN_COLOR, TEAM_GRADIENTS } from '@/lib/team-colors'
import { formatDate } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MinorLeagueStadium {
  id: string
  name: string
  team: string
  abbreviation: string
  city: string
  state: string
  lat: number | null
  lng: number | null
  capacity: number | null
  opened: number | null
  surface: string | null
  level: string
  affiliate: string
  affiliate_full: string
  description: string | null
  address: string | null
  website_url: string | null
  milb_team_id: number | null
  image_url: string | null
}

interface BleEntry {
  id: string
  visit_date: string
  opponent: string | null
  home_team: string | null
  away_team: string | null
  final_score_home: number | null
  final_score_away: number | null
  ticket_section: string | null
  ticket_row: string | null
  ticket_seats: string[] | null
  notes: string | null
  moments: string[] | null
  weather_temp: string | null
  weather_conditions: string | null
}

interface MiLBGame {
  gamePk: number
  gameDate: string
  awayTeam: string
  homeTeam: string
  promotions: string[]
}

interface RosterPlayer {
  id: number
  name: string
  jerseyNumber: string | null
  position: string
  positionType: string
}

interface StandingTeam {
  teamId: number
  teamName: string
  wins: number
  losses: number
  pct: string
  gamesBack: string
}

interface FoodItem {
  id: string
  item_name: string
  description: string | null
  is_classic: boolean
  active: boolean
  season_year: number | null
}

interface WeatherRow {
  month: number
  avg_high_temp: number
  avg_precip_days: number
  avg_wind_speed: number
  rating: 'great' | 'good' | 'fair' | 'avoid'
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const BASEBALL_MONTHS = [4, 5, 6, 7, 8, 9, 10]
const RATING_COLOR: Record<string, string> = { great: '#3FB950', good: '#58A6FF', fair: '#F5A623', avoid: '#F85149' }
const RATING_LABEL: Record<string, string> = { great: '🟢 Great', good: '🔵 Good', fair: '🟡 Fair', avoid: '🔴 Avoid' }
const RATING_PRIORITY: Record<string, number> = { great: 4, good: 3, fair: 2, avoid: 1 }

type ActiveTab = 'games-witnessed' | 'game-day-intel' | 'stadium-info'

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionTitle({ Icon, children }: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Icon size={17} color="#8B949E" strokeWidth={2} />
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#E6EDF3' }}>{children}</h2>
    </div>
  )
}

// ── MiLB API ───────────────────────────────────────────────────────────────────

async function fetchMiLBUpcomingGames(milbTeamId: number): Promise<MiLBGame[]> {
  const today = new Date().toISOString().split('T')[0]
  const end   = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
  const url   = `https://statsapi.mlb.com/api/v1/schedule?sportId=12&teamId=${milbTeamId}&startDate=${today}&endDate=${end}&hydrate=game(promotions)`
  try {
    const res  = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const games: MiLBGame[] = []
    for (const date of data.dates ?? []) {
      for (const game of date.games ?? []) {
        if (game.teams?.home?.team?.id !== milbTeamId) continue
        games.push({
          gamePk:     game.gamePk,
          gameDate:   game.gameDate,
          homeTeam:   game.teams.home.team.name,
          awayTeam:   game.teams.away.team.name,
          promotions: (game.promotions ?? []).map((p: any) => p.name).filter(Boolean),
        })
      }
    }
    return games.slice(0, 12)
  } catch { return [] }
}

async function fetchMiLBLeagueId(milbTeamId: number): Promise<number | null> {
  try {
    const res  = await fetch(`https://statsapi.mlb.com/api/v1/teams/${milbTeamId}?hydrate=league`)
    if (!res.ok) return null
    const data = await res.json()
    return data.teams?.[0]?.league?.id ?? null
  } catch { return null }
}

async function fetchMiLBStandings(leagueId: number, currentTeamId: number): Promise<StandingTeam[]> {
  try {
    const year = new Date().getFullYear()
    const res  = await fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=${leagueId}&season=${year}`)
    if (!res.ok) return []
    const data = await res.json()
    const teams: StandingTeam[] = []
    for (const record of data.records ?? []) {
      for (const tr of record.teamRecords ?? []) {
        teams.push({
          teamId:    tr.team.id,
          teamName:  tr.team.name,
          wins:      tr.wins,
          losses:    tr.losses,
          pct:       tr.leagueRecord?.pct ?? '.000',
          gamesBack: tr.gamesBack === '-' ? '--' : String(tr.gamesBack),
        })
      }
    }
    teams.sort((a, b) => {
      const pd = parseFloat(b.pct) - parseFloat(a.pct)
      return pd !== 0 ? pd : b.wins - a.wins
    })
    return teams
  } catch { return [] }
}

async function fetchMiLBRoster(milbTeamId: number): Promise<RosterPlayer[]> {
  try {
    const year = new Date().getFullYear()
    const res  = await fetch(`https://statsapi.mlb.com/api/v1/teams/${milbTeamId}/roster?season=${year}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.roster ?? []).map((p: any) => ({
      id:           p.person.id,
      name:         p.person.fullName,
      jerseyNumber: p.jerseyNumber ?? null,
      position:     p.position?.abbreviation ?? '',
      positionType: p.position?.type ?? '',
    }))
  } catch { return [] }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MinorLeagueDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [stadium,      setStadium]      = useState<MinorLeagueStadium | null>(null)
  const [visits,       setVisits]       = useState<BleEntry[]>([])
  const [food,         setFood]         = useState<FoodItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('games-witnessed')
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [showForm,     setShowForm]     = useState(false)
  const [heroPhotoError, setHeroPhotoError] = useState(false)

  // Game Day Intel
  const [upcomingGames,  setUpcomingGames]  = useState<MiLBGame[]>([])
  const [weather,        setWeather]        = useState<WeatherRow[] | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [intelSubTab,    setIntelSubTab]    = useState<'food' | 'souvenirs'>('food')

  // Stadium Info
  const [roster,               setRoster]               = useState<RosterPlayer[]>([])
  const [standings,            setStandings]            = useState<StandingTeam[]>([])
  const [affiliateMlbStadiumId, setAffiliateMlbStadiumId] = useState<string | null>(null)
  const [stadiumNote,          setStadiumNote]          = useState('')
  const [editingNote,          setEditingNote]          = useState(false)
  const [noteInput,            setNoteInput]            = useState('')
  const [savingNote,           setSavingNote]           = useState(false)

  async function load() {
    const supabase = createClient()
    const [
      { data: s },
      { data: v },
      { data: f },
      { data: n },
    ] = await Promise.all([
      supabase.from('minor_league_stadiums').select('*').eq('id', id).single(),
      supabase.from('baseball_life_entries')
        .select('id,visit_date,opponent,home_team,away_team,final_score_home,final_score_away,ticket_section,ticket_row,ticket_seats,notes,moments,weather_temp,weather_conditions')
        .eq('category', 'minor_league')
        .eq('minor_league_stadium_id', id)
        .order('visit_date', { ascending: false }),
      supabase.from('minor_league_food').select('*').eq('stadium_id', id),
      supabase.from('minor_league_notes').select('notes').eq('stadium_id', id).maybeSingle(),
    ])

    setStadium(s)
    setVisits((v ?? []) as BleEntry[])
    setFood((f ?? []) as FoodItem[])
    const note = (n as any)?.notes ?? ''
    setStadiumNote(note)
    setNoteInput(note)
    setLoading(false)

    if (s?.affiliate) {
      supabase.from('stadiums').select('id').eq('abbreviation', s.affiliate).maybeSingle()
        .then(({ data }) => setAffiliateMlbStadiumId((data as any)?.id ?? null))
    }

    if (s?.milb_team_id) {
      fetchMiLBUpcomingGames(s.milb_team_id).then(setUpcomingGames)
      fetchMiLBRoster(s.milb_team_id).then(setRoster)
      fetchMiLBLeagueId(s.milb_team_id).then(lid => {
        if (lid) fetchMiLBStandings(lid, s.milb_team_id!).then(setStandings)
      })
    }
  }

  useEffect(() => { load() }, [id])

  // Lazy-load weather when Game Day Intel tab is first opened
  useEffect(() => {
    if (activeTab !== 'game-day-intel' || !stadium || weather !== null) return
    setWeatherLoading(true)
    fetch(`/api/milb-weather?stadiumId=${stadium.id}`)
      .then(r => r.json())
      .then(d => setWeather(d.data ?? []))
      .catch(() => setWeather([]))
      .finally(() => setWeatherLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, stadium])

  async function saveNote() {
    setSavingNote(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('minor_league_notes').upsert(
      { stadium_id: id, notes: noteInput || null, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'stadium_id' }
    )
    setStadiumNote(noteInput)
    setEditingNote(false)
    setSavingNote(false)
  }

  async function shareStadium() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: stadium?.name ?? 'Stadium', url }) } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ color: '#E6EDF3' }}>
        <div style={{ height: 260, backgroundColor: '#1C2430', position: 'relative', overflow: 'hidden' }}>
          <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
        </div>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', gap: 8, padding: '14px 0', borderBottom: '1px solid #30363D' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: 72, borderRadius: 12, backgroundColor: '#1C2430', overflow: 'hidden', position: 'relative' }}>
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 0' }}>
            <div style={{ height: 48, borderRadius: 12, backgroundColor: '#1C2430', overflow: 'hidden', position: 'relative' }}>
              <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, borderTop: '1px solid #30363D', borderBottom: '1px solid #30363D', padding: '4px 0' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: 40, borderRadius: 6, backgroundColor: '#1C2430', overflow: 'hidden', position: 'relative', margin: 4 }}>
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stadium) {
    return <div style={{ padding: 32, color: '#8B949E' }}>Stadium not found.</div>
  }

  const visited      = visits.length > 0
  const affiliateColors = TEAM_GRADIENTS[stadium.affiliate] ?? ['#0B1117', '#161B22']
  const teamColor    = TEAM_BTN_COLOR[stadium.affiliate] ?? '#1F6FEB'
  const heroPhoto    = !heroPhotoError ? stadium.image_url : null

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'games-witnessed', label: 'Games Witnessed' },
    { key: 'game-day-intel',  label: 'Game Day Intel'  },
    { key: 'stadium-info',    label: 'Stadium Info'    },
  ]

  return (
    <div style={{ color: '#E6EDF3' }}>
      <main style={{ minHeight: '100vh' }}>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
          {/* Background */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(160deg, ${affiliateColors[0]} 0%, ${affiliateColors[1]} 100%)`,
          }} />
          {heroPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroPhoto}
              alt={stadium.name}
              onError={() => setHeroPhotoError(true)}
              style={{
                position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
                width: 'calc(100% + 8px)', height: 'calc(100% + 8px)',
                objectFit: 'cover', display: 'block',
                filter: 'brightness(0.85)',
              }}
            />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 35%, rgba(0,0,0,0.65) 65%, rgba(0,0,0,0.9) 100%)',
          }} />

          {/* Back button */}
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
            <Link href="/stadiums" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
              color: '#ffffff', padding: '7px 14px 7px 10px', borderRadius: 20,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}>
              <ArrowLeft size={15} /> Back
            </Link>
          </div>

          {/* Share button */}
          <button
            onClick={shareStadium}
            aria-label="Share"
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              width: 38, height: 38, borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <Share2 size={16} color="#ffffff" />
          </button>

          {/* Hero text */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 18px', zIndex: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              {stadium.team} — {stadium.level} affiliate of the {stadium.affiliate_full}
            </div>
            <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
              {stadium.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>
                {stadium.city}, {stadium.state}
              </div>
              <TeamLogo abbreviation={stadium.affiliate} size={36} style={{ opacity: 0.9 }} />
            </div>
          </div>
        </div>

        {/* ── Max-width wrapper ───────────────────────────────────────────── */}
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* ── STATS BAR ──────────────────────────────────────────────────── */}
          <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D', padding: '14px 12px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { Icon: Users,       value: stadium.capacity ? stadium.capacity.toLocaleString() : '—', label: 'Capacity'     },
                { Icon: CalendarDays, value: stadium.opened  ? String(stadium.opened)            : '—', label: 'Year Opened'  },
                { Icon: Trophy,      value: stadium.level,                                               label: 'Level'        },
              ].map(({ Icon, value, label }) => (
                <div key={label} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  backgroundColor: '#1C2430', borderRadius: 12, padding: '12px 6px',
                  border: '1px solid #30363D',
                }}>
                  <Icon size={15} color={teamColor} strokeWidth={2} style={{ marginBottom: 5 }} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#E6EDF3', lineHeight: 1.2, textAlign: 'center' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ACTION BUTTON ──────────────────────────────────────────────── */}
          <div style={{ padding: '16px 16px 0' }}>
            {visited ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  background: `linear-gradient(135deg, ${affiliateColors[0]}E6 0%, ${affiliateColors[1]}E6 100%)`,
                  borderRadius: 14, padding: '18px 20px', marginBottom: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MiLBLogo milbTeamId={stadium.milb_team_id} fallbackAbbr={stadium.affiliate} size={40} />
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                        ⚾ You&apos;ve been here!
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 3 }}>
                        {visits.length} game{visits.length !== 1 ? 's' : ''} · Last visited {formatDate(visits[0].visit_date)}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                    backgroundColor: 'transparent', color: '#F5A623',
                    border: `1.5px solid ${teamColor}`, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}
                >
                  <Plus size={15} /> Log Game
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 12, fontSize: 17, fontWeight: 800,
                    backgroundColor: teamColor, color: '#ffffff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    letterSpacing: '-0.2px',
                    boxShadow: `0 4px 16px ${teamColor}55`,
                  }}
                >
                  ✓ Mark as Visited
                </button>
              </div>
            )}
          </div>

          {/* ── STICKY TAB BAR ─────────────────────────────────────────────── */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            backgroundColor: '#161B22', borderBottom: '1px solid #30363D',
            borderTop: '1px solid #30363D',
          }}>
            <div style={{ display: 'flex', padding: '0 4px' }}>
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    flex: 1, padding: '12px 8px', fontSize: 13, fontWeight: activeTab === key ? 700 : 500,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: activeTab === key ? '#E6EDF3' : '#8B949E',
                    borderBottom: activeTab === key ? `2px solid ${teamColor}` : '2px solid transparent',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB CONTENT ────────────────────────────────────────────────── */}
          <div style={{ padding: '28px 16px' }}>

            {/* ─────────── GAMES WITNESSED ─────────────────────────────── */}
            {activeTab === 'games-witnessed' && (
              <section>
                {visits.length === 0 ? (
                  <div style={{
                    background: `linear-gradient(160deg, ${affiliateColors[0]}22 0%, ${affiliateColors[1]}18 100%), #161B22`,
                    borderRadius: 14, padding: '28px 24px', textAlign: 'center',
                    border: `1px solid ${teamColor}22`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                      <MiLBLogo milbTeamId={stadium.milb_team_id} fallbackAbbr={stadium.affiliate} size={64} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#E6EDF3', marginBottom: 6 }}>
                      Your first game at {stadium.name}
                    </div>
                    <div style={{ fontSize: 14, color: '#8B949E', marginBottom: 20 }}>
                      Photos, notes, game scores — all in one place
                    </div>
                    <button
                      onClick={() => setShowForm(true)}
                      style={{
                        padding: '11px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        backgroundColor: 'transparent', color: '#F5A623', border: `1.5px solid ${teamColor}`, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Plus size={14} /> Log Game
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visits.map(visit => {
                      const isExpanded = expandedVisit === visit.id
                      const hasScore   = visit.final_score_home != null && visit.final_score_away != null
                      const homeWon    = hasScore && (visit.final_score_home! > visit.final_score_away!)
                      const borderColor = hasScore ? (homeWon ? '#3FB950' : '#F85149') : teamColor
                      const opponent   = visit.opponent ?? visit.away_team ?? '—'

                      return (
                        <div key={visit.id}>
                          <button
                            onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 14px',
                              backgroundColor: isExpanded ? '#1C2430' : '#161B22',
                              border: '1px solid #30363D',
                              borderLeft: `3px solid ${borderColor}`,
                              borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                              cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            {/* Logo */}
                            <div style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MiLBLogo milbTeamId={stadium.milb_team_id} fallbackAbbr={stadium.affiliate} size={36} />
                            </div>

                            {/* Date + matchup */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 3, fontWeight: 500 }}>
                                {formatDate(visit.visit_date)}
                              </div>
                              <div style={{
                                fontSize: 14, fontWeight: 700, color: '#E6EDF3',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                vs {opponent}
                                {hasScore && ` · ${visit.final_score_away}–${visit.final_score_home}`}
                              </div>
                            </div>

                            {/* Win/loss dot + chevron */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {hasScore && (
                                <div style={{
                                  width: 10, height: 10, borderRadius: '50%',
                                  backgroundColor: homeWon ? '#3FB950' : '#F85149',
                                  boxShadow: homeWon ? '0 0 5px #3FB95088' : '0 0 5px #F8514988',
                                }} />
                              )}
                              <ChevronRight
                                size={16}
                                color={isExpanded ? '#E6EDF3' : '#484F58'}
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                              />
                            </div>
                          </button>

                          {/* Expanded game detail */}
                          {isExpanded && (
                            <div style={{
                              backgroundColor: '#1C2430', border: '1px solid #30363D',
                              borderTop: 'none', borderRadius: '0 0 12px 12px',
                              padding: '16px',
                            }}>
                              {/* Score banner */}
                              {hasScore && (
                                <div style={{
                                  background: `linear-gradient(135deg, ${affiliateColors[0]}CC 0%, ${affiliateColors[1]}CC 100%)`,
                                  borderRadius: 10, padding: '14px 16px', marginBottom: 14,
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  display: 'flex', alignItems: 'center', gap: 12,
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 3 }}>
                                      {visit.home_team ?? stadium.team} vs {visit.away_team ?? opponent}
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                                      {visit.final_score_home} – {visit.final_score_away}
                                    </div>
                                  </div>
                                  <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    backgroundColor: homeWon ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)',
                                    border: `2px solid ${homeWon ? '#3FB950' : '#F85149'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 13, fontWeight: 900,
                                    color: homeWon ? '#3FB950' : '#F85149',
                                  }}>
                                    {homeWon ? 'W' : 'L'}
                                  </div>
                                </div>
                              )}

                              {/* Info rows */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                {[
                                  { label: 'Date', value: formatDate(visit.visit_date) },
                                  visit.ticket_section ? {
                                    label: 'Seats',
                                    value: `Section ${visit.ticket_section}${visit.ticket_row ? ` · Row ${visit.ticket_row}` : ''}${visit.ticket_seats?.length ? ` · Seat${visit.ticket_seats.length > 1 ? 's' : ''} ${visit.ticket_seats.join(', ')}` : ''}`,
                                  } : null,
                                  (visit.weather_temp || visit.weather_conditions) ? {
                                    label: 'Weather',
                                    value: [visit.weather_temp, visit.weather_conditions].filter(Boolean).join(' · '),
                                  } : null,
                                ].filter(Boolean).map(row => (
                                  <div key={row!.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                                    <span style={{ fontSize: 12, color: '#8B949E', flexShrink: 0 }}>{row!.label}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', textAlign: 'right' }}>{row!.value}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Moments */}
                              {visit.moments && visit.moments.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Moments</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {visit.moments.map(m => (
                                      <span key={m} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, backgroundColor: 'rgba(31,111,235,0.1)', border: '1px solid rgba(31,111,235,0.2)', color: '#58A6FF' }}>{m}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Notes */}
                              {visit.notes && (
                                <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.5, paddingTop: 10, borderTop: '1px solid #30363D', marginTop: 4 }}>
                                  {visit.notes}
                                </div>
                              )}

                              {/* Attribution */}
                              <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: 10, color: '#484F58', fontWeight: 600 }}>⚾ Stats from MiLB</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ─────────── GAME DAY INTEL ──────────────────────────────── */}
            {activeTab === 'game-day-intel' && (
              <>
                {/* Upcoming Home Games */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={CalendarDays}>Upcoming Home Games</SectionTitle>
                  {upcomingGames.length > 0 ? (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #30363D' }}>
                      <div style={{ backgroundColor: '#0B1117' }}>
                        {upcomingGames.map((g, i) => {
                          const dt      = new Date(g.gameDate)
                          const dayAbbr = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' })
                          const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
                          const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
                          return (
                            <div key={g.gamePk} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderBottom: i < upcomingGames.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            }}>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ textAlign: 'center', minWidth: 36 }}>
                                  <div style={{ fontSize: 10, color: '#8B949E', fontWeight: 600 }}>{dayAbbr}</div>
                                  <div style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 700 }}>{dateStr}</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#E6EDF3' }}>
                                    vs {g.awayTeam}
                                  </div>
                                  {g.promotions.length > 0 && (
                                    <div style={{ fontSize: 11, color: '#F5A623', marginTop: 2 }}>
                                      🎁 {g.promotions[0]}{g.promotions.length > 1 ? ` +${g.promotions.length - 1} more` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#8B949E' }}>{timeStr} PT</div>
                              </div>
                            </div>
                          )
                        })}
                        {stadium.website_url && (
                          <a
                            href={stadium.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'block', padding: '12px 16px', fontSize: 14, fontWeight: 600,
                              color: teamColor, textDecoration: 'none',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            See Full Schedule →
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '24px 16px', textAlign: 'center', color: '#8B949E', fontSize: 14 }}>
                      {stadium.milb_team_id ? 'No upcoming home games found.' : 'Schedule not available.'}
                      {stadium.website_url && (
                        <> <a href={stadium.website_url} target="_blank" rel="noopener noreferrer" style={{ color: teamColor, fontWeight: 600, textDecoration: 'none' }}>Check milb.com →</a></>
                      )}
                    </div>
                  )}
                </section>

                {/* Food & Souvenirs */}
                <section style={{ marginBottom: 32 }}>
                  <div style={{
                    display: 'flex', gap: 3, marginBottom: 16,
                    backgroundColor: '#1C2430', borderRadius: 11,
                    border: '1px solid #30363D', padding: 3,
                  }}>
                    {([
                      { key: 'food',      emoji: '🍟', label: 'Food'      },
                      { key: 'souvenirs', emoji: '🛍️', label: 'Souvenirs' },
                    ] as const).map(({ key, emoji, label }) => (
                      <button
                        key={key}
                        onClick={() => setIntelSubTab(key)}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: 8,
                          fontSize: 13, fontWeight: intelSubTab === key ? 700 : 500,
                          border: 'none', cursor: 'pointer',
                          backgroundColor: intelSubTab === key ? '#161B22' : 'transparent',
                          color: intelSubTab === key ? '#E6EDF3' : '#8B949E',
                          boxShadow: intelSubTab === key ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
                          transition: 'background-color 0.15s, color 0.15s',
                        }}
                      >
                        {emoji} {label}
                      </button>
                    ))}
                  </div>

                  {intelSubTab === 'food' && (() => {
                    const classics = food.filter(f => f.is_classic)
                    const seasonal = food.filter(f => !f.is_classic && f.active && f.season_year === 2026)
                    if (classics.length === 0 && seasonal.length === 0) return (
                      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#484F58', fontSize: 13 }}>
                        No food intel yet for {stadium.name}.
                      </div>
                    )
                    return (
                      <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                        {classics.length > 0 && (
                          <>
                            <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Classics</div>
                            {classics.map((f, i) => (
                              <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: (i < classics.length - 1 || seasonal.length > 0) ? '1px solid rgba(48,54,61,0.6)' : 'none' }}>
                                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🏆</span>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{f.item_name}</div>
                                  {f.description && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{f.description}</div>}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                        {seasonal.length > 0 && (
                          <>
                            <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>This Season</div>
                            {seasonal.map((f, i) => (
                              <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: i < seasonal.length - 1 ? '1px solid rgba(48,54,61,0.6)' : 'none' }}>
                                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔥</span>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{f.item_name}</div>
                                  {f.description && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{f.description}</div>}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {intelSubTab === 'souvenirs' && (
                    <div style={{ textAlign: 'center', padding: '40px 24px', backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>🛍️</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#E6EDF3', marginBottom: 4 }}>No souvenirs added yet</div>
                      <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 20 }}>Know a must-have at {stadium.name}? Submit one!</div>
                      <button style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: `1.5px solid ${teamColor}`, backgroundColor: 'transparent', cursor: 'pointer', color: teamColor }}>
                        Submit a Souvenir
                      </button>
                    </div>
                  )}
                </section>

                {/* Best Time to Visit */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={CalendarDays}>Best Time to Visit</SectionTitle>
                  {weatherLoading ? (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '28px 16px', textAlign: 'center', color: '#8B949E', fontSize: 13 }}>
                      Loading weather data…
                    </div>
                  ) : weather && weather.length > 0 ? (() => {
                    const bbMonths = BASEBALL_MONTHS
                      .map(m => weather.find(w => w.month === m))
                      .filter((w): w is WeatherRow => !!w)

                    const ranked = [...bbMonths].sort((a, b) => {
                      const rd = RATING_PRIORITY[b.rating] - RATING_PRIORITY[a.rating]
                      return rd !== 0 ? rd : Math.abs(a.avg_high_temp - 72) - Math.abs(b.avg_high_temp - 72)
                    })
                    const bestMonthNums = new Set(
                      ranked.filter(m => m.rating === 'great' || m.rating === 'good').slice(0, 3).map(m => m.month)
                    )
                    const bestList = [...bestMonthNums].sort((a, b) => a - b)
                    const bestData = bbMonths.filter(m => bestMonthNums.has(m.month))
                    const avgTemp  = bestData.length ? Math.round(bestData.reduce((s, m) => s + m.avg_high_temp, 0) / bestData.length) : null
                    const avgRain  = bestData.length ? bestData.reduce((s, m) => s + m.avg_precip_days, 0) / bestData.length : null
                    const rainDesc = avgRain == null ? '' : avgRain < 5 ? 'lower rain chance' : avgRain < 8 ? 'some rain expected' : 'frequent rain'

                    let rangeStr = ''
                    if (bestList.length === 1) rangeStr = MONTH_NAMES[bestList[0]]
                    else if (bestList.length >= 2) {
                      const isConsec = bestList.every((m, i) => i === 0 || m - bestList[i - 1] === 1)
                      rangeStr = isConsec
                        ? `${MONTH_NAMES[bestList[0]]}–${MONTH_NAMES[bestList[bestList.length - 1]]}`
                        : bestList.map(m => MONTH_NAMES[m]).join(', ')
                    }

                    return (
                      <>
                        {rangeStr && (
                          <div style={{ backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D', padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 18 }}>🗓️</span>
                            <span style={{ fontSize: 13, color: '#8B949E' }}>
                              Best time to visit: <span style={{ color: '#E6EDF3', fontWeight: 700 }}>{rangeStr}</span>
                              {avgTemp && <> · Avg {avgTemp}°F</>}
                              {rainDesc && <> · {rainDesc}</>}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                          {bbMonths.map(w => {
                            const isBest = bestMonthNums.has(w.month)
                            const color  = RATING_COLOR[w.rating]
                            return (
                              <div key={w.month} style={{
                                backgroundColor: '#161B22', borderRadius: 10,
                                border: `1px solid ${isBest ? color + '66' : '#30363D'}`,
                                padding: '6px 3px 7px', textAlign: 'center',
                                boxShadow: isBest ? `0 0 8px ${color}22` : 'none',
                              }}>
                                <div style={{ height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                  {isBest && (
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', backgroundColor: '#1F6FEB', borderRadius: 20, padding: '1px 5px', whiteSpace: 'nowrap' }}>Best</div>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#8B949E', marginBottom: 4 }}>{MONTH_NAMES[w.month]}</div>
                                <div style={{ fontSize: 14, marginBottom: 3 }}>{RATING_LABEL[w.rating].split(' ')[0]}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>{Math.round(w.avg_high_temp)}°</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 2 }}>
                                  <CloudRain size={11} color="#8B949E" strokeWidth={2} />
                                  <span style={{ fontSize: 11, color: '#8B949E' }}>{w.avg_precip_days.toFixed(0)}d</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                  <Wind size={11} color="#8B949E" strokeWidth={2} />
                                  <span style={{ fontSize: 11, color: '#8B949E' }}>{Math.round(w.avg_wind_speed)}mph</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, paddingLeft: 2 }}>
                          {(['great', 'good', 'fair', 'avoid'] as const).map(r => (
                            <span key={r} style={{ fontSize: 11, color: '#8B949E' }}>{RATING_LABEL[r]}</span>
                          ))}
                        </div>
                      </>
                    )
                  })() : weather !== null ? (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '28px 16px', textAlign: 'center', color: '#484F58', fontSize: 13 }}>
                      Weather data unavailable.
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '28px 16px', textAlign: 'center', color: '#8B949E', fontSize: 13 }}>
                      Open this tab to load weather data.
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ─────────── STADIUM INFO ────────────────────────────────── */}
            {activeTab === 'stadium-info' && (
              <>
                {/* About */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={Building2}>About</SectionTitle>
                  <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                    {[
                      { label: 'Full Name',  value: stadium.name },
                      { label: 'Team',       value: stadium.team },
                      stadium.address ? { label: 'Address', value: stadium.address } : null,
                      { label: 'City',       value: `${stadium.city}, ${stadium.state}` },
                      { label: 'Level',      value: stadium.level },
                      stadium.capacity ? { label: 'Capacity', value: stadium.capacity.toLocaleString() } : null,
                      stadium.opened   ? { label: 'Opened',   value: String(stadium.opened) } : null,
                      stadium.surface  ? { label: 'Surface',  value: stadium.surface } : null,
                      { label: 'Season', value: 'April through September' },
                    ].filter(Boolean).map((row, i, arr) => (
                      <div key={row!.label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: i < arr.length - 1 ? '1px solid #30363D' : 'none',
                      }}>
                        <span style={{ fontSize: 13, color: '#8B949E' }}>{row!.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', textAlign: 'right', maxWidth: '60%' }}>{row!.value}</span>
                      </div>
                    ))}
                  </div>
                  {stadium.description && (
                    <div style={{ padding: '14px 0 0', fontSize: 13, color: '#8B949E', lineHeight: 1.7 }}>
                      {stadium.description}
                    </div>
                  )}
                </section>

                {/* Affiliate card */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={Trophy}>MLB Affiliate</SectionTitle>
                  <div style={{
                    background: `linear-gradient(135deg, ${affiliateColors[0]}E6 0%, ${affiliateColors[1]}E6 100%)`,
                    borderRadius: 14, padding: '20px 20px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <TeamLogo abbreviation={stadium.affiliate} size={56} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                          MLB Parent Club
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                          {stadium.affiliate_full}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                          {stadium.level} affiliate
                        </div>
                      </div>
                      {affiliateMlbStadiumId && (
                        <Link
                          href={`/stadiums/${affiliateMlbStadiumId}`}
                          style={{
                            fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none',
                            flexShrink: 0, padding: '7px 14px', borderRadius: 8,
                            backgroundColor: 'rgba(255,255,255,0.18)',
                            border: '1px solid rgba(255,255,255,0.2)',
                          }}
                        >
                          View Stadium →
                        </Link>
                      )}
                    </div>
                  </div>
                </section>

                {/* Standings */}
                {standings.length > 0 && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Trophy}>League Standings</SectionTitle>
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 36px 36px 48px 36px',
                        gap: 4, padding: '8px 14px',
                        fontSize: 10, fontWeight: 700, color: '#8B949E',
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        borderBottom: '1px solid #30363D',
                      }}>
                        <span>Team</span>
                        <span style={{ textAlign: 'center' }}>W</span>
                        <span style={{ textAlign: 'center' }}>L</span>
                        <span style={{ textAlign: 'center' }}>PCT</span>
                        <span style={{ textAlign: 'center' }}>GB</span>
                      </div>
                      {standings.map((t, i) => {
                        const isCurrent = stadium.milb_team_id != null && t.teamId === stadium.milb_team_id
                        return (
                          <div key={t.teamId} style={{
                            display: 'grid', gridTemplateColumns: '1fr 36px 36px 48px 36px',
                            gap: 4, padding: '10px 14px', alignItems: 'center',
                            borderBottom: i < standings.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            backgroundColor: isCurrent ? `${teamColor}14` : 'transparent',
                            borderLeft: isCurrent ? `3px solid ${teamColor}` : '3px solid transparent',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? '#E6EDF3' : '#C9D1D9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.teamName}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', textAlign: 'center' }}>{t.wins}</span>
                            <span style={{ fontSize: 13, color: '#8B949E', textAlign: 'center' }}>{t.losses}</span>
                            <span style={{ fontSize: 12, color: '#8B949E', textAlign: 'center' }}>{t.pct}</span>
                            <span style={{ fontSize: 12, color: '#8B949E', textAlign: 'center' }}>{t.gamesBack}</span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Current Roster */}
                {roster.length > 0 && (() => {
                  const pitchers = roster.filter(p => p.positionType === 'Pitcher')
                  const catchers = roster.filter(p => p.position === 'C')
                  const infield  = roster.filter(p => ['1B','2B','3B','SS'].includes(p.position))
                  const outfield = roster.filter(p => ['LF','CF','RF','OF'].includes(p.position))
                  const dh       = roster.filter(p => p.position === 'DH')
                  const groups   = [
                    { label: 'Pitchers', players: pitchers },
                    { label: 'Catchers', players: catchers },
                    { label: 'Infield',  players: infield  },
                    { label: 'Outfield', players: outfield },
                    { label: 'DH',       players: dh       },
                  ].filter(g => g.players.length > 0)
                  return (
                    <section style={{ marginBottom: 32 }}>
                      <SectionTitle Icon={Users}>Current Roster</SectionTitle>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {groups.map(group => (
                          <div key={group.label}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                              {group.label}
                            </div>
                            <div style={{ backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D', overflow: 'hidden' }}>
                              {group.players.map((p, i) => (
                                <div key={p.id} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  borderBottom: i < group.players.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {p.jerseyNumber && (
                                      <span style={{ fontSize: 11, fontWeight: 800, color: teamColor, width: 24, textAlign: 'right', flexShrink: 0 }}>
                                        #{p.jerseyNumber}
                                      </span>
                                    )}
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{p.name}</span>
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                                    {p.position}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                })()}

                {/* Ones to Watch */}
                {roster.length > 0 && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Trophy}>Ones to Watch</SectionTitle>
                    <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 14 }}>
                      Future {stadium.affiliate_full} talent — {new Date().getFullYear()} roster
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {roster.map(p => (
                        <div key={p.id} style={{
                          backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D',
                          padding: '10px 14px', textAlign: 'center', minWidth: 72,
                        }}>
                          {p.jerseyNumber && (
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>#{p.jerseyNumber}</div>
                          )}
                          <div style={{ fontSize: 11, color: teamColor, marginTop: p.jerseyNumber ? 4 : 0, lineHeight: 1.3 }}>
                            {p.name.split(' ').slice(-1)[0]}
                          </div>
                          <div style={{ fontSize: 10, color: '#6E7681', marginTop: 2 }}>{p.position}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Links */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={Map}>Links</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      stadium.website_url ? { href: stadium.website_url, icon: '🎟️', label: 'Get Tickets' } : null,
                      stadium.address ? {
                        href: `https://maps.google.com/?q=${encodeURIComponent(stadium.address + ' ' + stadium.city + ' ' + stadium.state)}`,
                        icon: '🗺️', label: 'Get Directions',
                      } : {
                        href: `https://maps.google.com/?q=${encodeURIComponent(stadium.name + ' ' + stadium.city + ' ' + stadium.state)}`,
                        icon: '🗺️', label: 'Get Directions',
                      },
                      { href: `/trips`, icon: '🚗', label: 'Road Trip Optimizer' },
                      stadium.website_url ? { href: stadium.website_url, icon: '🌐', label: 'Official Website' } : null,
                    ].filter(Boolean).map(link => (
                      <a
                        key={link!.label}
                        href={link!.href}
                        target={link!.href.startsWith('http') ? '_blank' : undefined}
                        rel={link!.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 16px', borderRadius: 12, textDecoration: 'none',
                          backgroundColor: '#161B22', border: '1px solid #30363D',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>{link!.icon} {link!.label}</span>
                        <span style={{ fontSize: 13, color: teamColor }}>Open ↗</span>
                      </a>
                    ))}
                  </div>
                </section>

                {/* Notes */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={MessageSquare}>Notes</SectionTitle>
                  {editingNote ? (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: 16 }}>
                      <textarea
                        rows={4}
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        placeholder={`Parking tips, best food spots, recommended seats at ${stadium.name}...`}
                        autoFocus
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #30363D',
                          fontSize: 14, color: '#E6EDF3', backgroundColor: '#1C2430',
                          resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                          onClick={saveNote}
                          disabled={savingNote}
                          style={{
                            padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                            backgroundColor: teamColor, color: '#ffffff', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <Save size={14} /> {savingNote ? 'Saving…' : 'Save Note'}
                        </button>
                        <button
                          onClick={() => setEditingNote(false)}
                          style={{ padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1.5px solid #30363D', backgroundColor: '#1C2430', cursor: 'pointer', color: '#8B949E' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : stadiumNote ? (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#E6EDF3', backgroundColor: 'rgba(139,148,158,0.12)', padding: '3px 10px', borderRadius: 20 }}>
                          Field Notes
                        </span>
                        <button
                          onClick={() => { setNoteInput(stadiumNote); setEditingNote(true) }}
                          style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #30363D', background: '#1C2430', cursor: 'pointer', fontSize: 13, color: '#8B949E', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      </div>
                      <div style={{ fontSize: 14, color: '#E6EDF3', fontStyle: 'italic', lineHeight: 1.6 }}>
                        &ldquo;{stadiumNote}&rdquo;
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#E6EDF3', marginBottom: 4 }}>Be the first to share</div>
                      <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 20 }}>Parking tips, best food spots, recommended seats...</div>
                      <button
                        onClick={() => { setNoteInput(''); setEditingNote(true) }}
                        style={{ padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', backgroundColor: teamColor, cursor: 'pointer', color: '#fff' }}
                      >
                        Add a Note
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}

          </div>{/* /tab content */}
        </div>{/* /max-width */}
      </main>

      {/* ── Log Game form ──────────────────────────────────────────────── */}
      {showForm && (
        <BaseballLifeForm
          defaultCategory="minor_league"
          defaultMinorLeagueStadiumId={stadium.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}
