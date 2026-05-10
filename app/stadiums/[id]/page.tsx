'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import GameDayForm from '@/components/GameDayForm'
import { formatDate } from '@/lib/utils'
import type { Stadium, StadiumVisit, StadiumNote } from '@/types'
import { fetchUpcomingHomeGames, type UpcomingGame } from '@/lib/mlb-api'
import { fetchStadiumPhoto, STADIUM_WIKI_ARTICLES } from '@/lib/stadium-wikipedia'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Pencil, Trash2, Save,
  Home, MapPin, Map, Trophy, Plane,
  ChevronRight, ChevronDown,
} from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'

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

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>{children}</h2>
    </div>
  )
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 15, fontWeight: 600, color: '#111827', textAlign: 'left',
        }}
      >
        {title}
        <ChevronDown size={16} color="#9ca3af" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 16px 16px' }}>
          {children}
        </div>
      )}
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
  const [stadiumPhoto, setStadiumPhoto] = useState<string | null>(null)
  const [allVisitedIds, setAllVisitedIds] = useState<Set<string>>(new Set())
  const [allStadiums, setAllStadiums] = useState<MiniStadium[]>([])

  async function load() {
    const supabase = createClient()
    const [{ data: s }, { data: v }, { data: n }, { data: av }, { data: as_ }] = await Promise.all([
      supabase.from('stadiums').select('*').eq('id', id).single(),
      supabase.from('stadium_visits').select('*').eq('stadium_id', id).order('visit_date', { ascending: false }),
      supabase.from('stadium_notes').select('notes').eq('stadium_id', id).maybeSingle(),
      supabase.from('stadium_visits').select('stadium_id'),
      supabase.from('stadiums').select('id, league, division'),
    ])
    setStadium(s)
    setVisits(v ?? [])
    const note = (n as StadiumNote | null)?.notes ?? ''
    setStadiumNote(note)
    setNoteInput(note)
    setAllVisitedIds(new Set((av ?? []).map((r: { stadium_id: string }) => r.stadium_id)))
    setAllStadiums((as_ ?? []) as MiniStadium[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!stadium) return
    fetchUpcomingHomeGames(stadium.abbreviation).then(setUpcomingGames)
    fetchStadiumPhoto(stadium.abbreviation).then(setStadiumPhoto)
  }, [stadium])

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

  function openAdd() { setEditingVisit(undefined); setShowForm(true) }
  function openEdit(visit: StadiumVisit) { setEditingVisit(visit); setShowForm(true) }

  // ── Sidebar + skeleton shared layout ────────────────────────────────────────
  const sidebar = (
    <aside
      className="hidden md:flex flex-col"
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
        backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', zIndex: 40,
      }}
    >
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ fontWeight: 900, fontSize: 20, color: '#111827', letterSpacing: '-0.5px' }}>
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
              color: active ? '#1a472a' : '#6b7280',
              backgroundColor: active ? 'rgba(26,71,42,0.08)' : 'transparent',
              fontWeight: active ? 700 : 500, fontSize: 15, textDecoration: 'none',
            }}>
              <Icon size={20} color={active ? '#1a472a' : '#9ca3af'} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Progress
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#111827' }}>
          {allVisitedIds.size}<span style={{ fontWeight: 400, fontSize: 14, color: '#9ca3af' }}> / 30</span>
        </div>
      </div>
    </aside>
  )

  const bottomNav = (
    <div className="md:hidden" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb',
      display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = href === '/stadiums'
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textDecoration: 'none', padding: '10px 0', minHeight: 56,
            color: active ? '#1a472a' : '#9ca3af', gap: 3,
          }}>
            <Icon size={22} color={active ? '#1a472a' : '#9ca3af'} />
            {active && <span style={{ fontSize: 11, fontWeight: 700, color: '#1a472a' }}>{label}</span>}
          </Link>
        )
      })}
    </div>
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        {sidebar}
        <main className="md:ml-[240px]" style={{ paddingBottom: 80 }}>
          <div style={{ height: 260, backgroundColor: '#e5e7eb' }} />
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>Loading...</div>
        </main>
        {bottomNav}
      </div>
    )
  }

  if (!stadium) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        {sidebar}
        <main className="md:ml-[240px]" style={{ padding: 32, paddingBottom: 80 }}>
          <div style={{ color: '#9ca3af' }}>Stadium not found.</div>
        </main>
        {bottomNav}
      </div>
    )
  }

  const visited = visits.length > 0
  const colors = TEAM_GRADIENTS[stadium.abbreviation] ?? ['#0d1424', '#1f2937']
  const wikiTitle = STADIUM_WIKI_ARTICLES[stadium.abbreviation]

  // Achievements
  const divStadiums = allStadiums.filter(s => s.league === stadium.league && s.division === stadium.division)
  const divVisited = divStadiums.filter(s => allVisitedIds.has(s.id)).length
  const leagueStadiums = allStadiums.filter(s => s.league === stadium.league)
  const leagueVisited = leagueStadiums.filter(s => allVisitedIds.has(s.id)).length
  const achievements = [
    { icon: '🏆', name: 'Chasing 30', current: allVisitedIds.size, total: 30 },
    { icon: '📍', name: `${stadium.league} ${stadium.division}`, current: divVisited, total: divStadiums.length },
    { icon: '⚾', name: `${stadium.league} League`, current: leagueVisited, total: leagueStadiums.length },
  ]

  // External links
  const ticketsUrl = `https://seatgeek.com/${stadium.team.toLowerCase().replace(/\s+/g, '-')}-tickets`
  const hotelsUrl = `https://www.google.com/maps/search/?api=1&query=hotels+near+${encodeURIComponent(stadium.name + ' ' + stadium.city)}`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stadium.lat},${stadium.lng}`

  const actionGrid = [
    { icon: '🎟', label: 'Get Tickets', sub: 'via SeatGeek', bg: '#FEF2F2', href: ticketsUrl, external: true },
    { icon: '🏨', label: 'Find Hotels', sub: stadium.city, bg: '#F5F3FF', href: hotelsUrl, external: true },
    { icon: '🗺', label: 'Directions', sub: stadium.name, bg: '#F0FDF4', href: directionsUrl, external: true },
    { icon: '🚗', label: 'Road Trip', sub: 'Multi-stadium', bg: '#EFF6FF', href: '/trips/optimizer', external: false },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', color: '#111111' }}>
      {sidebar}

      <main className="md:ml-[240px]" style={{ minHeight: '100vh', paddingBottom: 80 }}>

        {/* ── HERO SECTION ──────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
          {/* Gradient fallback */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
          }} />

          {/* Stadium photo */}
          {stadiumPhoto && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={stadiumPhoto}
              alt={stadium.name}
              onError={() => setStadiumPhoto(null)}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              }}
            />
          )}

          {/* Dark gradient overlay — bottom half */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.82) 100%)',
          }} />

          {/* Top-left: back button + visited badge */}
          <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
            <Link href="/stadiums" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
              color: '#ffffff', padding: '7px 14px 7px 10px', borderRadius: 20,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}>
              <ArrowLeft size={15} /> Back
            </Link>
            {visited && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                backgroundColor: 'rgba(34,197,94,0.82)', backdropFilter: 'blur(6px)',
                color: '#ffffff', padding: '5px 12px', borderRadius: 20,
                fontSize: 13, fontWeight: 700,
              }}>
                ✓ Visited
              </div>
            )}
          </div>

          {/* Bottom text */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 18px', zIndex: 10 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 4,
            }}>
              {stadium.team}
            </div>
            <h1 style={{
              margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#ffffff',
              lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.4)',
            }}>
              {stadium.name}
            </h1>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)' }}>
              {stadium.city}, {stadium.state}
            </div>
          </div>
        </div>

        {/* ── Max-width content wrapper ─────────────────────────── */}
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* ── STATS ROW ──────────────────────────────────────── */}
          <div style={{
            backgroundColor: '#ffffff', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex' }}>
              {[
                { value: stadium.capacity ? stadium.capacity.toLocaleString() : '—', label: 'Capacity' },
                { value: stadium.opened ? String(stadium.opened) : '—', label: 'Year Opened' },
                { value: `${stadium.league} ${stadium.division}`, label: 'Division' },
              ].map(({ value, label }, i, arr) => (
                <div key={label} style={{
                  flex: 1, textAlign: 'center', padding: '16px 8px',
                  borderRight: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#111827', lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>

            {/* ── ACTION BUTTONS ─────────────────────────────────── */}
            <div style={{ marginBottom: 32 }}>
              {visited ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: '#16a34a', fontWeight: 700, fontSize: 16,
                  }}>
                    ✓ You&apos;ve been here! ({visits.length} game{visits.length !== 1 ? 's' : ''})
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                      onClick={shareStadium}
                      style={{
                        padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                        border: '1.5px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', color: '#374151',
                      }}
                    >
                      Share
                    </button>
                    <button
                      onClick={openAdd}
                      style={{
                        padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                        border: '1.5px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', color: '#374151',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Plus size={14} /> Add Memory
                    </button>
                    <button
                      onClick={undoLastVisit}
                      style={{
                        padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600,
                        border: '1.5px solid #fca5a5', background: '#ffffff', cursor: 'pointer', color: '#ef4444',
                      }}
                    >
                      Undo
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={openAdd}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 700,
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#ffffff', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                    }}
                  >
                    ✓ Mark Visited
                  </button>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button style={{
                      flex: 1, padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      border: '1.5px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', color: '#374151',
                    }}>
                      🚩 Bucket List
                    </button>
                    <button style={{
                      flex: 1, padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      border: '1.5px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', color: '#374151',
                    }}>
                      ⊙ Challenge
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── ACHIEVEMENT PROGRESS ─────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionTitle icon="🏆">Achievement Progress</SectionTitle>
              <div style={{
                backgroundColor: '#ffffff', borderRadius: 14, border: '1px solid #f3f4f6',
                overflow: 'hidden',
              }}>
                {achievements.map(({ icon, name, current, total }, i) => (
                  <div key={name} style={{
                    padding: '14px 16px',
                    borderBottom: i < achievements.length - 1 ? '1px solid #f9fafb' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{name}</span>
                          <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0 }}>{current} of {total}</span>
                        </div>
                        <div style={{ height: 7, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4, transition: 'width 0.6s',
                            backgroundColor: current >= total ? '#16a34a' : '#22c55e',
                            width: `${Math.min((current / total) * 100, 100)}%`,
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── MEMORIES SECTION ─────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionTitle icon="📷">Memories</SectionTitle>
              {visits.length === 0 ? (
                <div style={{
                  backgroundColor: '#ffffff', borderRadius: 14, border: '2px dashed #e5e7eb',
                  padding: '40px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>⚾</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 6 }}>
                    Your first memory at {stadium.name}
                  </div>
                  <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 20 }}>
                    Photos, notes, game scores — all in one place
                  </div>
                  <button
                    onClick={openAdd}
                    style={{
                      padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                      backgroundColor: '#111827', color: '#ffffff', border: 'none', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Plus size={14} /> Add Memory
                  </button>
                </div>
              ) : (
                <>
                  {/* 2-column photo grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {visits.map((visit) => {
                      const isExpanded = expandedVisit === visit.id
                      return (
                        <button
                          key={visit.id}
                          onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                          style={{
                            border: `2px solid ${isExpanded ? '#22c55e' : 'transparent'}`,
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
                                style={{
                                  position: 'absolute', inset: 0,
                                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                                }}
                              />
                            ) : (
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: `linear-gradient(160deg, ${colors[0]}, ${colors[1]})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <TeamLogo abbreviation={stadium.abbreviation} size={44} />
                                {visit.home_runs != null && visit.away_runs != null && (
                                  <div style={{
                                    position: 'absolute', bottom: 28, left: 0, right: 0,
                                    textAlign: 'center', fontSize: 20, fontWeight: 900,
                                    color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                  }}>
                                    {visit.away_runs}–{visit.home_runs}
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
                              padding: '20px 10px 8px',
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>
                                {formatDate(visit.visit_date)}
                              </div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {visit.home_team} vs {visit.visiting_team}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Expanded game detail */}
                  {expandedVisit && (() => {
                    const visit = visits.find(v => v.id === expandedVisit)
                    if (!visit) return null
                    const winner = visit.home_runs != null && visit.away_runs != null
                      ? visit.home_runs > visit.away_runs ? visit.home_team : visit.visiting_team
                      : null
                    return (
                      <div style={{
                        backgroundColor: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb',
                        overflow: 'hidden', marginBottom: 12,
                      }}>
                        {/* Header row */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 16px', borderBottom: '1px solid #f3f4f6',
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                              {visit.home_team} vs {visit.visiting_team}
                            </div>
                            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                              {formatDate(visit.visit_date)}
                              {visit.first_pitch_time && ` · First pitch: ${visit.first_pitch_time}`}
                              {visit.attendance && ` · ${visit.attendance.toLocaleString()} fans`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {visit.home_runs != null && visit.away_runs != null && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
                                  {visit.away_runs}–{visit.home_runs}
                                </div>
                                {winner && <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>{winner} W</div>}
                              </div>
                            )}
                            <button
                              onClick={() => openEdit(visit)}
                              style={{ padding: '6px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer' }}
                              title="Edit"
                            >
                              <Pencil size={14} color="#6b7280" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteVisit(visit.id) }}
                              style={{ padding: '6px', borderRadius: 8, border: '1px solid #fca5a5', background: '#ffffff', cursor: 'pointer' }}
                              title="Delete"
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
                        </div>

                        <div style={{ padding: '16px' }}>
                          {/* Quick facts */}
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                            {visit.weather && (
                              <div>
                                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weather</div>
                                <div style={{ fontSize: 14, color: '#374151', marginTop: 2 }}>{visit.weather}{visit.temperature ? ` · ${visit.temperature}°F` : ''}</div>
                              </div>
                            )}
                            {visit.game_duration && (
                              <div>
                                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                                <div style={{ fontSize: 14, color: '#374151', marginTop: 2 }}>{visit.game_duration}</div>
                              </div>
                            )}
                            {(visit.seat_section || visit.seat_row || visit.seat_number) && (
                              <div>
                                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seats</div>
                                <div style={{ fontSize: 14, color: '#374151', marginTop: 2 }}>
                                  {[
                                    visit.seat_section || visit.seat_row || visit.seat_number
                                      ? `Sec ${visit.seat_section}, Row ${visit.seat_row}, Seat ${visit.seat_number}`
                                      : null,
                                    ...(visit.additional_seats ?? []).map(s => `Sec ${s.section}, Row ${s.row}, Seat ${s.number}`),
                                  ].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            )}
                            {visit.home_team_record && (
                              <div>
                                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Records</div>
                                <div style={{ fontSize: 14, color: '#374151', marginTop: 2 }}>
                                  {visit.home_team} ({visit.home_team_record}) · {visit.visiting_team} ({visit.visiting_team_record})
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Starting pitchers */}
                          {(visit.home_starter_name || visit.away_starter_name) && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Starting Pitchers</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                  { side: 'Home', name: visit.home_starter_name, wl: visit.home_starter_wl, ip: visit.home_starter_ip, h: visit.home_starter_h, er: visit.home_starter_er, bb: visit.home_starter_bb, k: visit.home_starter_k },
                                  { side: 'Away', name: visit.away_starter_name, wl: visit.away_starter_wl, ip: visit.away_starter_ip, h: visit.away_starter_h, er: visit.away_starter_er, bb: visit.away_starter_bb, k: visit.away_starter_k },
                                ].map(({ side, name, wl, ip, h, er, bb, k }) => name ? (
                                  <div key={side} style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: '10px 12px' }}>
                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{side}</div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{name}</div>
                                    {wl && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{wl}</div>}
                                    <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12, color: '#9ca3af' }}>
                                      {ip && <span>IP: {ip}</span>}
                                      {h != null && <span>H: {h}</span>}
                                      {er != null && <span>ER: {er}</span>}
                                      {bb != null && <span>BB: {bb}</span>}
                                      {k != null && <span>K: {k}</span>}
                                    </div>
                                  </div>
                                ) : null)}
                              </div>
                            </div>
                          )}

                          {/* Box score */}
                          {(visit.home_runs != null || visit.away_runs != null) && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Final Box Score</div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#9ca3af', fontSize: 12 }}>
                                      <th style={{ textAlign: 'left', paddingBottom: 6, paddingRight: 12 }}>Team</th>
                                      {['R', 'H', 'E', 'LOB'].map(h => (
                                        <th key={h} style={{ textAlign: 'center', paddingBottom: 6, paddingLeft: 12, paddingRight: 12 }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[
                                      { team: visit.visiting_team, r: visit.away_runs, h: visit.away_hits, e: visit.away_errors, lob: visit.away_lob },
                                      { team: visit.home_team, r: visit.home_runs, h: visit.home_hits, e: visit.home_errors, lob: visit.home_lob },
                                    ].map(({ team, r, h, e, lob }) => (
                                      <tr key={team}>
                                        <td style={{ paddingRight: 12, paddingBottom: 4, color: '#374151' }}>{team}</td>
                                        <td style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingBottom: 4, fontWeight: 700, color: '#111827' }}>{r ?? '—'}</td>
                                        <td style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingBottom: 4, color: '#6b7280' }}>{h ?? '—'}</td>
                                        <td style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingBottom: 4, color: '#6b7280' }}>{e ?? '—'}</td>
                                        <td style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingBottom: 4, color: '#6b7280' }}>{lob ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Inning by inning */}
                          {visit.inning_scores?.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Inning by Inning</div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'left', paddingRight: 12, paddingBottom: 4, color: '#9ca3af', fontWeight: 600 }}>Team</th>
                                      {visit.inning_scores.map(inn => (
                                        <th key={inn.inning} style={{ textAlign: 'center', padding: '0 8px 4px', color: '#9ca3af', fontWeight: 600 }}>{inn.inning}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(['away', 'home'] as const).map(side => (
                                      <tr key={side}>
                                        <td style={{ paddingRight: 12, paddingBottom: 2, color: '#6b7280' }}>
                                          {side === 'away' ? visit.visiting_team : visit.home_team}
                                        </td>
                                        {visit.inning_scores.map(inn => (
                                          <td key={inn.inning} style={{ textAlign: 'center', padding: '0 8px 2px', color: '#111827', fontWeight: 600 }}>
                                            {inn[side] ?? '—'}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Pitchers of record */}
                          {(visit.winning_pitcher || visit.losing_pitcher || visit.save_pitcher) && (
                            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                              {visit.winning_pitcher && (
                                <div>
                                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WP</div>
                                  <div style={{ fontSize: 14, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>{visit.winning_pitcher}</div>
                                </div>
                              )}
                              {visit.losing_pitcher && (
                                <div>
                                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LP</div>
                                  <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>{visit.losing_pitcher}</div>
                                </div>
                              )}
                              {visit.save_pitcher && (
                                <div>
                                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SV</div>
                                  <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>{visit.save_pitcher}</div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Umpires */}
                          {(visit.hp_umpire || visit.first_base_umpire) && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Umpires</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#6b7280' }}>
                                {visit.hp_umpire && <span>HP: {visit.hp_umpire}</span>}
                                {visit.first_base_umpire && <span>1B: {visit.first_base_umpire}</span>}
                                {visit.second_base_umpire && <span>2B: {visit.second_base_umpire}</span>}
                                {visit.third_base_umpire && <span>3B: {visit.third_base_umpire}</span>}
                              </div>
                            </div>
                          )}

                          {/* Photo */}
                          {visit.photo_url && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Photo</div>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={visit.photo_url} alt="Game photo" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                            </div>
                          )}

                          {/* Notes */}
                          {visit.notes && (
                            <div>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Notes</div>
                              <div style={{ fontSize: 14, color: '#374151', backgroundColor: '#f9fafb', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap' }}>
                                {visit.notes}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </section>

            {/* ── PLAN YOUR VISIT ───────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionTitle icon="🧭">Plan Your Visit</SectionTitle>

              {/* Upcoming home games */}
              {upcomingGames.length > 0 && (
                <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #1f2937' }}>
                  <div style={{ backgroundColor: '#111827', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#f9fafb', display: 'flex', alignItems: 'center', gap: 8 }}>
                    📅 Upcoming Home Games
                  </div>
                  <div style={{ backgroundColor: '#1f2937' }}>
                    {upcomingGames.map((g, i) => {
                      const dt = new Date(g.gameDate)
                      const dayAbbr = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })
                      const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
                      const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
                      return (
                        <div key={g.gamePk} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderBottom: i < upcomingGames.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ textAlign: 'center', minWidth: 36 }}>
                              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{dayAbbr}</div>
                              <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 700 }}>{dateStr}</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#f9fafb' }}>
                              {g.awayTeam} @ {g.homeTeam}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: '#9ca3af' }}>{timeStr} ET</div>
                        </div>
                      )
                    })}
                    <a
                      href="https://www.mlb.com/schedule"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block', padding: '12px 16px', fontSize: 14, fontWeight: 600,
                        color: '#60a5fa', textDecoration: 'none',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      See Full Schedule →
                    </a>
                  </div>
                </div>
              )}

              {/* 2×2 action grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {actionGrid.map(({ icon, label, sub, bg, href, external }) => {
                  const content = (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '14px',
                      borderRadius: 12, backgroundColor: '#ffffff', border: '1px solid #f3f4f6',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, backgroundColor: bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, flexShrink: 0,
                      }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{label}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
                      </div>
                      <ChevronRight size={16} color="#d1d5db" style={{ flexShrink: 0 }} />
                    </div>
                  )
                  return external ? (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      {content}
                    </a>
                  ) : (
                    <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                      {content}
                    </Link>
                  )
                })}
              </div>
            </section>

            {/* ── FAN TIPS ──────────────────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <SectionTitle icon="💬">Fan Tips</SectionTitle>
              {editingNote ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
                  <textarea
                    rows={4}
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder={`Parking tips, best food spots, recommended seats at ${stadium.name}...`}
                    autoFocus
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                      fontSize: 14, color: '#111827', backgroundColor: '#f9fafb',
                      resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={saveNote}
                      disabled={savingNote}
                      style={{
                        padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                        backgroundColor: '#111827', color: '#ffffff', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Save size={14} /> {savingNote ? 'Saving…' : 'Save Tip'}
                    </button>
                    <button
                      onClick={() => setEditingNote(false)}
                      style={{ padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1.5px solid #e5e7eb', backgroundColor: '#ffffff', cursor: 'pointer', color: '#374151' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : stadiumNote ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#374151',
                      backgroundColor: '#f3f4f6', padding: '3px 10px', borderRadius: 20,
                    }}>
                      General
                    </span>
                    <button
                      onClick={() => { setNoteInput(stadiumNote); setEditingNote(true) }}
                      style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Pencil size={12} /> Edit
                    </button>
                  </div>
                  <div style={{ fontSize: 14, color: '#374151', fontStyle: 'italic', lineHeight: 1.6 }}>
                    &ldquo;{stadiumNote}&rdquo;
                  </div>
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#ffffff', borderRadius: 14, border: '2px dashed #e5e7eb',
                  padding: '32px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>
                    Be the first to share
                  </div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
                    Parking, food, best seats...
                  </div>
                  <button
                    onClick={() => { setNoteInput(''); setEditingNote(true) }}
                    style={{
                      padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                      border: '1.5px solid #e5e7eb', backgroundColor: '#ffffff', cursor: 'pointer', color: '#374151',
                    }}
                  >
                    + Add a Tip
                  </button>
                </div>
              )}
            </section>

            {/* ── ABOUT (COLLAPSIBLE) ───────────────────────────── */}
            <section style={{ marginBottom: 32 }}>
              <Collapsible title="About ›">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12 }}>
                  {[
                    { label: 'Location', value: `${stadium.city}, ${stadium.state}` },
                    { label: 'League', value: `${stadium.league} ${stadium.division}` },
                    stadium.capacity ? { label: 'Capacity', value: stadium.capacity.toLocaleString() } : null,
                    stadium.opened ? { label: 'Opened', value: String(stadium.opened) } : null,
                    stadium.surface ? { label: 'Surface', value: stadium.surface } : null,
                  ].filter(Boolean).map(item => (
                    <div key={item!.label}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{item!.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{item!.value}</div>
                    </div>
                  ))}
                </div>
              </Collapsible>

              <Collapsible title="Retired Numbers ›">
                <div style={{ paddingTop: 12, fontSize: 14, color: '#9ca3af' }}>
                  Retired number data coming soon.
                </div>
              </Collapsible>

              <Collapsible title="Stadium Guide ›">
                <div style={{ paddingTop: 12 }}>
                  {wikiTitle && (
                    <a
                      href={`https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px', borderRadius: 8, backgroundColor: '#f9fafb',
                        textDecoration: 'none', color: '#111827', marginBottom: 12,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Wikipedia article</span>
                      <ChevronRight size={16} color="#9ca3af" />
                    </a>
                  )}
                  <div style={{ fontSize: 14, color: '#9ca3af' }}>
                    More guide content coming soon.
                  </div>
                </div>
              </Collapsible>
            </section>

          </div>{/* /padding wrapper */}
        </div>{/* /max-width */}
      </main>

      {/* ── Mobile bottom tab bar ────────────────────────────────── */}
      {bottomNav}

      {/* ── GameDayForm modal ────────────────────────────────────── */}
      {showForm && stadium && (
        <GameDayForm
          stadium={stadium}
          visit={editingVisit}
          onClose={() => { setShowForm(false); setEditingVisit(undefined) }}
          onSaved={() => { setShowForm(false); setEditingVisit(undefined); load() }}
        />
      )}
    </div>
  )
}
