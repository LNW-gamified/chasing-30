'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import GameDayForm from '@/components/GameDayForm'
import BoxScore from '@/components/BoxScore'
import { formatDate } from '@/lib/utils'
import type { Stadium, StadiumVisit, StadiumNote, RetiredNumber, StadiumTrendingFood, StadiumSouvenir, StadiumWeather } from '@/types'
import { MILESTONES } from '@/lib/milestones'
import { fetchUpcomingHomeGames, fetchVenueDimensions, fetchTeamSeasonStats, fetchTeamRoster, fetchRecentTransactions, fetchMinorLeagueAffiliates, type UpcomingGame, type VenueDimensions, type TeamSeasonStats, type RosterPlayer, type Transaction, type MiLBAffiliate } from '@/lib/mlb-api'
import { fetchStadiumPhoto, fetchStadiumSummary } from '@/lib/stadium-wikipedia'
import { fetchTeamNews, type ESPNNewsItem } from '@/lib/espn-api'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Save, Loader2, Users, CalendarDays, Trophy, Share2, MessageSquare, Hash, Building2, Map, ChevronRight, CloudRain, Wind } from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'
import { TEAM_BTN_COLOR, TEAM_GRADIENTS } from '@/lib/team-colors'
import GiveawayFoodEditor, { type EditorItem } from '@/components/GiveawayFoodEditor'

const MLB_SCHEDULE_SLUG: Record<string, string> = {
  ARI: 'dbacks',       ATL: 'braves',      BAL: 'orioles',    BOS: 'red-sox',
  CHC: 'cubs',         CWS: 'white-sox',   CIN: 'reds',       CLE: 'guardians',
  COL: 'rockies',      DET: 'tigers',      HOU: 'astros',     KC:  'royals',
  LAA: 'angels',       LAD: 'dodgers',     MIA: 'marlins',    MIL: 'brewers',
  MIN: 'twins',        NYM: 'mets',        NYY: 'yankees',    OAK: 'athletics',
  PHI: 'phillies',     PIT: 'pirates',     SD:  'padres',     SEA: 'mariners',
  SF:  'giants',       STL: 'cardinals',   TB:  'rays',       TEX: 'rangers',
  TOR: 'blue-jays',    WSH: 'nationals',
}

const GAME_EVENT_LABELS: Record<string, string> = {
  walk_off:            '🏠 Walk-off',
  extra_innings:       '⏰ Extra innings',
  twelve_plus_innings: '⏰ 12+ innings',
  no_hitter:           '🚫 No-hitter',
  perfect_game:        '✨ Perfect game',
  combined_no_hitter:  '🚫 Combined no-hitter',
  shutout:             '🔒 Shutout',
  run_factory:         '💣 Run factory',
  pitchers_duel:       '⚔️ Pitcher\'s duel',
  grand_slam:          '💥 Grand slam',
  cycle:               '🔄 Hit for the cycle',
  milestone_hr:        '🏆 Milestone HR',
}


// Stadiums with climate control — weather ratings don't apply
const DOME_STADIUMS    = new Set(['ARI', 'SEA', 'HOU', 'TEX', 'MIL', 'TOR', 'TB', 'MIA'])
// Subset whose roofs open when weather permits
const RETRACTABLE_ROOF = new Set(['ARI', 'SEA', 'HOU', 'TEX', 'MIL', 'TOR', 'MIA'])

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const BASEBALL_MONTHS = [4, 5, 6, 7, 8, 9, 10]

const RATING_COLOR: Record<string, string> = {
  great: '#3FB950', good: '#58A6FF', fair: '#F5A623', avoid: '#F85149',
}
const RATING_LABEL: Record<string, string> = {
  great: '🟢 Great', good: '🔵 Good', fair: '🟡 Fair', avoid: '🔴 Avoid',
}
const RATING_PRIORITY: Record<string, number> = {
  great: 4, good: 3, fair: 2, avoid: 1,
}

type MiniStadium = { id: string; league: string; division: string }
type ActiveTab = 'games-attended' | 'upcoming-games' | 'stadium-info' | 'roster'

function guessGiveawayEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('bobblehead') || n.includes('bobble')) return '🪆'
  if (n.includes('jersey')) return '👕'
  if (n.includes('t-shirt') || n.includes('tshirt') || n.includes('shirt')) return '👔'
  if (n.includes('hat') || n.includes('cap')) return '🎩'
  if (n.includes('poster')) return '📋'
  if (n.includes('bingo') || n.includes('card')) return '🎫'
  return '🎁'
}

function SectionTitle({ Icon, children }: { Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Icon size={17} color="#8B949E" strokeWidth={2} />
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#E6EDF3' }}>{children}</h2>
    </div>
  )
}

export default function StadiumDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [stadium, setStadium] = useState<Stadium | null>(null)
  const [visits, setVisits] = useState<StadiumVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVisit, setEditingVisit] = useState<StadiumVisit | undefined>()
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [stadiumNote, setStadiumNote] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGame[]>([])
  const [fetchingStats, setFetchingStats] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<Record<string, string>>({})
  const [autofillState, setAutofillState] = useState<
    null |
    { phase: 'loading' } |
    { phase: 'success'; score?: string; events?: string[] } |
    { phase: 'error'; msg: string }
  >(null)
  const [stadiumPhoto, setStadiumPhoto] = useState<string | null>(null)
  const [allGlobalMoments, setAllGlobalMoments] = useState<Set<string>>(new Set())
  const [firstTimeMoments, setFirstTimeMoments] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('games-attended')
  const [retiredNumbers, setRetiredNumbers] = useState<RetiredNumber[]>([])
  const [venueDimensions, setVenueDimensions]   = useState<VenueDimensions | null>(null)
  const [teamStats, setTeamStats]               = useState<TeamSeasonStats | null>(null)
  const [roster, setRoster]                     = useState<RosterPlayer[]>([])
  const [transactions, setTransactions]         = useState<Transaction[]>([])
  const [stadiumSummary, setStadiumSummary]     = useState<string | null>(null)
  const [teamNews, setTeamNews]                 = useState<ESPNNewsItem[]>([])
  const [tourVideoId, setTourVideoId]           = useState<string | null | undefined>(undefined)
  const [affiliates, setAffiliates]             = useState<MiLBAffiliate[]>([])
  const [trendingFood, setTrendingFood]         = useState<StadiumTrendingFood[]>([])
  const [souvenirs, setSouvenirs]               = useState<StadiumSouvenir[]>([])
  const [intelSubTab, setIntelSubTab]           = useState<'food' | 'souvenirs'>('food')
  const [weather, setWeather]                   = useState<StadiumWeather[] | null>(null)
  const [weatherLoading, setWeatherLoading]     = useState(false)
  const [tripMonths, setTripMonths]             = useState<Set<number>>(new Set())
  const [visitPromos, setVisitPromos]           = useState<Record<string, { promotions: string[]; promotion_photos: Record<string, string> }>>({})
  const [lightboxUrl, setLightboxUrl]           = useState<string | null>(null)
  const [stadiumCollectibles, setStadiumCollectibles] = useState<Array<{ id: string; name: string; category: string; giveaway_type: string | null; photo_url: string | null; signed_by: string | null; acquired_from: string | null; rating: number | null; price: number | null; stadium_visit_id: string | null }>>([])
  const [editingItem, setEditingItem] = useState<EditorItem | null>(null)

  useEffect(() => {
    function handleLightbox(e: Event) {
      setLightboxUrl((e as CustomEvent).detail)
    }
    window.addEventListener('open-lightbox', handleLightbox)
    return () => window.removeEventListener('open-lightbox', handleLightbox)
  }, [])

  const [unlockedMilestones, setUnlockedMilestones] = useState<{ name: string; icon: string }[]>([])
  const prevEarnedIdsRef = useRef<Set<string>>(new Set())

  async function load(checkMilestones = false) {
    const supabase = createClient()
    const [
      { data: s }, { data: v }, { data: n },
      { data: av }, { data: as_ }, { data: rn },
      { data: tf }, { data: sv }, { data: ts },
    ] = await Promise.all([
      supabase.from('stadiums').select('*').eq('id', id).single(),
      supabase.from('stadium_visits').select('*').eq('stadium_id', id).order('visit_date', { ascending: false }),
      supabase.from('stadium_notes').select('notes').eq('stadium_id', id).maybeSingle(),
      supabase.from('stadium_visits').select('stadium_id, moments'),
      supabase.from('stadiums').select('id, league, division'),
      supabase.from('retired_numbers').select('*').eq('team_id', id).order('year_retired'),
      supabase.from('stadium_trending_food').select('*').eq('stadium_id', id),
      supabase.from('stadium_souvenirs').select('*').eq('stadium_id', id),
      supabase.from('trip_stops').select('game_date').eq('stadium_id', id).not('game_date', 'is', null)
        .gte('game_date', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })),
    ])
    setStadium(s)
    setVisits(v ?? [])

    // Fetch promo data for visits that came from a trip stop
    const tripIds = (v ?? []).map(vis => vis.trip_id).filter(Boolean) as string[]
    if (tripIds.length > 0) {
      const { data: promoStops } = await supabase
        .from('trip_stops')
        .select('trip_id, promotions, promotion_photos')
        .in('trip_id', tripIds)
        .eq('stadium_id', id)
        .not('promotions', 'is', null)
      if (promoStops && promoStops.length > 0) {
        const map: Record<string, { promotions: string[]; promotion_photos: Record<string, string> }> = {}
        for (const ps of promoStops) {
          const visit = (v ?? []).find(vis => vis.trip_id === ps.trip_id)
          if (visit) map[visit.id] = {
            promotions: ps.promotions ?? [],
            promotion_photos: (ps.promotion_photos ?? {}) as Record<string, string>,
          }
        }
        setVisitPromos(map)
      }
    }
    const note = (n as StadiumNote | null)?.notes ?? ''
    setStadiumNote(note)
    setNoteInput(note)
    const avRows = (av ?? []) as { stadium_id: string; moments: string[] | null }[]
    setAllGlobalMoments(new Set(avRows.flatMap(r => r.moments ?? [])))
    const stadiumList = (as_ ?? []) as MiniStadium[]
    setRetiredNumbers((rn ?? []) as RetiredNumber[])
    setTrendingFood((tf ?? []) as StadiumTrendingFood[])
    setSouvenirs((sv ?? []) as StadiumSouvenir[])
    const stops = (ts ?? []) as { game_date: string }[]
    setTripMonths(new Set(stops.map(s => new Date(s.game_date + 'T12:00:00').getMonth() + 1)))
    setLoading(false)

    if (checkMilestones) {
      const allVisitsFull = (v ?? []) as StadiumVisit[]
      const newEarned = MILESTONES.filter(m => m.check(allVisitsFull, stadiumList as unknown as Stadium[], [], [], []))
      const newEarnedIds = new Set(newEarned.map(m => m.id))
      const newly = newEarned.filter(m => !prevEarnedIdsRef.current.has(m.id))
      if (newly.length > 0) {
        setUnlockedMilestones(newly.map(m => ({ name: m.name, icon: m.icon })))
        setTimeout(() => setUnlockedMilestones([]), 8000)
      }
      prevEarnedIdsRef.current = newEarnedIds
    } else {
      const allVisitsFull = (v ?? []) as StadiumVisit[]
      const earned = MILESTONES.filter(m => m.check(allVisitsFull, stadiumList as unknown as Stadium[], [], [], []))
      prevEarnedIdsRef.current = new Set(earned.map(m => m.id))
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  const fetchCollection = useCallback(async () => {
    if (visits.length === 0) return
    const visitIds = visits.map(v => v.id)
    const supabase = createClient()
    const { data: collectibles } = await supabase
      .from('collectible_log')
      .select('id, name, category, giveaway_type, photo_url, signed_by, acquired_from, rating, price, stadium_visit_id')
      .in('stadium_visit_id', visitIds)
      .order('created_at', { ascending: false })
    if (collectibles) setStadiumCollectibles(collectibles)
  }, [visits])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchCollection() }, [fetchCollection])

  const visitsByYear = visits.reduce<Record<string, typeof visits>>((acc, v) => {
    const year = v.visit_date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year].push(v)
    return acc
  }, {})
  const sortedYears = Object.keys(visitsByYear).sort((a, b) => Number(b) - Number(a))

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'stadium-info') setIntelSubTab('food')
  }, [activeTab])

  // Lazy-load weather when the stadium-info tab is first opened
  useEffect(() => {
    if (activeTab !== 'stadium-info' || !stadium || weather !== null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeatherLoading(true)
    fetch(`/api/stadium-weather?stadiumId=${stadium.id}`)
      .then(r => r.json())
      .then(d => setWeather(d.data ?? []))
      .catch(() => setWeather([]))
      .finally(() => setWeatherLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, stadium])

  useEffect(() => {
    if (!stadium) return
    fetchUpcomingHomeGames(stadium.abbreviation).then(setUpcomingGames)
    fetchStadiumPhoto(stadium.abbreviation).then(setStadiumPhoto)
    fetchVenueDimensions(stadium.abbreviation).then(setVenueDimensions)
    fetchTeamSeasonStats(stadium.abbreviation).then(setTeamStats)
    fetchTeamRoster(stadium.abbreviation).then(setRoster)
    fetchRecentTransactions(stadium.abbreviation).then(setTransactions)
    fetchStadiumSummary(stadium.abbreviation).then(setStadiumSummary)
    fetchTeamNews(stadium.abbreviation).then(setTeamNews)
    fetchMinorLeagueAffiliates(stadium.abbreviation).then(setAffiliates)
    fetch(`/api/youtube-search?q=${encodeURIComponent(stadium.name + ' ballpark tour')}`)
      .then(r => r.json()).then(d => setTourVideoId(d.videoId ?? null))
  }, [stadium])

  useEffect(() => {
    if (!expandedVisit || !stadium) return
    const visit = visits.find(v => v.id === expandedVisit)
    if (!visit || visit.stats_auto_populated) return
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    if (visit.visit_date >= today) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetchingStats(expandedVisit)
    fetch('/api/autofill-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId: visit.id, visitDate: visit.visit_date, stadiumAbbr: stadium.abbreviation }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setStatsError(prev => ({ ...prev, [expandedVisit]: data.error }))
        else load()
      })
      .catch(() => setStatsError(prev => ({ ...prev, [expandedVisit]: 'Could not reach MLB API' })))
      .finally(() => setFetchingStats(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedVisit])

  async function saveNote() {
    setSavingNote(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('stadium_notes').upsert(
      { stadium_id: id, notes: noteInput || null, updated_by: user?.id ?? null },
      { onConflict: 'stadium_id' }
    )
    setStadiumNote(noteInput)
    setEditingNote(false)
    setSavingNote(false)
  }

  async function deleteVisit(visitId: string) {
    if (!confirm('Delete this game record?')) return
    const supabase = createClient()
    await supabase.from('stadium_visits').delete().eq('id', visitId)
    setExpandedVisit(null)
    await load()
  }

  async function undoLastVisit() {
    const last = visits[0]
    if (!last) return
    if (!confirm('Remove your most recent game record at this stadium?')) return
    await deleteVisit(last.id)
  }

  async function shareStadium() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: stadium?.name ?? 'Stadium', url }) } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    }
  }

  async function triggerAutofill(visitId: string) {
    setAutofillState({ phase: 'loading' })
    try {
      const res = await fetch('/api/autofill-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId }),
      })
      const data = await res.json()
      if (data.success) {
        setAutofillState({ phase: 'success', score: data.score, events: data.events })
        await load()
        setTimeout(() => setAutofillState(null), 8000)
      } else if (data.code === 'not_final' || data.code === 'no_home_game') {
        setAutofillState(null)
      } else {
        setAutofillState({ phase: 'error', msg: data.error ?? 'Could not fetch game stats' })
        setTimeout(() => setAutofillState(null), 6000)
      }
    } catch {
      setAutofillState({ phase: 'error', msg: 'Could not reach MLB API' })
      setTimeout(() => setAutofillState(null), 6000)
    }
  }

  function openAdd() { setEditingVisit(undefined); setShowForm(true) }
  function openEdit(visit: StadiumVisit) { setEditingVisit(visit); setShowForm(true) }

  if (loading) {
    return (
      <div style={{ color: '#E6EDF3' }}>
        {/* Hero skeleton */}
        <div style={{ height: 260, backgroundColor: '#1C2430', position: 'relative', overflow: 'hidden' }}>
          <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
        </div>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
          {/* Stats row skeleton */}
          <div style={{ display: 'flex', gap: 8, padding: '14px 0', borderBottom: '1px solid #30363D' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: 72, borderRadius: 12, backgroundColor: '#1C2430', overflow: 'hidden', position: 'relative' }}>
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
              </div>
            ))}
          </div>
          {/* Action button skeleton */}
          <div style={{ padding: '16px 0' }}>
            <div style={{ height: 48, borderRadius: 12, backgroundColor: '#1C2430', overflow: 'hidden', position: 'relative' }}>
              <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
            </div>
          </div>
          {/* Tab bar skeleton */}
          <div style={{ display: 'flex', gap: 4, borderTop: '1px solid #30363D', borderBottom: '1px solid #30363D', padding: '4px 0' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: 40, borderRadius: 6, backgroundColor: '#1C2430', overflow: 'hidden', position: 'relative', margin: '4px' }}>
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stadium) {
    return (
      <div style={{ padding: 32, color: '#8B949E' }}>Stadium not found.</div>
    )
  }

  const visited    = visits.length > 0
  const colors     = TEAM_GRADIENTS[stadium.abbreviation] ?? ['#0B1117', '#161B22']
  const teamColor  = TEAM_BTN_COLOR[stadium.abbreviation] ?? '#1F6FEB'

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'games-attended',  label: 'Games Attended'   },
    { key: 'upcoming-games',  label: 'Upcoming Games'   },
    { key: 'stadium-info',    label: 'Stadium Detail'   },
    { key: 'roster',          label: 'Roster'           },
  ]

  function visitLookup(visitId: string | null) {
    if (!visitId) return null
    return visits.find(v => v.id === visitId) ?? null
  }

  return (
    <div style={{ color: '#E6EDF3' }}>
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
            alt="Photo"
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
      <main style={{ minHeight: '100vh' }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
          }} />
          {stadiumPhoto && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={stadiumPhoto}
              alt={stadium.name}
              onError={() => setStadiumPhoto(null)}
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
          <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
            <Link href="/stadiums" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
              color: '#ffffff', padding: '7px 14px 7px 10px', borderRadius: 20,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}>
              <ArrowLeft size={15} /> Back
            </Link>
          </div>
          {/* Share icon — top right corner of hero */}
          <button
            onClick={shareStadium}
            aria-label="Share this stadium"
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              width: 38, height: 38, borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Share2 size={16} color="#ffffff" />
          </button>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 18px', zIndex: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              {stadium.team}
            </div>
            <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
              {stadium.name}
            </h1>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>
              {stadium.city}, {stadium.state}
            </div>
          </div>
        </div>

        {/* ── Max-width wrapper ─────────────────────────────────────── */}
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* ── STATS ROW ────────────────────────────────────────────── */}
          <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D', padding: '14px 12px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { Icon: Users,       value: stadium.capacity ? stadium.capacity.toLocaleString() : '—', label: 'Capacity'    },
                { Icon: CalendarDays, value: stadium.opened ? String(stadium.opened) : '—',              label: 'Opened'      },
                { Icon: Trophy,      value: `${stadium.league} ${stadium.division}`,                    label: 'Division'    },
              ].map(({ Icon, value, label }) => (
                <div key={label} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  backgroundColor: '#1C2430', borderRadius: 12, padding: '12px 6px',
                  border: '1px solid #30363D',
                }}>
                  <Icon size={15} color="#1F6FEB" strokeWidth={2} style={{ marginBottom: 5 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#E6EDF3', lineHeight: 1.2, textAlign: 'center' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CELEBRATORY BANNER + ACTION BUTTONS ──────────────────── */}
          <div style={{ padding: '16px 16px 0' }}>
            {visited ? (
              <div style={{ marginBottom: 16 }}>
                {/* Team-color gradient banner */}
                <div style={{
                  background: `linear-gradient(135deg, ${colors[0]}E6 0%, ${colors[1]}E6 100%)`,
                  borderRadius: 14, padding: '18px 20px', marginBottom: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TeamLogo abbreviation={stadium.abbreviation} size={40} />
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                        ⚾ You&apos;ve been here!
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 3 }}>
                        {(() => {
                          const scored = visits.filter(v => v.home_runs != null && v.away_runs != null)
                          const w = scored.filter(v => v.home_runs! > v.away_runs!).length
                          const l = scored.filter(v => v.home_runs! < v.away_runs!).length
                          const record = scored.length > 0 ? ` · ${w}–${l}` : ''
                          return `${visits.length} game${visits.length !== 1 ? 's' : ''}${record} · Last visited ${formatDate(visits[0].visit_date)}`
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Secondary action — Log Game (outlined) */}
                <button
                  onClick={openAdd}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                    backgroundColor: 'transparent', color: '#F5A623',
                    border: `1.5px solid ${teamColor}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    marginBottom: 6,
                  }}
                >
                  <Plus size={15} /> Log Game
                </button>
                {/* Undo as text link */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={undoLastVisit}
                    style={{ background: 'none', border: 'none', padding: '4px 8px', fontSize: 12, color: '#8B949E', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Undo last visit
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={openAdd}
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

          {/* ── STICKY TAB BAR ───────────────────────────────────────── */}
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
                    borderBottom: activeTab === key ? '2px solid #1F6FEB' : '2px solid transparent',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB CONTENT ──────────────────────────────────────────── */}
          <div style={{ padding: '28px 16px' }}>

            {/* ── GAMES ATTENDED TAB ───────────────────────────────── */}
            {activeTab === 'games-attended' && (
              <section>
                {visits.length === 0 ? (
                  <div style={{
                    background: `linear-gradient(160deg, ${colors[0]}22 0%, ${colors[1]}18 100%), #161B22`,
                    borderRadius: 14, padding: '28px 24px', textAlign: 'center',
                    border: `1px solid ${teamColor}22`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                      <TeamLogo abbreviation={stadium.abbreviation} size={64} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#E6EDF3', marginBottom: 6 }}>
                      Your first game at {stadium.name}
                    </div>
                    <div style={{ fontSize: 14, color: '#8B949E', marginBottom: 20 }}>
                      Photos, notes, game scores — all in one place
                    </div>
                    <button
                      onClick={openAdd}
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
                  <>
                    {/* Compact game list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {sortedYears.map(year => (
                        <div key={year}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '18px 0 10px' }}>
                            {year} Season · {visitsByYear[year].length} game{visitsByYear[year].length !== 1 ? 's' : ''}
                          </div>
                          {visitsByYear[year].map((visit) => {
                          const isExpanded = expandedVisit === visit.id
                          const hasScore = visit.home_runs != null && visit.away_runs != null
                          const homeWon = hasScore && (visit.home_runs! > visit.away_runs!)
                          const borderColor = hasScore
                            ? (homeWon ? '#3FB950' : '#F85149')
                            : '#30363D'
                          const opponent = (visit.visiting_team ?? '—').replace(/^vs\.?\s+/i, '')
                          const scoreStr = hasScore
                            ? ` · ${visit.away_runs}–${visit.home_runs}`
                            : ''
                          const giveawayName = visitPromos[visit.id]?.promotions?.[0]
                          return (
                            <button
                              key={visit.id}
                              onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 14px',
                                backgroundColor: isExpanded ? '#1C2430' : '#161B22',
                                border: '1px solid #30363D',
                                borderLeft: `3px solid ${borderColor}`,
                                borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                              }}
                            >
                              {/* Team logo — always show logo on collapsed row */}
                              <div style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <TeamLogo abbreviation={stadium.abbreviation} size={40} />
                              </div>

                              {/* Center: date + matchup */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 3, fontWeight: 500 }}>
                                  {formatDate(visit.visit_date)}
                                </div>
                                <div style={{
                                  fontSize: 14, fontWeight: 700, color: '#E6EDF3',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                  <span>vs {opponent}{scoreStr}</span>
                                  {hasScore && (
                                    <span style={{
                                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                      backgroundColor: homeWon ? '#3FB950' : '#F85149',
                                    }} />
                                  )}
                                </div>
                              </div>

                              {/* Right: giveaway icon + chevron */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {giveawayName && (
                                  <span style={{ fontSize: 13 }}>{guessGiveawayEmoji(giveawayName)}</span>
                                )}
                                <ChevronRight
                                  size={16}
                                  color={isExpanded ? '#E6EDF3' : '#8B949E'}
                                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                                />
                              </div>
                            </button>
                          )
                        })}
                        </div>
                      ))}
                    </div>

                    {/* Expanded BoxScore */}
                    {expandedVisit && (() => {
                      const visit = visits.find(v => v.id === expandedVisit)
                      if (!visit) return null
                      const promos = visitPromos[visit.id]
                      return (
                        <>
                          <BoxScore
                            visit={visit}
                            stadium={stadium}
                            firstTimeMoments={firstTimeMoments}
                            fetchingStats={fetchingStats === visit.id}
                            statsError={statsError[visit.id] ?? null}
                            onEdit={() => openEdit(visit)}
                            // eslint-disable-next-line react-hooks/refs -- deleteVisit only reads prevEarnedIdsRef inside load(), invoked from this click handler, never during render
                            onDelete={() => { deleteVisit(visit.id) }}
                          />
                          {promos && promos.promotions.length > 0 && (
                            <div style={{
                              margin: '8px 0 0', padding: '14px 16px',
                              backgroundColor: 'rgba(245,166,35,0.05)',
                              border: '1px solid rgba(245,166,35,0.2)',
                              borderRadius: 12,
                            }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(245,166,35,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                Promotions
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {promos.promotions.map(name => {
                                  const photoUrl = promos.promotion_photos[name] ?? null
                                  return (
                                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <span style={{ fontSize: 13, color: '#F5A623', fontWeight: 600, flex: 1, minWidth: 0 }}>🎁 {name}</span>
                                      {photoUrl && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={photoUrl} alt={name}
                                          style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', display: 'block', cursor: 'pointer', flexShrink: 0 }}
                                          onClick={() => setLightboxUrl(photoUrl)} />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                )}

                <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#E6EDF3' }}>
                        Your Collection at {stadium.name}
                      </div>
                      <button
                        onClick={() => setEditingItem({ id: 'new', name: '', category: 'giveaway', photoUrl: null, scopedStadiumId: stadium.id })}
                        style={{ fontSize: 13, fontWeight: 600, color: '#58A6FF', background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                      >
                        + Add Item
                      </button>
                    </div>

                    {stadiumCollectibles.length === 0 && (
                      <div style={{ fontSize: 13, color: '#8B949E', padding: '4px 0 4px' }}>
                        Nothing logged yet — tap &ldquo;+ Add Item&rdquo; to start your collection at this stadium.
                      </div>
                    )}

                    {stadiumCollectibles.filter(c => c.category !== 'food').length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                          🎁 Collectibles ({stadiumCollectibles.filter(c => c.category !== 'food').length})
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                          {stadiumCollectibles.filter(c => c.category !== 'food').map(c => (
                            <div
                              key={c.id}
                              onClick={() => setEditingItem({
                                id: c.id,
                                name: c.name,
                                category: c.category,
                                giveawayType: c.giveaway_type,
                                photoUrl: c.photo_url,
                                signedBy: c.signed_by,
                                acquiredFrom: c.acquired_from,
                              })}
                              style={{ backgroundColor: '#161B22', borderRadius: 10, border: '1px solid #30363D', overflow: 'hidden', cursor: 'pointer' }}
                            >
                              <div style={{ position: 'relative', paddingBottom: '100%', backgroundColor: '#1C2430' }}>
                                {c.photo_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={c.photo_url} alt={c.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                                    {c.category === 'memorabilia' ? '✍️' : c.category === 'souvenir' ? '🛍️' : '🎁'}
                                  </div>
                                )}
                              </div>
                              {(() => {
                                const v = visitLookup(c.stadium_visit_id)
                                if (!v) return null
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px 0' }}>
                                    <TeamLogo abbreviation={stadium.abbreviation} size={14} />
                                    <span style={{ fontSize: 11, color: '#8B949E' }}>{formatDate(v.visit_date)}</span>
                                  </div>
                                )
                              })()}
                              <div style={{ padding: '10px 12px 12px' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                                  {c.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#F5A623', fontWeight: 600, textTransform: 'capitalize' }}>
                                  {c.category}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {stadiumCollectibles.filter(c => c.category === 'food').length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                          🍔 Food & Drink ({stadiumCollectibles.filter(c => c.category === 'food').length})
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                          {stadiumCollectibles.filter(c => c.category === 'food').map(item => (
                            <div
                              key={item.id}
                              onClick={() => setEditingItem({
                                id: item.id,
                                name: item.name,
                                category: item.category,
                                photoUrl: item.photo_url,
                                rating: item.rating,
                                price: item.price,
                              })}
                              style={{ backgroundColor: '#161B22', borderRadius: 10, border: '1px solid #30363D', overflow: 'hidden', cursor: 'pointer' }}
                            >
                              <div style={{ position: 'relative', paddingBottom: '100%', backgroundColor: '#1C2430' }}>
                                {item.photo_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={item.photo_url} alt={item.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍽️</div>
                                )}
                              </div>
                              {(() => {
                                const v = visitLookup(item.stadium_visit_id)
                                if (!v) return null
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px 0' }}>
                                    <TeamLogo abbreviation={stadium.abbreviation} size={14} />
                                    <span style={{ fontSize: 11, color: '#8B949E' }}>{formatDate(v.visit_date)}</span>
                                  </div>
                                )
                              })()}
                              <div style={{ padding: '10px 12px 12px' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                                  {item.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#F5A623', fontWeight: 600, textTransform: 'capitalize' }}>
                                  {item.category}
                                </div>
                                {item.rating && <div style={{ fontSize: 13, color: '#F5A623', marginTop: 4 }}>{'⭐'.repeat(item.rating)}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </section>
            )}

            {/* ── UPCOMING GAMES TAB ───────────────────────────────── */}
            {activeTab === 'upcoming-games' && (
              <>
                {/* Upcoming Home Games */}
                {upcomingGames.length > 0 ? (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={CalendarDays}>Upcoming Home Games</SectionTitle>
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #30363D' }}>
                      <div style={{ backgroundColor: '#0B1117', maxHeight: 360, overflowY: 'auto' }}>
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
                                  <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 600 }}>{dayAbbr}</div>
                                  <div style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 700 }}>{dateStr}</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#E6EDF3' }}>
                                    <span style={{ color: '#3FB950', marginRight: 4 }}>vs</span>
                                    {g.awayTeam}
                                  </div>
                                  {g.promotions.length > 0 && (
                                    <div style={{ fontSize: 13, color: '#F5A623', marginTop: 2 }}>
                                      🎁 {g.promotions[0]}{g.promotions.length > 1 ? ` +${g.promotions.length - 1} more` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#E6EDF3' }}>{timeStr} PT</div>
                                <Link
                                  href="/trips"
                                  style={{ fontSize: 13, fontWeight: 700, color: '#1F6FEB', textDecoration: 'none', whiteSpace: 'nowrap' }}
                                >
                                  Plan Trip →
                                </Link>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </section>
                ) : (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={CalendarDays}>Upcoming Home Games</SectionTitle>
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '24px 16px', textAlign: 'center', color: '#8B949E', fontSize: 14 }}>
                      No upcoming games found.{' '}
                      <a href={`https://www.mlb.com/${MLB_SCHEDULE_SLUG[stadium.abbreviation] ?? stadium.abbreviation.toLowerCase()}/schedule`} target="_blank" rel="noopener noreferrer" style={{ color: '#1F6FEB', fontWeight: 600, textDecoration: 'none' }}>
                        Check MLB.com →
                      </a>
                    </div>
                  </section>
                )}

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
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', backgroundColor: 'rgba(139,148,158,0.12)', padding: '3px 10px', borderRadius: 20 }}>
                          General
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

                {/* Team News */}
                {teamNews.length > 0 && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Trophy}>Team News</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {teamNews.map((item, i) => (
                        <a
                          key={i}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12, backgroundColor: '#161B22', border: '1px solid #30363D', textDecoration: 'none' }}
                        >
                          {item.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={item.imageUrl} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.4, marginBottom: 4 }}>{item.headline}</div>
                            <div style={{ fontSize: 13, color: '#8B949E' }}>
                              {new Date(item.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ESPN
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ── STADIUM INFO TAB ─────────────────────────────────── */}
            {activeTab === 'stadium-info' && (
              <>
                {/* About */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={Building2}>About</SectionTitle>
                  <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                    {[
                      { label: 'Full Name', value: stadium.name },
                      { label: 'Team', value: stadium.team },
                      { label: 'City', value: `${stadium.city}, ${stadium.state}` },
                      { label: 'League / Division', value: `${stadium.league} ${stadium.division}` },
                      stadium.capacity ? { label: 'Capacity', value: stadium.capacity.toLocaleString() } : null,
                      stadium.opened ? { label: 'Opened', value: String(stadium.opened) } : null,
                      stadium.surface ? { label: 'Surface', value: stadium.surface } : null,
                    ].filter(Boolean).map((row, i, arr) => (
                      <div key={row!.label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: i < arr.length - 1 ? '1px solid #30363D' : 'none',
                      }}>
                        <span style={{ fontSize: 13, color: '#8B949E' }}>{row!.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{row!.value}</span>
                      </div>
                    ))}
                  </div>
                  {stadiumSummary && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid #30363D', fontSize: 13, color: '#8B949E', lineHeight: 1.7 }}>
                      {stadiumSummary}
                    </div>
                  )}
                </section>

                {/* Food & Souvenirs sub-tabs */}
                {(trendingFood.length > 0 || souvenirs.length > 0) && (
                  <section style={{ marginBottom: 32 }}>
                    {/* Sub-tab pill bar */}
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

                    {/* Food content */}
                    {intelSubTab === 'food' && (() => {
                      const classics = trendingFood.filter(f => f.is_classic)
                      const seasonal = trendingFood.filter(f => !f.is_classic && f.active && f.season_year === 2026)
                      if (classics.length === 0 && seasonal.length === 0) return (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8B949E', fontSize: 13 }}>
                          No food intel yet for this stadium.
                        </div>
                      )
                      return (
                        <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                          {classics.length > 0 && (
                            <>
                              <div style={{ padding: '10px 16px 4px', fontSize: 12, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                Classics
                              </div>
                              {classics.map((f, i) => (
                                <div key={f.id} style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10,
                                  padding: '10px 16px',
                                  borderBottom: (i < classics.length - 1 || seasonal.length > 0) ? '1px solid rgba(48,54,61,0.6)' : 'none',
                                }}>
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
                              <div style={{ padding: '10px 16px 4px', fontSize: 12, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                This Season
                              </div>
                              {seasonal.map((f, i) => (
                                <div key={f.id} style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10,
                                  padding: '10px 16px',
                                  borderBottom: i < seasonal.length - 1 ? '1px solid rgba(48,54,61,0.6)' : 'none',
                                }}>
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

                    {/* Souvenirs content */}
                    {intelSubTab === 'souvenirs' && (() => {
                      const classics = souvenirs.filter(s => s.is_classic)
                      const seasonal = souvenirs.filter(s => !s.is_classic && s.active && s.season_year === 2026)
                      if (classics.length === 0 && seasonal.length === 0) return (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8B949E', fontSize: 13 }}>
                          No souvenir intel yet for this stadium.
                        </div>
                      )
                      return (
                        <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                          {classics.length > 0 && (
                            <>
                              <div style={{ padding: '10px 16px 4px', fontSize: 12, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                Classics
                              </div>
                              {classics.map((s, i) => (
                                <div key={s.id} style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10,
                                  padding: '10px 16px',
                                  borderBottom: (i < classics.length - 1 || seasonal.length > 0) ? '1px solid rgba(48,54,61,0.6)' : 'none',
                                }}>
                                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🏆</span>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{s.item_name}</div>
                                    {s.description && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{s.description}</div>}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                          {seasonal.length > 0 && (
                            <>
                              <div style={{ padding: '10px 16px 4px', fontSize: 12, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                This Season
                              </div>
                              {seasonal.map((s, i) => (
                                <div key={s.id} style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10,
                                  padding: '10px 16px',
                                  borderBottom: i < seasonal.length - 1 ? '1px solid rgba(48,54,61,0.6)' : 'none',
                                }}>
                                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⭐</span>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{s.item_name}</div>
                                    {s.description && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{s.description}</div>}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </section>
                )}

                {/* Best Time to Visit */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={CalendarDays}>Best Time to Visit</SectionTitle>
                  {DOME_STADIUMS.has(stadium.abbreviation) ? (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '20px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: RETRACTABLE_ROOF.has(stadium.abbreviation) ? 10 : 0 }}>
                        <span style={{ fontSize: 22 }}>🏟️</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3' }}>Climate Controlled</div>
                          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>Great any time of year</div>
                        </div>
                        <span style={{
                          marginLeft: 'auto', fontSize: 13, fontWeight: 700,
                          color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.12)',
                          border: '1px solid rgba(63,185,80,0.3)', borderRadius: 20, padding: '3px 10px',
                        }}>🟢 Any Month</span>
                      </div>
                      {RETRACTABLE_ROOF.has(stadium.abbreviation) && (
                        <div style={{ fontSize: 12, color: '#8B949E', borderTop: '1px solid #30363D', paddingTop: 10, marginTop: 4 }}>
                          ☀️ Roof opens when weather permits
                        </div>
                      )}
                    </div>
                  ) : weatherLoading ? (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '28px 16px', textAlign: 'center', color: '#8B949E', fontSize: 13 }}>
                      Loading weather data…
                    </div>
                  ) : weather && weather.length > 0 ? (() => {
                    const bbMonths = BASEBALL_MONTHS
                      .map(m => weather.find(w => w.month === m))
                      .filter((w): w is StadiumWeather => !!w)

                    // Best window: top months rated good or above, by rating then proximity to 74°F
                    const ranked = [...bbMonths].sort((a, b) => {
                      const rd = RATING_PRIORITY[b.rating] - RATING_PRIORITY[a.rating]
                      return rd !== 0 ? rd : Math.abs(a.avg_high_temp - 74) - Math.abs(b.avg_high_temp - 74)
                    })
                    const bestMonthNums = new Set(
                      ranked
                        .filter(m => m.rating === 'great' || m.rating === 'good')
                        .slice(0, 3)
                        .map(m => m.month)
                    )

                    // Summary line — rain description based on actual best-month data
                    const bestList = [...bestMonthNums].sort((a, b) => a - b)
                    const bestData = bbMonths.filter(m => bestMonthNums.has(m.month))
                    const avgTemp  = bestData.length ? Math.round(bestData.reduce((s, m) => s + m.avg_high_temp, 0) / bestData.length) : null
                    const avgRain  = bestData.length ? bestData.reduce((s, m) => s + m.avg_precip_days, 0) / bestData.length : null
                    const rainDesc = avgRain == null ? '' : avgRain < 5 ? 'lower rain chance' : avgRain < 8 ? 'some rain expected' : 'frequent rain'

                    let rangeStr = ''
                    if (bestList.length === 1) {
                      rangeStr = MONTH_NAMES[bestList[0]]
                    } else if (bestList.length >= 2) {
                      const isConsec = bestList.every((m, i) => i === 0 || m - bestList[i - 1] === 1)
                      rangeStr = isConsec
                        ? `${MONTH_NAMES[bestList[0]]}–${MONTH_NAMES[bestList[bestList.length - 1]]}`
                        : bestList.map(m => MONTH_NAMES[m]).join(', ')
                    }

                    return (
                      <>
                        {/* Summary banner */}
                        {rangeStr && (
                          <div style={{
                            backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D',
                            padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
                          }}>
                            <span style={{ fontSize: 18 }}>🗓️</span>
                            <span style={{ fontSize: 13, color: '#8B949E' }}>
                              Best time to visit:{' '}
                              <span style={{ color: '#E6EDF3', fontWeight: 700 }}>{rangeStr}</span>
                              {avgTemp && <> · Avg {avgTemp}°F</>}
                              {rainDesc && <> · {rainDesc}</>}
                            </span>
                          </div>
                        )}

                        {/* Month cards — 7-across, no horizontal scroll */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                          {bbMonths.map(w => {
                            const isBest     = bestMonthNums.has(w.month)
                            const isTripMonth = tripMonths.has(w.month)
                            const color      = RATING_COLOR[w.rating]
                            const borderColor = isTripMonth ? '#F5A623' : isBest ? color + '66' : '#30363D'
                            const shadow      = isTripMonth ? '0 0 10px rgba(245,166,35,0.25)' : isBest ? `0 0 8px ${color}22` : 'none'
                            return (
                              <div key={w.month} style={{
                                backgroundColor: '#161B22',
                                borderRadius: 10,
                                border: `1px solid ${borderColor}`,
                                padding: '6px 3px 7px',
                                textAlign: 'center',
                                boxShadow: shadow,
                              }}>
                                {/* Badge row — fixed height keeps all cards aligned */}
                                <div style={{ height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                  {(isTripMonth || isBest) && (
                                    <div style={{
                                      fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
                                      color: '#fff',
                                      backgroundColor: isTripMonth ? '#F5A623' : '#1F6FEB',
                                      borderRadius: 20, padding: '1px 5px',
                                    }}>
                                      {isTripMonth ? 'Your Trip' : 'Best'}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: isTripMonth ? '#F5A623' : '#8B949E', marginBottom: 4 }}>
                                  {MONTH_NAMES[w.month]}
                                </div>
                                <div style={{ fontSize: 14, marginBottom: 3 }}>
                                  {RATING_LABEL[w.rating].split(' ')[0]}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>
                                  {Math.round(w.avg_high_temp)}°
                                </div>
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

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, paddingLeft: 2 }}>
                          {(['great', 'good', 'fair', 'avoid'] as const).map(r => (
                            <span key={r} style={{ fontSize: 13, color: '#8B949E' }}>
                              {RATING_LABEL[r]}
                            </span>
                          ))}
                        </div>
                      </>
                    )
                  })() : (
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '28px 16px', textAlign: 'center', color: '#8B949E', fontSize: 13 }}>
                      Weather data unavailable.
                    </div>
                  )}
                </section>

                {/* Virtual Tour */}
                {tourVideoId && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Map}>Virtual Tour</SectionTitle>
                    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #30363D', aspectRatio: '16/9', position: 'relative', backgroundColor: '#161B22' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${tourVideoId}?rel=0&modestbranding=1`}
                        title={`${stadium.name} tour`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      />
                    </div>
                  </section>
                )}

                {/* Retired Numbers */}
                {retiredNumbers.length > 0 && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Hash}>Retired Numbers</SectionTitle>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {retiredNumbers.map(rn => (
                        <div key={rn.id} style={{
                          backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D',
                          padding: '10px 14px', textAlign: 'center', minWidth: 72,
                        }}>
                          <div style={{ fontSize: 24, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{rn.number}</div>
                          <div style={{ fontSize: 13, color: '#F5A623', marginTop: 4, lineHeight: 1.3 }}>{rn.player_name}</div>
                          <div style={{ fontSize: 12, color: '#6E7681', marginTop: 2 }}>{rn.year_retired}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Field Dimensions */}
                {venueDimensions && (venueDimensions.leftLine || venueDimensions.center) && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Map}>Field Dimensions</SectionTitle>
                    {/* Diamond diagram */}
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '20px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16, textAlign: 'center' }}>
                        {[
                          { label: 'Left Line',    value: venueDimensions.leftLine },
                          { label: 'Center',       value: venueDimensions.center },
                          { label: 'Right Line',   value: venueDimensions.rightLine },
                          { label: 'Left-Center',  value: venueDimensions.leftCenter },
                          { label: 'Right-Center', value: venueDimensions.rightCenter },
                        ].filter(r => r.value).map(({ label, value }) => (
                          <div key={label} style={{ backgroundColor: '#1C2430', borderRadius: 10, padding: '10px 6px' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#3FB950', lineHeight: 1 }}>{value}<span style={{ fontSize: 13, fontWeight: 600, color: '#8B949E' }}>ft</span></div>
                            <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 600 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {venueDimensions.roofType && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid #30363D', borderRadius: 20, padding: '4px 10px' }}>
                            🏟️ {venueDimensions.roofType} roof
                          </span>
                        )}
                        {venueDimensions.turfType && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid #30363D', borderRadius: 20, padding: '4px 10px' }}>
                            🌿 {venueDimensions.turfType}
                          </span>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* This Season */}
                {teamStats && (teamStats.wins !== null || teamStats.era) && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Trophy}>This Season</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {teamStats.wins !== null && teamStats.losses !== null && (
                        <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{teamStats.wins}–{teamStats.losses}</div>
                          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Record</div>
                        </div>
                      )}
                      {teamStats.era && (
                        <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{teamStats.era}</div>
                          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team ERA</div>
                        </div>
                      )}
                      {teamStats.avg && (
                        <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{teamStats.avg}</div>
                          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team AVG</div>
                        </div>
                      )}
                      {teamStats.homeRuns != null && (
                        <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{teamStats.homeRuns}</div>
                          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Home Runs</div>
                        </div>
                      )}
                      {teamStats.runsScored != null && (
                        <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{teamStats.runsScored}</div>
                          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Runs Scored</div>
                        </div>
                      )}
                      {teamStats.strikeouts != null && (
                        <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{teamStats.strikeouts}</div>
                          <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Strikeouts</div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Minor League Affiliates */}
                {affiliates.length > 0 && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={Trophy}>Minor League Affiliates</SectionTitle>
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                      {affiliates.map((a, i) => (
                        <div key={a.level} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderBottom: i < affiliates.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{a.name}</span>
                            {a.leagueName && (
                              <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>{a.leagueName}</div>
                            )}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.12)', padding: '3px 10px', borderRadius: 10, flexShrink: 0 }}>
                            {a.level}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Directions & Links */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle Icon={Map}>Directions &amp; Links</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(stadium.name + ' ' + stadium.city + ' ' + stadium.state)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 12, textDecoration: 'none',
                        backgroundColor: '#161B22', border: '1px solid #30363D',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>📍 Google Maps</span>
                      <span style={{ fontSize: 13, color: '#1F6FEB' }}>Open ↗</span>
                    </a>
                    <a
                      href={`https://www.mlb.com/${stadium.abbreviation.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 12, textDecoration: 'none',
                        backgroundColor: '#161B22', border: '1px solid #30363D',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>⚾ Team Website</span>
                      <span style={{ fontSize: 13, color: '#1F6FEB' }}>Open ↗</span>
                    </a>
                    <a
                      href={`https://www.mlb.com/${MLB_SCHEDULE_SLUG[stadium.abbreviation] ?? stadium.abbreviation.toLowerCase()}/schedule`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 12, textDecoration: 'none',
                        backgroundColor: '#161B22', border: '1px solid #30363D',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>📅 Home Schedule</span>
                      <span style={{ fontSize: 13, color: '#1F6FEB' }}>Open ↗</span>
                    </a>
                  </div>
                </section>

                {/* Recent Moves */}
                {transactions.length > 0 && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle Icon={ChevronRight}>Recent Moves</SectionTitle>
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', overflow: 'hidden' }}>
                      {transactions.map((t, i) => {
                        const typeEmoji: Record<string, string> = {
                          DFA: '📤', OU: '📤', DL: '🤕', IL: '🤕', AA: '📥',
                          RM: '🔄', TR: '🔄', SG: '✍️', RE: '✍️', DES: '❌',
                          SE: '🌐', OUT: '📤',
                        }
                        const emoji = typeEmoji[t.typeCode] ?? '📋'
                        const date  = t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: '#E6EDF3', lineHeight: 1.4 }}>{t.description}</div>
                              {date && <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>{date}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ── ROSTER TAB ───────────────────────────────────────── */}
            {activeTab === 'roster' && (
              <section>
                {roster.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 16px', color: '#8B949E', fontSize: 14 }}>
                    Loading roster…
                  </div>
                ) : (() => {
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
                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#F5A623', width: 24, textAlign: 'right', flexShrink: 0 }}>
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
                  )
                })()}
              </section>
            )}

          </div>{/* /tab content */}
        </div>{/* /max-width */}
      </main>

      {/* ── Milestone unlock toast ──────────────────────────────── */}
      {unlockedMilestones.length > 0 && (
        <div
          className="fixed left-3 right-3 md:left-auto md:right-6 md:w-96 z-50"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 9rem)' }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #1A1500 0%, #2A2000 100%)',
            border: '1px solid rgba(245,166,35,0.5)', borderRadius: 14,
            padding: '14px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F5A623', marginBottom: 6 }}>
              🏆 Milestone{unlockedMilestones.length > 1 ? 's' : ''} Unlocked!
            </div>
            {unlockedMilestones.map(m => (
              <div key={m.name} style={{ fontSize: 13, color: '#E6EDF3', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{m.icon}</span> {m.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Autofill toast ──────────────────────────────────────── */}
      {autofillState && (
        <div
          className="fixed left-3 right-3 md:left-auto md:right-6 md:w-96 z-50"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        >
          {autofillState.phase === 'loading' ? (
            <div style={{
              background: '#161B22', border: '1px solid #30363D', borderRadius: 14,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <Loader2 size={16} className="animate-spin" style={{ color: '#1F6FEB', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>Fetching game stats…</div>
                <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>Looking up box score from MLB</div>
              </div>
            </div>
          ) : autofillState.phase === 'success' ? (
            <div style={{
              background: '#0d2116', border: '1px solid rgba(63,185,80,0.35)', borderRadius: 14,
              padding: '14px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: autofillState.score ? 6 : 0 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#3FB950' }}>Game stats loaded!</span>
              </div>
              {autofillState.score && (
                <div style={{ fontSize: 13, color: '#E6EDF3', marginBottom: 2 }}>{autofillState.score}</div>
              )}
              {autofillState.events && autofillState.events.length > 0 && (
                <div style={{ fontSize: 12, color: '#8B949E' }}>
                  {autofillState.events.map(e => GAME_EVENT_LABELS[e] ?? e).join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: '#1a1215', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 14,
              padding: '14px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F85149', marginBottom: 4 }}>
                Stats not available
              </div>
              <div style={{ fontSize: 12, color: '#8B949E' }}>{autofillState.msg}</div>
            </div>
          )}
        </div>
      )}

      {showForm && stadium && (
        <GameDayForm
          stadium={stadium}
          visit={editingVisit}
          onClose={() => { setShowForm(false); setEditingVisit(undefined) }}
          onSaved={(savedMoments, newVisitId) => {
            const otherMoments = new Set(
              visits
                .filter(v => v.id !== editingVisit?.id)
                .flatMap(v => v.moments ?? [])
            )
            const firsts = savedMoments.filter(
              m => !allGlobalMoments.has(m) || !otherMoments.has(m)
            )
            if (firsts.length > 0) {
              setFirstTimeMoments(firsts)
              setTimeout(() => setFirstTimeMoments([]), 7000)
            }
            setShowForm(false)
            setEditingVisit(undefined)
            load(true)
            if (newVisitId) triggerAutofill(newVisitId)
          }}
        />
      )}

      {editingItem && (
        <GiveawayFoodEditor
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); fetchCollection() }}
          onDeleted={() => { setEditingItem(null); fetchCollection() }}
        />
      )}
    </div>
  )
}
