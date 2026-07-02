'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft, Users, CalendarDays, Trophy, Share2, Plus,
  Building2, ChevronRight, CloudRain, Wind,
} from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'
import MiLBLogo from '@/components/MiLBLogo'
import BaseballLifeForm from '@/components/BaseballLifeForm'
import { TEAM_BTN_COLOR, TEAM_GRADIENTS } from '@/lib/team-colors'
import { formatDate } from '@/lib/utils'
import { getUserTimezone } from '@/lib/user-timezone'

const userTz = getUserTimezone()

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
  logo_url: string | null
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
  game_pk: number | null
  game_data: Record<string, unknown> | null
  giveaway_items: Array<{ name: string; photo_url: string | null }> | null
}

interface MiLBGame {
  gamePk: number
  gameDate: string
  isHome: boolean
  opponent: string
  venue: string | null
  scheduledInnings: number | null
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

async function fetchMiLBTeamInfo(milbTeamId: number): Promise<{ leagueId: number | null }> {
  try {
    const res  = await fetch(`https://statsapi.mlb.com/api/v1/teams/${milbTeamId}?hydrate=league`)
    if (!res.ok) return { leagueId: null }
    const data = await res.json()
    const team = data.teams?.[0]
    return { leagueId: team?.league?.id ?? null }
  } catch { return { leagueId: null } }
}

async function fetchMiLBUpcomingGames(milbTeamId: number): Promise<MiLBGame[]> {
  const today = new Date().toISOString().split('T')[0]
  const end   = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
  const url   = `https://statsapi.mlb.com/api/v1/schedule?sportId=13&teamId=${milbTeamId}&startDate=${today}&endDate=${end}&hydrate=game(promotions)`
  try {
    const res  = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const raw  = (data.dates ?? []).flatMap((d: any) => d.games ?? [])
      .filter((game: any) => game.teams?.home?.team?.id === milbTeamId)
      .sort((a: any, b: any) => a.gameDate < b.gameDate ? -1 : 1)
    return raw.map((game: any) => {
      const isHome = true
      return {
        gamePk:           game.gamePk,
        gameDate:         game.gameDate,
        isHome,
        opponent:         isHome ? game.teams.away.team.name : game.teams.home.team.name,
        venue:            isHome ? null : (game.venue?.name ?? null),
        scheduledInnings: game.scheduledInnings ?? null,
        promotions:       (game.promotions ?? []).map((p: any) => p.name).filter(Boolean),
      }
    })
  } catch { return [] }
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

  const [stadium,       setStadium]       = useState<MinorLeagueStadium | null>(null)
  const [visits,        setVisits]        = useState<BleEntry[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeTab,     setActiveTab]     = useState<ActiveTab>('games-witnessed')
  const [expandedVisit,    setExpandedVisit]    = useState<string | null>(null)
  const [showForm,         setShowForm]         = useState(false)
  const [heroPhotoError,   setHeroPhotoError]   = useState(false)
  const [fetchingStatsIds, setFetchingStatsIds] = useState<Set<string>>(new Set())

  // Game Day Intel
  const [upcomingGames,  setUpcomingGames]  = useState<MiLBGame[]>([])
  const [weather,        setWeather]        = useState<WeatherRow[] | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Stadium Info
  const [roster,                setRoster]                = useState<RosterPlayer[]>([])
  const [standings,             setStandings]             = useState<StandingTeam[]>([])
  const [affiliateMlbStadiumId, setAffiliateMlbStadiumId] = useState<string | null>(null)

  // Ticket flagging
  const [myTickets,   setMyTickets]   = useState<Set<string>>(new Set())
  const [ticketGames, setTicketGames] = useState<Array<{
    game_pk: number; game_date: string; opponent: string; time_str: string | null; promotions: string[]
  }>>([])

  // Edit giveaways
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null)
  const [editGiveaways,  setEditGiveaways]  = useState<Array<{ name: string; photo_url: string | null }>>([])
  const [editSaving,     setEditSaving]     = useState(false)
  const [lightboxUrl,    setLightboxUrl]    = useState<string | null>(null)
  const [uploadingIdx,   setUploadingIdx]   = useState<number | null>(null)
  const [stadiumFood, setStadiumFood] = useState<Array<{ id: string; name: string; category: string; rating: number | null; photo_url: string | null }>>([])

  async function load() {
    const supabase = createClient()
    const [{ data: s }, { data: v }] = await Promise.all([
      supabase.from('minor_league_stadiums').select('*').eq('id', id).single(),
      supabase.from('baseball_life_entries')
        .select('id,visit_date,opponent,home_team,away_team,final_score_home,final_score_away,ticket_section,ticket_row,ticket_seats,notes,moments,weather_temp,weather_conditions,game_pk,game_data,giveaway_items')
        .eq('category', 'minor_league')
        .eq('minor_league_stadium_id', id)
        .order('visit_date', { ascending: false }),
    ])

    setStadium(s)
    setVisits((v ?? []) as BleEntry[])
    setLoading(false)

    if (s?.affiliate) {
      supabase.from('stadiums').select('id').eq('abbreviation', s.affiliate).maybeSingle()
        .then(({ data }) => setAffiliateMlbStadiumId((data as any)?.id ?? null))
    }

    if (s?.milb_team_id) {
      fetchMiLBRoster(s.milb_team_id).then(setRoster)
      fetchMiLBUpcomingGames(s.milb_team_id).then(setUpcomingGames)
      fetchMiLBTeamInfo(s.milb_team_id).then(({ leagueId }) => {
        if (leagueId) fetchMiLBStandings(leagueId, s.milb_team_id!).then(setStandings)
      })
    }
  }

  async function loadTickets() {
    if (!stadium) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('milb_tickets')
      .select('*')
      .eq('stadium_id', stadium.id)
      .gte('game_date', new Date().toISOString().split('T')[0])
      .order('game_date', { ascending: true })
    if (error) { console.error('loadTickets error:', error); return }
    if (data) {
      setMyTickets(new Set(data.map((t: any) => String(t.game_pk))))
      setTicketGames(data.map((t: any) => ({
        game_pk:    t.game_pk,
        game_date:  t.game_date,
        opponent:   t.opponent,
        time_str:   t.time_str,
        promotions: t.promotions ?? [],
      })))
    }
  }

  async function toggleTicket(g: MiLBGame) {
    if (!stadium) return
    const supabase = createClient()
    if (myTickets.has(String(g.gamePk))) {
      const { error } = await supabase.from('milb_tickets').delete()
        .eq('game_pk', g.gamePk)
        .eq('stadium_id', stadium.id)
      if (error) { console.error('ticket delete error:', error); return }
    } else {
      const timeStr = new Date(g.gameDate).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: userTz,
      })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('milb_tickets').insert({
        user_id:    user.id,
        stadium_id: stadium.id,
        game_pk:    g.gamePk,
        game_date: new Date(g.gameDate).toLocaleDateString('en-CA', { timeZone: userTz }),
        opponent:   g.opponent,
        time_str:   timeStr,
        promotions: g.promotions,
      })
      if (error) { console.error('ticket insert error:', error); return }
    }
    await loadTickets()
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (visits.length === 0) return
    const entryIds = visits.map(e => e.id)
    const supabase = createClient()
    supabase.from('food_log').select('id, name, category, rating, photo_url')
      .in('baseball_life_entry_id', entryIds)
      .then(({ data }) => { if (data) setStadiumFood(data) })
  }, [visits])

  const allGiveaways = visits.flatMap(e =>
    (e.giveaway_items ?? []).map(g => ({ ...g, entryId: e.id }))
  )

  useEffect(() => {
    if (stadium) loadTickets()
  }, [stadium?.id])

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

  async function shareStadium() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: stadium?.name ?? 'Stadium', url }) } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    }
  }

  async function deleteEntry(entryId: string) {
    if (!confirm('Delete this game entry?')) return
    const supabase = createClient()
    await supabase.from('baseball_life_entries').delete().eq('id', entryId)
    setExpandedVisit(null)
    await load()
  }

  function openEdit(visit: BleEntry) {
    setEditingVisitId(visit.id)
    setEditGiveaways(visit.giveaway_items ? visit.giveaway_items.map(g => ({ ...g })) : [])
  }

  async function saveEdit() {
    if (!editingVisitId) return
    setEditSaving(true)
    const supabase = createClient()
    await supabase
      .from('baseball_life_entries')
      .update({ giveaway_items: editGiveaways })
      .eq('id', editingVisitId)
    setEditSaving(false)
    setEditingVisitId(null)
    await load()
  }

  async function uploadGiveawayPhoto(idx: number, file: File) {
    setUploadingIdx(idx)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${editingVisitId}-${idx}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('giveaway-photos').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('giveaway-photos').getPublicUrl(data.path)
      const updated = [...editGiveaways]
      updated[idx] = { ...updated[idx], photo_url: urlData.publicUrl }
      setEditGiveaways(updated)
    }
    setUploadingIdx(null)
  }

  async function handleFetchStats(entryId: string) {
    setFetchingStatsIds(prev => new Set(prev).add(entryId))
    try {
      await fetch('/api/autofill-milb-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      await load()
    } finally {
      setFetchingStatsIds(prev => { const s = new Set(prev); s.delete(entryId); return s })
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
          <div style={{ display: 'flex', gap: 4, borderTop: '1px solid #30363D', borderBottom: '1px solid #30363D', padding: '4px 0', marginTop: 16 }}>
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

  const visited         = visits.length > 0
  const affiliateColors = TEAM_GRADIENTS[stadium.affiliate] ?? ['#0B1117', '#161B22']
  const teamColor       = TEAM_BTN_COLOR[stadium.affiliate] ?? '#1F6FEB'
  const heroPhoto       = !heroPhotoError ? stadium.image_url : null

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'games-witnessed', label: 'Games Attended' },
    { key: 'game-day-intel',  label: 'Schedule'         },
    { key: 'stadium-info',    label: 'Stadium Info'    },
  ]

  return (
    <div style={{ color: '#E6EDF3' }}>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Giveaway"
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      )}

      {/* Edit giveaways sheet */}
      {editingVisitId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingVisitId(null) }}
        >
          <div style={{
            backgroundColor: '#161B22', borderRadius: '16px 16px 0 0',
            border: '1px solid #30363D', padding: '20px 16px 40px',
            width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>Edit Giveaways</span>
              <button onClick={() => setEditingVisitId(null)} style={{ background: 'none', border: 'none', color: '#8B949E', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              {editGiveaways.map((item, idx) => (
                <div key={idx} style={{ backgroundColor: '#0D1117', borderRadius: 12, border: '1px solid #30363D', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <input
                      value={item.name}
                      onChange={(e) => {
                        const updated = [...editGiveaways]
                        updated[idx] = { ...updated[idx], name: e.target.value }
                        setEditGiveaways(updated)
                      }}
                      style={{
                        flex: 1, backgroundColor: '#161B22', border: '1px solid #30363D',
                        borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 13,
                      }}
                    />
                    <button
                      onClick={() => setEditGiveaways(editGiveaways.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#F85149', fontSize: 16, cursor: 'pointer', padding: '4px 6px' }}
                    >✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        onClick={() => setLightboxUrl(item.photo_url!)}
                        style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                      />
                    )}
                    <label style={{
                      fontSize: 12, fontWeight: 600, color: '#58A6FF',
                      border: '1px solid rgba(88,166,255,0.3)', borderRadius: 8,
                      padding: '6px 12px', cursor: 'pointer',
                      opacity: uploadingIdx === idx ? 0.5 : 1,
                    }}>
                      {uploadingIdx === idx ? 'Uploading…' : item.photo_url ? 'Replace Photo' : '+ Add Photo'}
                      <input
                        type="file" accept="image/*" style={{ display: 'none' }}
                        disabled={uploadingIdx !== null}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadGiveawayPhoto(idx, f) }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setEditGiveaways([...editGiveaways, { name: '', photo_url: null }])}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                border: '1px dashed #30363D', background: 'none',
                color: '#8B949E', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
              }}
            >+ Add Giveaway Item</button>

            <button
              onClick={saveEdit}
              disabled={editSaving}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                backgroundColor: '#1F6FEB', border: 'none',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: editSaving ? 'default' : 'pointer',
                opacity: editSaving ? 0.6 : 1,
              }}
            >{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      <main style={{ minHeight: '100vh' }}>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
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

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 18px', zIndex: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
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
                { Icon: Users,        value: stadium.capacity ? stadium.capacity.toLocaleString() : '—', label: 'Capacity'    },
                { Icon: CalendarDays, value: stadium.opened   ? String(stadium.opened)            : '—', label: 'Year Opened' },
                { Icon: Trophy,       value: stadium.level,                                               label: 'Level'       },
              ].map(({ Icon, value, label }) => (
                <div key={label} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  backgroundColor: '#1C2430', borderRadius: 12, padding: '12px 6px',
                  border: '1px solid #30363D',
                }}>
                  <Icon size={15} color={teamColor} strokeWidth={2} style={{ marginBottom: 5 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
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
                    <MiLBLogo milbTeamId={stadium.milb_team_id} fallbackAbbr={stadium.affiliate} size={40} logoUrl={stadium.logo_url} />
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
                {ticketGames.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      🎟️ Your Upcoming Tickets
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ticketGames.map(t => {
                        const dt      = new Date(t.game_date + 'T12:00:00')
                        const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        const daysAway = Math.round((dt.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
                        return (
                          <div key={t.game_pk} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', borderRadius: 12,
                            backgroundColor: '#161B22', border: '1px solid rgba(63,185,80,0.2)',
                          }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3' }}>vs {t.opponent}</div>
                              <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>
                                {dateStr}{t.time_str ? ` · ${t.time_str} PT` : ''}
                              </div>
                              {t.promotions.length > 0 && (
                                <div style={{ fontSize: 13, color: '#F5A623', marginTop: 2 }}>🎁 {t.promotions[0]}</div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623', lineHeight: 1 }}>
                                {daysAway === 0 ? 'Today' : daysAway === 1 ? '1' : daysAway}
                              </div>
                              {daysAway > 1 && <div style={{ fontSize: 13, color: '#8B949E' }}>days</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {visits.length === 0 ? (
                  <div style={{
                    background: `linear-gradient(160deg, ${affiliateColors[0]}22 0%, ${affiliateColors[1]}18 100%), #161B22`,
                    borderRadius: 14, padding: '28px 24px', textAlign: 'center',
                    border: `1px solid ${teamColor}22`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                      <MiLBLogo milbTeamId={stadium.milb_team_id} fallbackAbbr={stadium.affiliate} size={64} logoUrl={stadium.logo_url} />
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
                      const isExpanded  = expandedVisit === visit.id
                      const hasScore    = visit.final_score_home != null && visit.final_score_away != null
                      const homeWon     = hasScore && (visit.final_score_home! > visit.final_score_away!)
                      const borderColor = hasScore ? (homeWon ? '#3FB950' : '#F85149') : teamColor
                      const opponent    = visit.opponent ?? visit.away_team ?? '—'

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
                            <div style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MiLBLogo milbTeamId={stadium.milb_team_id} fallbackAbbr={stadium.affiliate} size={36} logoUrl={stadium.logo_url} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 3, fontWeight: 500 }}>
                                {formatDate(visit.visit_date)}
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                vs {opponent}
                                {hasScore && ` · ${visit.final_score_away}–${visit.final_score_home}`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {visit.giveaway_items && visit.giveaway_items.length > 0 && (
                                <span style={{ fontSize: 13 }}>🎁</span>
                              )}
                              {hasScore && (
                                <div style={{
                                  width: 10, height: 10, borderRadius: '50%',
                                  backgroundColor: homeWon ? '#3FB950' : '#F85149',
                                  boxShadow: homeWon ? '0 0 5px #3FB95088' : '0 0 5px #F8514988',
                                }} />
                              )}
                              <ChevronRight
                                size={16}
                                color={isExpanded ? '#E6EDF3' : '#8B949E'}
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                              />
                            </div>
                          </button>

                          {isExpanded && (
                            <div style={{
                              backgroundColor: '#1C2430', border: '1px solid #30363D',
                              borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px',
                            }}>
                                {hasScore && (
                                <div style={{
                                  background: `linear-gradient(135deg, ${affiliateColors[0]}CC 0%, ${affiliateColors[1]}CC 100%)`,
                                  borderRadius: 10, padding: '14px 16px', marginBottom: 14,
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  display: 'flex', alignItems: 'center', gap: 12,
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 3 }}>
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
                                    fontSize: 13, fontWeight: 900, color: homeWon ? '#3FB950' : '#F85149',
                                  }}>
                                    {homeWon ? 'W' : 'L'}
                                  </div>
                                </div>
                              )}

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

                              {visit.moments && visit.moments.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Moments</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {visit.moments.map(m => (
                                      <span key={m} style={{ fontSize: 13, padding: '3px 8px', borderRadius: 12, backgroundColor: 'rgba(31,111,235,0.1)', border: '1px solid rgba(31,111,235,0.2)', color: '#58A6FF' }}>{m}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* MiLB Box Score */}
                              {visit.game_data && (() => {
                                const gd = visit.game_data as any
                                const innings: Array<{inning: number; home: number|null; away: number|null}> = gd.inningScores ?? []
                                const awayTeam = visit.away_team ?? gd.awayTeamName ?? 'Away'
                                const homeTeam = visit.home_team ?? gd.homeTeamName ?? 'Home'
                                const homeWon = (gd.homeRuns ?? 0) > (gd.awayRuns ?? 0)
                                return (
                                  <div style={{ marginTop: 12, backgroundColor: '#0B1117', borderRadius: 10, overflow: 'hidden', border: '1px solid #30363D' }}>
                                    <div style={{ padding: '5px 10px', borderBottom: '1px solid #30363D', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.1)', borderRadius: 10, padding: '2px 8px' }}>⚾ Stats from MiLB</span>
                                      {gd.attendance && <span style={{ fontSize: 13, color: '#8B949E' }}>{Number(gd.attendance).toLocaleString()} fans</span>}
                                    </div>
                                    {innings.length > 0 && (
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
                                          <thead>
                                            <tr style={{ borderBottom: '1px solid #30363D' }}>
                                              <th style={{ textAlign: 'left', padding: '4px 8px', color: '#8B949E', fontWeight: 600, minWidth: 48 }}>Team</th>
                                              {innings.map((inn: any) => (
                                                <th key={inn.inning} style={{ textAlign: 'center', padding: '4px 4px', color: '#8B949E', fontWeight: 600, minWidth: 18 }}>{inn.inning}</th>
                                              ))}
                                              <th style={{ textAlign: 'center', padding: '4px 5px', color: '#E6EDF3', fontWeight: 700, borderLeft: '1px solid #30363D', minWidth: 20 }}>R</th>
                                              <th style={{ textAlign: 'center', padding: '4px 5px', color: '#8B949E', fontWeight: 600, minWidth: 20 }}>H</th>
                                              <th style={{ textAlign: 'center', padding: '4px 5px', color: '#8B949E', fontWeight: 600, minWidth: 20 }}>E</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(['away', 'home'] as const).map(side => {
                                              const name   = side === 'away' ? awayTeam : homeTeam
                                              const totalR = side === 'away' ? gd.awayRuns   : gd.homeRuns
                                              const totalH = side === 'away' ? gd.awayHits   : gd.homeHits
                                              const totalE = side === 'away' ? gd.awayErrors : gd.homeErrors
                                              const wins   = side === 'home' ? homeWon : !homeWon
                                              return (
                                                <tr key={side}>
                                                  <td style={{ padding: '4px 8px', fontWeight: wins ? 700 : 500, fontSize: 13, color: wins ? '#E6EDF3' : '#8B949E' }}>{name}</td>
                                                  {innings.map((inn: any) => {
                                                    const val = inn[side]
                                                    return (
                                                      <td key={inn.inning} style={{ textAlign: 'center', padding: '4px 4px', color: (val != null && val > 0) ? '#E6EDF3' : '#8B949E', fontWeight: (val != null && val > 0) ? 700 : 400, fontSize: 13 }}>
                                                        {val ?? '—'}
                                                      </td>
                                                    )
                                                  })}
                                                  <td style={{ textAlign: 'center', padding: '4px 5px', fontWeight: 800, fontSize: 12, color: wins ? '#E6EDF3' : '#8B949E', borderLeft: '1px solid #30363D' }}>{totalR ?? '—'}</td>
                                                  <td style={{ textAlign: 'center', padding: '4px 5px', color: '#8B949E', fontSize: 13 }}>{totalH ?? '—'}</td>
                                                  <td style={{ textAlign: 'center', padding: '4px 5px', color: '#8B949E', fontSize: 13 }}>{totalE ?? '—'}</td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                    <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(48,54,61,0.6)' }}>
                                      {(gd.winningPitcher || gd.losingPitcher) && (
                                        <div style={{ fontSize: 13, color: '#8B949E', display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginBottom: 6 }}>
                                          {gd.winningPitcher && <span><span style={{ color: '#3FB950', fontWeight: 600 }}>W</span> {gd.winningPitcher}</span>}
                                          {gd.losingPitcher  && <span><span style={{ color: '#F85149', fontWeight: 600 }}>L</span> {gd.losingPitcher}</span>}
                                          {gd.savePitcher    && <span><span style={{ color: '#F5A623', fontWeight: 600 }}>S</span> {gd.savePitcher}</span>}
                                        </div>
                                      )}
                                      {(gd.homeSP || gd.awaySP) && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                          {[{ label: awayTeam, sp: gd.awaySP }, { label: homeTeam, sp: gd.homeSP }].map(({ label, sp }) =>
                                            sp ? (
                                              <div key={label} style={{ backgroundColor: '#161B22', borderRadius: 8, padding: '7px 10px' }}>
                                                <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 1 }}>{label} SP</div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3' }}>{sp.name}</div>
                                                <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>
                                                  {[sp.ip && `${sp.ip} IP`, sp.h != null && `${sp.h} H`, sp.er != null && `${sp.er} ER`, sp.k != null && `${sp.k} K`].filter(Boolean).join(' · ')}
                                                </div>
                                              </div>
                                            ) : null
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}

                              {!visit.game_data && (
                                <button
                                  onClick={() => handleFetchStats(visit.id)}
                                  disabled={fetchingStatsIds.has(visit.id)}
                                  style={{
                                    marginTop: 10, width: '100%', padding: '8px', borderRadius: 8,
                                    fontSize: 12, fontWeight: 600, backgroundColor: 'transparent',
                                    color: '#58A6FF', border: '1px solid rgba(88,166,255,0.3)',
                                    cursor: fetchingStatsIds.has(visit.id) ? 'default' : 'pointer',
                                    opacity: fetchingStatsIds.has(visit.id) ? 0.5 : 1,
                                  }}
                                >
                                  {fetchingStatsIds.has(visit.id) ? '⏳ Fetching stats…' : '⚾ Fetch MiLB Stats'}
                                </button>
                              )}

                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                                <button
                                  onClick={() => openEdit(visit)}
                                  style={{ fontSize: 13, fontWeight: 600, color: '#58A6FF', background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
                                >
                                  Edit Giveaways
                                </button>
                              </div>

                              {visit.giveaway_items && visit.giveaway_items.length > 0 && (
                                <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10, backgroundColor: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)' }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(245,166,35,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                    Giveaways &amp; Promotions
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {visit.giveaway_items.map((item, i) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontSize: 13, color: '#F5A623', fontWeight: 600, flex: 1, minWidth: 0 }}>🎁 {item.name}</span>
                                        {item.photo_url && (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={item.photo_url}
                                            alt={item.name}
                                            style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', display: 'block', cursor: 'pointer', flexShrink: 0 }}
                                            onClick={() => setLightboxUrl(item.photo_url!)}
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {visit.notes && (
                                <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.5, paddingTop: 10, borderTop: '1px solid #30363D', marginTop: 4 }}>
                                  {visit.notes}
                                </div>
                              )}

                              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #30363D' }}>
                                <button
                                  onClick={() => deleteEntry(visit.id)}
                                  style={{ fontSize: 13, fontWeight: 500, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                  Delete this entry
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {(allGiveaways.length > 0 || stadiumFood.length > 0) && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#E6EDF3', marginBottom: 14 }}>
                      Your Collection at {stadium.name}
                    </div>

                    {allGiveaways.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                          🎁 Giveaways ({allGiveaways.length})
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                          {allGiveaways.map((g, i) => (
                            <div key={`${g.entryId}-${i}`} style={{ backgroundColor: '#161B22', borderRadius: 10, border: '1px solid #30363D', overflow: 'hidden' }}>
                              <div style={{ position: 'relative', paddingBottom: '100%', backgroundColor: '#1C2430' }}>
                                {g.photo_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={g.photo_url} alt={g.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎁</div>
                                )}
                              </div>
                              <div style={{ padding: '6px 8px', fontSize: 13, color: '#E6EDF3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {g.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {stadiumFood.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                          🍔 Food & Drink ({stadiumFood.length})
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                          {stadiumFood.map(item => {
                            const categoryEmoji: Record<string, string> = { hot_dog: '🌭', specialty: '🍔', dessert: '🍦', drink: '🥤', other: '🍽️' }
                            return (
                              <div key={item.id} style={{ backgroundColor: '#161B22', borderRadius: 10, border: '1px solid #30363D', overflow: 'hidden' }}>
                                <div style={{ position: 'relative', paddingBottom: '100%', backgroundColor: '#1C2430' }}>
                                  {item.photo_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={item.photo_url} alt={item.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{categoryEmoji[item.category] ?? '🍽️'}</div>
                                  )}
                                </div>
                                <div style={{ padding: '6px 8px' }}>
                                  <div style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                  {item.rating && <div style={{ fontSize: 13, color: '#F5A623' }}>{'⭐'.repeat(item.rating)}</div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ─────────── GAME DAY INTEL ──────────────────────────────── */}
            {activeTab === 'game-day-intel' && (
              <>
                {/* Upcoming Games */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={CalendarDays}>Schedule</SectionTitle>
                  {upcomingGames.length > 0 ? (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #30363D' }}>
                      <div style={{ backgroundColor: '#0B1117', maxHeight: 360, overflowY: 'auto' }}>
                        {upcomingGames.map((g, i) => {
                          const dt      = new Date(g.gameDate)
                          const dayAbbr = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: userTz })
                          const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: userTz })
                          const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: userTz })
                          const prefix  = g.isHome ? 'vs' : '@'
                          return (
                            <div key={g.gamePk} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderBottom: i < upcomingGames.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            }}>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <div style={{ textAlign: 'center', minWidth: 36 }}>
                                  <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 600 }}>{dayAbbr}</div>
                                  <div style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 700 }}>{dateStr}</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#E6EDF3' }}>
                                    <span style={{ color: g.isHome ? '#3FB950' : '#8B949E', marginRight: 4 }}>{prefix}</span>
                                    {g.opponent}
                                    {g.scheduledInnings === 7 && <span style={{ fontSize: 13, color: '#8B949E', marginLeft: 6 }}>7 inn.</span>}
                                  </div>
                                  {!g.isHome && g.venue && (
                                    <div style={{ fontSize: 13, color: '#8B949E', marginTop: 1 }}>{g.venue}</div>
                                  )}
                                  {g.promotions.length > 0 && (
                                    <div style={{ fontSize: 13, color: '#F5A623', marginTop: 2 }}>
                                      🎁 {g.promotions[0]}{g.promotions.length > 1 ? ` +${g.promotions.length - 1} more` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#E6EDF3' }}>{timeStr} PT</div>
                                <button
                                  onClick={() => toggleTicket(g)}
                                  style={{
                                    background: myTickets.has(String(g.gamePk)) ? 'rgba(63,185,80,0.15)' : 'rgba(139,148,158,0.1)',
                                    border: `1px solid ${myTickets.has(String(g.gamePk)) ? 'rgba(63,185,80,0.4)' : '#30363D'}`,
                                    borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                                    fontSize: 13, color: myTickets.has(String(g.gamePk)) ? '#3FB950' : '#8B949E',
                                    fontWeight: 600, whiteSpace: 'nowrap',
                                  }}
                                >
                                  {myTickets.has(String(g.gamePk)) ? '🎟️ Got it' : '+ Tickets'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '24px 16px', textAlign: 'center', color: '#8B949E', fontSize: 14 }}>
                      {stadium.milb_team_id ? 'No upcoming games found.' : 'Schedule not available.'}
                      {stadium.website_url && (
                        <> <a href={stadium.website_url} target="_blank" rel="noopener noreferrer" style={{ color: teamColor, fontWeight: 600, textDecoration: 'none' }}>Check milb.com →</a></>
                      )}
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
                                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', backgroundColor: '#1F6FEB', borderRadius: 20, padding: '1px 5px', whiteSpace: 'nowrap' }}>Best</div>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#8B949E', marginBottom: 4 }}>{MONTH_NAMES[w.month]}</div>
                                <div style={{ fontSize: 14, marginBottom: 3 }}>{RATING_LABEL[w.rating].split(' ')[0]}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>{Math.round(w.avg_high_temp)}°</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 2 }}>
                                  <CloudRain size={11} color="#8B949E" strokeWidth={2} />
                                  <span style={{ fontSize: 13, color: '#8B949E' }}>{w.avg_precip_days.toFixed(0)}d</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                  <Wind size={11} color="#8B949E" strokeWidth={2} />
                                  <span style={{ fontSize: 13, color: '#8B949E' }}>{Math.round(w.avg_wind_speed)}mph</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, paddingLeft: 2 }}>
                          {(['great', 'good', 'fair', 'avoid'] as const).map(r => (
                            <span key={r} style={{ fontSize: 13, color: '#8B949E' }}>{RATING_LABEL[r]}</span>
                          ))}
                        </div>
                      </>
                    )
                  })() : weather !== null ? (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '28px 16px', textAlign: 'center', color: '#8B949E', fontSize: 13 }}>
                      Weather data unavailable.
                    </div>
                  ) : null}
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
                      { label: 'Full Name', value: stadium.name },
                      { label: 'Team',      value: stadium.team },
                      stadium.address  ? { label: 'Address',  value: stadium.address } : null,
                      { label: 'City',      value: `${stadium.city}, ${stadium.state}` },
                      { label: 'Level',     value: stadium.level },
                      stadium.capacity ? { label: 'Capacity', value: stadium.capacity.toLocaleString() } : null,
                      stadium.opened   ? { label: 'Opened',   value: String(stadium.opened) } : null,
                      stadium.surface  ? { label: 'Surface',  value: stadium.surface } : null,
                      { label: 'Season',    value: 'April through September' },
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
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
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 36px 36px 48px 36px',
                        gap: 4, padding: '8px 14px',
                        fontSize: 12, fontWeight: 700, color: '#8B949E',
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
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
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
                                      <span style={{ fontSize: 13, fontWeight: 800, color: teamColor, width: 24, textAlign: 'right', flexShrink: 0 }}>
                                        #{p.jerseyNumber}
                                      </span>
                                    )}
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{p.name}</span>
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', padding: '2px 8px', borderRadius: 10 }}>
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


              </>
            )}

          </div>{/* /tab content */}
        </div>{/* /max-width */}
      </main>

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
