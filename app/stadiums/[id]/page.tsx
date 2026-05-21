'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import GameDayForm from '@/components/GameDayForm'
import BoxScore from '@/components/BoxScore'
import { formatDate } from '@/lib/utils'
import type { Stadium, StadiumVisit, StadiumNote, RetiredNumber } from '@/types'
import { fetchUpcomingHomeGames, type UpcomingGame } from '@/lib/mlb-api'
import { fetchStadiumPhoto } from '@/lib/stadium-wikipedia'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Pencil, Save, Loader2,
  Home, MapPin, Map, Trophy, Plane,
} from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'

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

const NAV = [
  { label: 'Home',  href: '/dashboard',  icon: Home },
  { label: 'Parks', href: '/stadiums',   icon: MapPin },
  { label: 'Map',   href: '/map',        icon: Map },
  { label: 'Goals', href: '/milestones', icon: Trophy },
  { label: 'Trips', href: '/trips',      icon: Plane },
]

type MiniStadium = { id: string; league: string; division: string }
type ActiveTab = 'games-attended' | 'upcoming-games' | 'stadium-info'

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
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
  const [allVisitedIds, setAllVisitedIds] = useState<Set<string>>(new Set())
  const [allStadiums, setAllStadiums] = useState<MiniStadium[]>([])
  const [allGlobalMoments, setAllGlobalMoments] = useState<Set<string>>(new Set())
  const [firstTimeMoments, setFirstTimeMoments] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('games-attended')
  const [retiredNumbers, setRetiredNumbers] = useState<RetiredNumber[]>([])

  async function load() {
    const supabase = createClient()
    const [
      { data: s }, { data: v }, { data: n },
      { data: av }, { data: as_ }, { data: rn },
    ] = await Promise.all([
      supabase.from('stadiums').select('*').eq('id', id).single(),
      supabase.from('stadium_visits').select('*').eq('stadium_id', id).order('visit_date', { ascending: false }),
      supabase.from('stadium_notes').select('notes').eq('stadium_id', id).maybeSingle(),
      supabase.from('stadium_visits').select('stadium_id, moments'),
      supabase.from('stadiums').select('id, league, division'),
      supabase.from('retired_numbers').select('*').eq('team_id', id).order('year_retired'),
    ])
    setStadium(s)
    setVisits(v ?? [])
    const note = (n as StadiumNote | null)?.notes ?? ''
    setStadiumNote(note)
    setNoteInput(note)
    const avRows = (av ?? []) as { stadium_id: string; moments: string[] | null }[]
    setAllVisitedIds(new Set(avRows.map(r => r.stadium_id)))
    setAllGlobalMoments(new Set(avRows.flatMap(r => r.moments ?? [])))
    setAllStadiums((as_ ?? []) as MiniStadium[])
    setRetiredNumbers((rn ?? []) as RetiredNumber[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!stadium) return
    fetchUpcomingHomeGames(stadium.abbreviation).then(setUpcomingGames)
    fetchStadiumPhoto(stadium.abbreviation).then(setStadiumPhoto)
  }, [stadium])

  useEffect(() => {
    if (!expandedVisit || !stadium) return
    const visit = visits.find(v => v.id === expandedVisit)
    if (!visit || visit.stats_auto_populated) return
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    if (visit.visit_date >= today) return

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

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  const sidebar = (
    <aside
      className="hidden md:flex flex-col"
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
        backgroundColor: '#161B22', borderRight: '1px solid #30363D', zIndex: 40,
      }}
    >
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ fontWeight: 900, fontSize: 20, color: '#E6EDF3', letterSpacing: '-0.5px' }}>
          ⚾ Chasing 30
        </div>
      </div>
      <nav style={{ flex: 1, padding: '4px 12px' }}>
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = href === '/stadiums'
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, marginBottom: 2,
              color: active ? '#E6EDF3' : '#8B949E',
              backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
              fontWeight: active ? 700 : 500, fontSize: 15, textDecoration: 'none',
            }}>
              <Icon size={20} color={active ? '#1F6FEB' : '#8B949E'} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #30363D' }}>
        <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Progress
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#E6EDF3' }}>
          {allVisitedIds.size}<span style={{ fontWeight: 400, fontSize: 14, color: '#8B949E' }}> / 30</span>
        </div>
      </div>
    </aside>
  )

  const bottomNav = (
    <div className="flex md:hidden" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      backgroundColor: '#161B22', borderTop: '1px solid #30363D',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = href === '/stadiums'
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textDecoration: 'none', padding: '10px 0', minHeight: 56,
            color: active ? '#1F6FEB' : '#8B949E', gap: 3,
          }}>
            <Icon size={22} color={active ? '#1F6FEB' : '#8B949E'} />
            {active && <span style={{ fontSize: 11, fontWeight: 700, color: '#1F6FEB' }}>{label}</span>}
          </Link>
        )
      })}
    </div>
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
        {sidebar}
        <main className="md:ml-[240px]" style={{ paddingBottom: 80 }}>
          <div style={{ height: 260, backgroundColor: '#1C2430' }} />
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#8B949E' }}>Loading...</div>
        </main>
        {bottomNav}
      </div>
    )
  }

  if (!stadium) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
        {sidebar}
        <main className="md:ml-[240px]" style={{ padding: 32, paddingBottom: 80 }}>
          <div style={{ color: '#8B949E' }}>Stadium not found.</div>
        </main>
        {bottomNav}
      </div>
    )
  }

  const visited = visits.length > 0
  const colors = TEAM_GRADIENTS[stadium.abbreviation] ?? ['#0B1117', '#161B22']

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'games-attended',  label: 'Games Attended'  },
    { key: 'upcoming-games',  label: 'Upcoming Games'  },
    { key: 'stadium-info',    label: 'Stadium Info'    },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B1117', color: '#E6EDF3' }}>
      {sidebar}

      <main className="md:ml-[240px]" style={{ minHeight: '100vh', paddingBottom: 80 }}>

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
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.82) 100%)',
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
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 18px', zIndex: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
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
          <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D' }}>
            <div style={{ display: 'flex' }}>
              {[
                { value: stadium.capacity ? stadium.capacity.toLocaleString() : '—', label: 'Capacity' },
                { value: stadium.opened ? String(stadium.opened) : '—', label: 'Year Opened' },
                { value: `${stadium.league} ${stadium.division}`, label: 'Division' },
              ].map(({ value, label }, i, arr) => (
                <div key={label} style={{
                  flex: 1, textAlign: 'center', padding: '16px 8px',
                  borderRight: i < arr.length - 1 ? '1px solid #30363D' : 'none',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#E6EDF3', lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#8B949E', marginTop: 3 }}>{label}</div>
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
                        {visits.length} game{visits.length !== 1 ? 's' : ''} · Last visited {formatDate(visits[0].visit_date)}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Primary action */}
                <button
                  onClick={openAdd}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                    backgroundColor: '#1F6FEB', color: '#ffffff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    marginBottom: 8,
                  }}
                >
                  <Plus size={16} /> Log Game
                </button>
                {/* Secondary actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={shareStadium}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: '1.5px solid #30363D', background: '#1C2430', cursor: 'pointer', color: '#8B949E',
                    }}
                  >
                    Share
                  </button>
                  <button
                    onClick={undoLastVisit}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: '1.5px solid rgba(248,81,73,0.25)', background: 'rgba(248,81,73,0.07)', cursor: 'pointer', color: '#F85149',
                    }}
                  >
                    Undo Last
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={openAdd}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 12, fontSize: 17, fontWeight: 800,
                    backgroundColor: '#1F6FEB', color: '#ffffff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    letterSpacing: '-0.2px',
                  }}
                >
                  ✓ Mark Visited
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
          <div style={{ padding: '24px 16px' }}>

            {/* ── GAMES ATTENDED TAB ───────────────────────────────── */}
            {activeTab === 'games-attended' && (
              <section>
                {visits.length === 0 ? (
                  <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '2px dashed #30363D', padding: '40px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                      <TeamLogo abbreviation={stadium.abbreviation} size={60} />
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
                        padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        backgroundColor: '#1F6FEB', color: '#ffffff', border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Plus size={14} /> Log Game
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 2-column thumbnail grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      {visits.map((visit) => {
                        const isExpanded = expandedVisit === visit.id
                        const hasScore = visit.home_runs != null && visit.away_runs != null
                        return (
                          <button
                            key={visit.id}
                            onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                            style={{
                              border: `2px solid ${isExpanded ? '#3FB950' : 'transparent'}`,
                              borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                              padding: 0, backgroundColor: 'transparent', textAlign: 'left', width: '100%',
                            }}
                          >
                            <div style={{ position: 'relative', paddingBottom: '75%', overflow: 'hidden' }}>
                              {visit.photo_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={visit.photo_url}
                                  alt={`Game ${formatDate(visit.visit_date)}`}
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                              ) : (
                                <div style={{
                                  position: 'absolute', inset: 0,
                                  background: `linear-gradient(160deg, ${colors[0]}, ${colors[1]})`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <TeamLogo abbreviation={stadium.abbreviation} size={44} />
                                </div>
                              )}
                              {/* Bottom overlay */}
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.82), transparent)',
                                padding: '20px 8px 8px',
                              }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                                  {formatDate(visit.visit_date)}
                                </div>
                                {hasScore ? (
                                  <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', marginTop: 1, lineHeight: 1.2 }}>
                                    {visit.visiting_team} {visit.away_runs} · {visit.home_team} {visit.home_runs}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {visit.home_team} vs {visit.visiting_team}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Expanded BoxScore */}
                    {expandedVisit && (() => {
                      const visit = visits.find(v => v.id === expandedVisit)
                      if (!visit) return null
                      return (
                        <BoxScore
                          visit={visit}
                          stadium={stadium}
                          firstTimeMoments={firstTimeMoments}
                          fetchingStats={fetchingStats === visit.id}
                          statsError={statsError[visit.id] ?? null}
                          onEdit={() => openEdit(visit)}
                          onDelete={() => { deleteVisit(visit.id) }}
                        />
                      )
                    })()}
                  </>
                )}
              </section>
            )}

            {/* ── UPCOMING GAMES TAB ───────────────────────────────── */}
            {activeTab === 'upcoming-games' && (
              <>
                {/* Upcoming Home Games */}
                {upcomingGames.length > 0 ? (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle icon="📅">Upcoming Home Games</SectionTitle>
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #30363D' }}>
                      <div style={{ backgroundColor: '#0B1117' }}>
                        {upcomingGames.map((g, i) => {
                          const dt = new Date(g.gameDate)
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
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#E6EDF3' }}>
                                  {g.awayTeam} @ {g.homeTeam}
                                </div>
                              </div>
                              <div style={{ fontSize: 13, color: '#8B949E' }}>{timeStr} PT</div>
                            </div>
                          )
                        })}
                        <a
                          href="https://www.mlb.com/schedule"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'block', padding: '12px 16px', fontSize: 14, fontWeight: 600,
                            color: '#1F6FEB', textDecoration: 'none',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          See Full Schedule →
                        </a>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle icon="📅">Upcoming Home Games</SectionTitle>
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #30363D', padding: '24px 16px', textAlign: 'center', color: '#8B949E', fontSize: 14 }}>
                      No upcoming games found.{' '}
                      <a href="https://www.mlb.com/schedule" target="_blank" rel="noopener noreferrer" style={{ color: '#1F6FEB', fontWeight: 600, textDecoration: 'none' }}>
                        Check MLB.com →
                      </a>
                    </div>
                  </section>
                )}

                {/* Notes */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle icon="💬">Notes</SectionTitle>
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
                            backgroundColor: '#1F6FEB', color: '#0B1117', border: 'none', cursor: 'pointer',
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
                    <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '2px dashed #30363D', padding: '32px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#E6EDF3', marginBottom: 4 }}>Be the first to share</div>
                      <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>Parking, food, best seats...</div>
                      <button
                        onClick={() => { setNoteInput(''); setEditingNote(true) }}
                        style={{ padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: '1.5px solid #30363D', backgroundColor: '#1C2430', cursor: 'pointer', color: '#8B949E' }}
                      >
                        + Add a Note
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ── STADIUM INFO TAB ─────────────────────────────────── */}
            {activeTab === 'stadium-info' && (
              <>
                {/* Retired Numbers */}
                {retiredNumbers.length > 0 && (
                  <section style={{ marginBottom: 32 }}>
                    <SectionTitle icon="🔢">Retired Numbers</SectionTitle>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {retiredNumbers.map(rn => (
                        <div key={rn.id} style={{
                          backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D',
                          padding: '10px 14px', textAlign: 'center', minWidth: 72,
                        }}>
                          <div style={{ fontSize: 24, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{rn.number}</div>
                          <div style={{ fontSize: 11, color: '#8B949E', marginTop: 4, lineHeight: 1.3 }}>{rn.player_name}</div>
                          <div style={{ fontSize: 10, color: '#484F58', marginTop: 2 }}>{rn.year_retired}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* About */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle icon="🏟️">About</SectionTitle>
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
                </section>

                {/* Directions & Links */}
                <section style={{ marginBottom: 32 }}>
                  <SectionTitle icon="🗺️">Directions &amp; Links</SectionTitle>
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
                      href={`https://www.mlb.com/schedule/${stadium.abbreviation.toLowerCase()}`}
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
              </>
            )}

          </div>{/* /tab content */}
        </div>{/* /max-width */}
      </main>

      {bottomNav}

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
            load()
            if (newVisitId) triggerAutofill(newVisitId)
          }}
        />
      )}
    </div>
  )
}
