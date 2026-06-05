'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import PassportGrid, { type StampData } from '@/components/PassportGrid'
import Link from 'next/link'
import { Search, X, ChevronRight, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react'
import type { Stadium, SpecialEvent, SpecialEventType } from '@/types'
import TeamLogo from '@/components/TeamLogo'
import SpecialEventForm from '@/components/SpecialEventForm'
import { fetchStadiumPhoto } from '@/lib/stadium-wikipedia'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'mlb' | 'historical' | 'spring' | 'events' | 'passport'
type SortKey = 'team' | 'name' | 'state' | 'division'
interface VisitRow { stadium_id: string; visit_date: string }
interface NextGameInfo { date: string; opponentAbbr: string }

// ─── Team colors ──────────────────────────────────────────────────────────────

const TEAM_ACCENT: Record<string, string> = {
  NYY: '#003087', BOS: '#BD3039', LAD: '#005A9C', CHC: '#0E3386',
  CWS: '#27251F', STL: '#C41E3A', ATL: '#CE1141', NYM: '#002D72',
  PHI: '#E81828', WSH: '#AB0003', MIA: '#00A3E0', PIT: '#FDB827',
  CIN: '#C6011F', MIL: '#FFC52F', HOU: '#EB6E1F', TEX: '#003278',
  LAA: '#BA0021', OAK: '#003831', SEA: '#0C2C56', SD:  '#2F241D',
  COL: '#33006F', ARI: '#A71930', SF:  '#FD5A1E', MIN: '#002B5C',
  CLE: '#E31937', DET: '#0C2340', KC:  '#004687', BAL: '#DF4601',
  TB:  '#092C5C', TOR: '#134A8E',
}

// ─── Team nicknames ───────────────────────────────────────────────────────────

const TEAM_NICKNAME: Record<string, string> = {
  ARI: 'D-backs',   ATL: 'Braves',    BAL: 'Orioles',   BOS: 'Red Sox',
  CHC: 'Cubs',      CWS: 'White Sox', CIN: 'Reds',       CLE: 'Guardians',
  COL: 'Rockies',   DET: 'Tigers',    HOU: 'Astros',     KC:  'Royals',
  LAA: 'Angels',    LAD: 'Dodgers',   MIA: 'Marlins',    MIL: 'Brewers',
  MIN: 'Twins',     NYM: 'Mets',      NYY: 'Yankees',    OAK: 'Athletics',
  PHI: 'Phillies',  PIT: 'Pirates',   SD:  'Padres',     SF:  'Giants',
  SEA: 'Mariners',  STL: 'Cardinals', TB:  'Rays',       TEX: 'Rangers',
  TOR: 'Blue Jays', WSH: 'Nationals',
}

// ─── Event helpers ────────────────────────────────────────────────────────────

const EVENT_TYPE_META: Record<string, { label: string; icon: string }> = {
  world_series:     { label: 'World Series',    icon: '🏆' },
  all_star_game:    { label: 'All-Star Game',   icon: '⭐' },
  postseason:       { label: 'Postseason',      icon: '🍂' },
  spring_training:  { label: 'Spring Training', icon: '🌸' },
  minor_league:     { label: 'Minor League',    icon: '🌱' },
  historic_ballpark:{ label: 'Historic Ballpark', icon: '🏛️' },
  international:    { label: 'International',   icon: '🌍' },
  other:            { label: 'Other',           icon: '📝' },
}

const EVENTS_TAB_TYPES: { value: SpecialEventType; label: string; icon: string }[] = [
  { value: 'world_series',  label: 'World Series', icon: '🏆' },
  { value: 'all_star_game', label: 'All-Star',     icon: '⭐' },
  { value: 'postseason',    label: 'Postseason',   icon: '🍂' },
  { value: 'minor_league',  label: 'Minor League', icon: '🌱' },
  { value: 'international', label: 'International',icon: '🌍' },
  { value: 'other',         label: 'Other',        icon: '📝' },
]

function eventTitle(e: SpecialEvent): string {
  if (e.event_type === 'historic_ballpark') return e.venue_name ?? 'Historic Ballpark'
  if (e.event_type === 'spring_training') return e.home_team ? `${e.home_team} Spring Training` : 'Spring Training'
  if (e.event_type === 'world_series') return (e.home_team && e.visiting_team) ? `${e.home_team} vs ${e.visiting_team}` : 'World Series'
  if (e.event_type === 'all_star_game') return 'MLB All-Star Game'
  if (e.event_type === 'postseason') return (e.home_team && e.visiting_team) ? `${e.home_team} vs ${e.visiting_team}` : `Postseason${e.series_round ? ` · ${e.series_round}` : ''}`
  if (e.event_type === 'minor_league') return e.home_team ? `${e.home_team}${e.ml_level ? ` (${e.ml_level})` : ''}` : 'Minor League'
  if (e.event_type === 'international') return e.series_name ?? 'International Game'
  if (e.event_type === 'other') return e.custom_title ?? 'Other Experience'
  return 'Special Event'
}

function eventSubtitle(e: SpecialEvent): string {
  const parts: string[] = []
  if (e.stadium_name) parts.push(e.stadium_name)
  const loc = [e.city, e.state ?? e.country].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  return parts.join(' · ')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return d }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ─── Stadium card ─────────────────────────────────────────────────────────────

function StadiumCard({
  stadium, visited, visitDate, visitCount, nextGame, photo,
}: {
  stadium: Stadium
  visited: boolean
  visitDate?: string
  visitCount?: number
  nextGame?: NextGameInfo
  photo?: string
}) {
  const accent = TEAM_ACCENT[stadium.abbreviation] ?? '#1F6FEB'

  return (
    <Link href={`/stadiums/${stadium.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        className="stadium-card"
        style={{
          backgroundColor: '#161B22',
          border: visited ? '1px solid rgba(63,185,80,0.4)' : '1px solid #30363D',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          cursor: 'pointer',
          opacity: visited ? 1 : 0.78,
          boxShadow: visited ? '0 0 14px rgba(63,185,80,0.10)' : 'none',
          transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s, opacity 0.15s',
        }}
      >
        {/* Hero — photo if available, else gradient */}
        <div style={{
          height: 136, position: 'relative', flexShrink: 0, overflow: 'hidden',
          background: `linear-gradient(to bottom, ${hexToRgba(accent, 0.55)} 0%, ${hexToRgba(accent, 0.2)} 100%)`,
        }}>
          {photo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo} alt={stadium.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)' }} />
          {visited && (
            <div style={{
              position: 'absolute', top: 8, right: 8, zIndex: 2,
              width: 18, height: 18, borderRadius: '50%',
              backgroundColor: '#3FB950', border: '2px solid rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#0B1117', fontWeight: 900,
            }}>✓</div>
          )}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <TeamLogo abbreviation={stadium.abbreviation} size={80} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {stadium.team}
          </div>
          <div style={{
            fontSize: 11, color: '#8B949E', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {stadium.name}
          </div>
          <div style={{ fontSize: 11, color: '#8B949E' }}>
            {stadium.city}
          </div>

          <div style={{ flex: 1, minHeight: 8 }} />

          {/* Footer: badge + info + chevron */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              {visited ? (
                <>
                  <span style={{
                    flexShrink: 0,
                    fontSize: 10, fontWeight: 700, color: '#3FB950',
                    backgroundColor: 'rgba(63,185,80,0.12)',
                    border: '1px solid rgba(63,185,80,0.25)',
                    padding: '2px 7px', borderRadius: 999,
                  }}>Visited ✓</span>
                  {visitCount && visitCount > 1 && (
                    <span style={{
                      flexShrink: 0,
                      fontSize: 10, fontWeight: 700, color: '#F5A623',
                      backgroundColor: 'rgba(245,166,35,0.12)',
                      border: '1px solid rgba(245,166,35,0.25)',
                      padding: '2px 7px', borderRadius: 999,
                    }}>{visitCount}×</span>
                  )}
                  {visitDate && (
                    <span style={{
                      fontSize: 11, color: '#8B949E',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                    }}>
                      {fmtDate(visitDate)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span style={{
                    flexShrink: 0,
                    fontSize: 10, fontWeight: 600, color: '#8B949E',
                    backgroundColor: 'rgba(139,148,158,0.1)',
                    border: '1px solid rgba(139,148,158,0.25)',
                    padding: '2px 8px', borderRadius: 999,
                  }}>On the List</span>
                  {nextGame && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 11, fontWeight: 600, color: '#E6EDF3',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                    }}>
                      <CalendarDays size={11} color="#C9D1D9" style={{ flexShrink: 0 }}/>
                      {nextGame.date} vs {TEAM_NICKNAME[nextGame.opponentAbbr] ?? nextGame.opponentAbbr}
                    </span>
                  )}
                </>
              )}
            </div>
            <ChevronRight size={13} color="#484F58" style={{ flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, marginTop: 4,
    }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#E6EDF3' }}>{children}</h2>
      <span style={{
        fontSize: 13, fontWeight: 600, color: '#8B949E',
        backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid #30363D',
        padding: '2px 10px', borderRadius: 999,
      }}>{count}</span>
    </div>
  )
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event, onEdit, onDelete }: { event: SpecialEvent; onEdit: () => void; onDelete: () => void }) {
  const meta = EVENT_TYPE_META[event.event_type]
  const title = eventTitle(event)
  const subtitle = eventSubtitle(event)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 10,
      backgroundColor: '#161B22', border: '1px solid #30363D',
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{meta?.icon ?? '📝'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>
          {fmtDate(event.event_date)}{subtitle ? ` · ${subtitle}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={onEdit}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', padding: '4px 6px', borderRadius: 6 }}
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F85149', padding: '4px 6px', borderRadius: 6 }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Passport tab ─────────────────────────────────────────────────────────────

function PassportTabContent({ stamps, earnedCount }: { stamps: StampData[]; earnedCount: number }) {
  const [userInfo, setUserInfo] = useState<{ userName: string; passportNo: string } | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const meta = (user as any)?.user_metadata
      const fullName: string = meta?.full_name ?? meta?.name ?? ''
      const emailLocal = user?.email?.split('@')[0] ?? ''
      const raw = fullName || emailLocal
      const userName = raw.charAt(0).toUpperCase() + raw.slice(1)
      const uid = user?.id ?? '00000000-0000-0000-0000-000000000000'
      const passportNo = 'USR-' + uid.replace(/-/g, '').slice(0, 8).toUpperCase()
      setUserInfo({ userName, passportNo })
    })
  }, [])

  if (!userInfo) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 16px', color: '#8B949E', fontSize: 15 }}>
        Loading passport…
      </div>
    )
  }

  return (
    <PassportGrid
      stamps={stamps}
      userName={userInfo.userName}
      passportNo={userInfo.passportNo}
      earnedCount={earnedCount}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StadiumsPage() {
  const [stadiums, setStadiums]     = useState<Stadium[]>([])
  const [visits, setVisits]         = useState<VisitRow[]>([])
  const [events, setEvents]         = useState<SpecialEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sortKey, setSortKey]       = useState<SortKey>('team')
  const [filterLeague, setFilterLeague] = useState<'all' | 'AL' | 'NL'>('all')
  const [activeCategory, setActiveCategory] = useState<Category>('mlb')
  const [nextGames, setNextGames]   = useState<Record<string, NextGameInfo>>({})
  const [photos, setPhotos]         = useState<Record<string, string>>({})

  const [showForm, setShowForm]           = useState(false)
  const [editingEvent, setEditingEvent]   = useState<SpecialEvent | undefined>()
  const [formDefaultType, setFormDefaultType] = useState<SpecialEventType>('world_series')
  const [formAllowedTypes, setFormAllowedTypes] = useState<SpecialEventType[] | undefined>()
  const [eventsTypeFilter, setEventsTypeFilter] = useState<SpecialEventType | 'all'>('all')

  const loadEvents = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('special_events').select('*').order('event_date', { ascending: false })
    setEvents((data as SpecialEvent[]) ?? [])
  }, [])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('stadiums').select('*').order('team'),
      supabase.from('stadium_visits').select('stadium_id, visit_date').order('visit_date', { ascending: false }),
      fetch('/api/next-games').then(r => r.ok ? r.json() : {}),
      supabase.from('special_events').select('*').order('event_date', { ascending: false }),
    ]).then(([{ data: s }, { data: v }, games, { data: ev }]) => {
      setStadiums(s ?? [])
      setVisits((v as VisitRow[]) ?? [])
      setNextGames(games ?? {})
      setEvents((ev as SpecialEvent[]) ?? [])
      setLoading(false)
      // Fetch stadium photos in background
      const stadiumList = s ?? []
      stadiumList.forEach(stadium => {
        fetchStadiumPhoto(stadium.abbreviation).then(url => {
          if (url) setPhotos(prev => ({ ...prev, [stadium.abbreviation]: url }))
        })
      })
    })
  }, [])

  function openAddForm(defaultType: SpecialEventType, allowedTypes?: SpecialEventType[]) {
    setEditingEvent(undefined)
    setFormDefaultType(defaultType)
    setFormAllowedTypes(allowedTypes)
    setShowForm(true)
  }

  function openEditForm(event: SpecialEvent) {
    setEditingEvent(event)
    setFormDefaultType(event.event_type)
    setFormAllowedTypes(undefined)
    setShowForm(true)
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    const supabase = createClient()
    await supabase.from('special_events').delete().eq('id', id)
    await loadEvents()
  }

  const visitedIds = useMemo(() => new Set(visits.map(v => v.stadium_id)), [visits])

  const latestVisit = useMemo(() => {
    const map: Record<string, string> = {}
    visits.forEach(v => { if (!map[v.stadium_id]) map[v.stadium_id] = v.visit_date })
    return map
  }, [visits])

  const visitCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    visits.forEach(v => { map[v.stadium_id] = (map[v.stadium_id] ?? 0) + 1 })
    return map
  }, [visits])

  const passportStamps = useMemo<StampData[]>(() =>
    stadiums.map(s => ({
      stadiumId: s.id,
      abbr: s.abbreviation,
      visitDate: visits
        .filter(v => v.stadium_id === s.id)
        .sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0]?.visit_date ?? null,
    })),
    [stadiums, visits]
  )

  const visitedCount = visitedIds.size
  const pct = Math.round((visitedCount / 30) * 100)

  const filtered = useMemo(() => {
    if (activeCategory !== 'mlb') return []
    const list = stadiums.filter(s => {
      const q = search.toLowerCase()
      if (q && !s.name.toLowerCase().includes(q) && !s.team.toLowerCase().includes(q) && !s.city.toLowerCase().includes(q)) return false
      if (filterLeague !== 'all' && s.league !== filterLeague) return false
      return true
    })
    list.sort((a, b) => (a[sortKey] as string).localeCompare(b[sortKey] as string))
    return list
  }, [stadiums, search, sortKey, filterLeague, activeCategory])

  const visitedList   = useMemo(() => filtered.filter(s =>  visitedIds.has(s.id)), [filtered, visitedIds])
  const unvisitedList = useMemo(() => filtered.filter(s => !visitedIds.has(s.id)), [filtered, visitedIds])

  const historicEvents = useMemo(() =>
    events.filter(e => e.event_type === 'historic_ballpark')
      .sort((a, b) => b.event_date.localeCompare(a.event_date)),
    [events])

  const springEvents = useMemo(() =>
    events.filter(e => e.event_type === 'spring_training')
      .sort((a, b) => b.event_date.localeCompare(a.event_date)),
    [events])

  const EVENTS_SPECIAL_SET: SpecialEventType[] = ['world_series', 'all_star_game', 'postseason', 'minor_league', 'international', 'other']

  const otherEvents = useMemo(() =>
    events.filter(e => EVENTS_SPECIAL_SET.includes(e.event_type))
      .sort((a, b) => b.event_date.localeCompare(a.event_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events])

  const filteredOtherEvents = useMemo(() => {
    if (eventsTypeFilter === 'all') return otherEvents
    return otherEvents.filter(e => e.event_type === eventsTypeFilter)
  }, [otherEvents, eventsTypeFilter])

  const CATEGORIES: { key: Category; label: string }[] = [
    { key: 'mlb',        label: 'MLB'             },
    { key: 'historical', label: 'Historical'      },
    { key: 'spring',     label: 'Spring Training' },
    { key: 'events',     label: 'Events'          },
    { key: 'passport',   label: 'Passport'        },
  ]

  return (
    <div style={{ color: '#E6EDF3', overflowX: 'hidden' }}>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main style={{ minHeight: '100vh' }}>

        {/* ── Hero progress banner ─────────────────────────────── */}
        <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  The Ballparks
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#E6EDF3', lineHeight: 1.1, marginBottom: 4 }}>
                  {visitedCount} of 30 visited
                </div>
                <div style={{ fontSize: 14, color: '#8B949E' }}>
                  Chasing all 30 MLB ballparks
                </div>
              </div>
              {activeCategory === 'mlb' && (
                <button
                  onClick={() => { setShowSearch(v => !v); if (showSearch) setSearch('') }}
                  aria-label="Toggle search"
                  style={{
                    background: 'rgba(139,148,158,0.1)', border: '1px solid #30363D',
                    borderRadius: '50%', width: 36, height: 36, flexShrink: 0,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {showSearch ? <X size={16} color="#8B949E" /> : <Search size={16} color="#8B949E" />}
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ height: 8, backgroundColor: '#30363D', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: '#3FB950', transition: 'width 0.5s' }} />
            </div>

            {/* Quick stats */}
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#3FB950' }}>{visitedCount}</span>
                <span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>visited</span>
              </div>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3' }}>{30 - visitedCount}</span>
                <span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>remaining</span>
              </div>
              <div>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#F5A623' }}>{pct}%</span>
                <span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Category tabs ────────────────────────────────────── */}
        <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {CATEGORIES.map(({ key, label }) => {
                const active = activeCategory === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    style={{
                      padding: '12px 18px', fontSize: 14, fontWeight: active ? 700 : 500,
                      cursor: 'pointer', background: 'none', border: 'none',
                      color: active ? '#E6EDF3' : '#8B949E',
                      borderBottom: active ? '2px solid #1F6FEB' : '2px solid transparent',
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Filters (sticky, MLB only) ────────────────────────── */}
        {activeCategory === 'mlb' && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            backgroundColor: '#0B1117', borderBottom: '1px solid #30363D',
          }}>
            <div style={{ maxWidth: 960, margin: '0 auto', padding: '10px 16px' }}>

              {showSearch && (
                <input
                  type="text"
                  placeholder="Search team, stadium, city..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, marginBottom: 10,
                    border: '1.5px solid #30363D', fontSize: 14,
                    backgroundColor: '#1C2430', color: '#E6EDF3',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => scrollToSection('visited-section')}
                  style={{
                    padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    backgroundColor: 'rgba(63,185,80,0.1)',
                    color: '#3FB950',
                    border: '1.5px solid rgba(63,185,80,0.3)',
                  }}
                >
                  Visited <span style={{ fontWeight: 400, fontSize: 13 }}>({visitedCount})</span>
                </button>
                <button
                  onClick={() => scrollToSection('not-yet-section')}
                  style={{
                    padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    backgroundColor: 'transparent',
                    color: '#8B949E',
                    border: '1.5px solid #30363D',
                  }}
                >
                  On the List <span style={{ fontWeight: 400, fontSize: 13 }}>({30 - visitedCount})</span>
                </button>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <select
                    value={filterLeague}
                    onChange={e => setFilterLeague(e.target.value as 'all' | 'AL' | 'NL')}
                    style={{
                      padding: '8px 10px', borderRadius: 8, border: '1.5px solid #30363D',
                      fontSize: 14, color: '#8B949E', backgroundColor: '#1C2430', cursor: 'pointer',
                    }}
                  >
                    <option value="all">All</option>
                    <option value="AL">AL</option>
                    <option value="NL">NL</option>
                  </select>
                  <select
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as SortKey)}
                    style={{
                      padding: '8px 10px', borderRadius: 8, border: '1.5px solid #30363D',
                      fontSize: 14, color: '#8B949E', backgroundColor: '#1C2430', cursor: 'pointer',
                    }}
                  >
                    <option value="team">Team</option>
                    <option value="name">Stadium</option>
                    <option value="state">State</option>
                    <option value="division">Division</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────── */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#8B949E', fontSize: 15 }}>
              Loading parks…
            </div>
          ) : activeCategory === 'historical' ? (
            /* ── Historical tab ──────────────────────────────── */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3' }}>Historic Ballparks</div>
                  <div style={{ fontSize: 13, color: '#8B949E', marginTop: 3 }}>
                    Museums, landmarks, and legendary venues
                  </div>
                </div>
                <button
                  onClick={() => openAddForm('historic_ballpark', ['historic_ballpark'])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    cursor: 'pointer', backgroundColor: '#1F6FEB',
                    color: '#fff', fontWeight: 600, fontSize: 13, flexShrink: 0,
                  }}
                >
                  <Plus size={15} /> Log Visit
                </button>
              </div>
              {historicEvents.length === 0 ? (
                <div style={{
                  backgroundColor: '#161B22', borderRadius: 12,
                  padding: '56px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 6 }}>
                    No historic ballpark visits yet
                  </div>
                  <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 20 }}>
                    Visited the Hall of Fame or a legendary venue? Log it here.
                  </div>
                  <button
                    onClick={() => openAddForm('historic_ballpark', ['historic_ballpark'])}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      cursor: 'pointer', backgroundColor: '#1F6FEB',
                      color: '#fff', fontWeight: 600, fontSize: 13,
                    }}
                  >
                    <Plus size={15} /> Log Your First Visit
                  </button>
                </div>
              ) : (
                historicEvents.map(e => (
                  <EventRow key={e.id} event={e} onEdit={() => openEditForm(e)} onDelete={() => deleteEvent(e.id)} />
                ))
              )}
            </div>

          ) : activeCategory === 'spring' ? (
            /* ── Spring Training tab ─────────────────────────── */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3' }}>Spring Training</div>
                  <div style={{ fontSize: 13, color: '#8B949E', marginTop: 3 }}>
                    Cactus League & Grapefruit League games
                  </div>
                </div>
                <button
                  onClick={() => openAddForm('spring_training', ['spring_training'])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    cursor: 'pointer', backgroundColor: '#1F6FEB',
                    color: '#fff', fontWeight: 600, fontSize: 13, flexShrink: 0,
                  }}
                >
                  <Plus size={15} /> Log Game
                </button>
              </div>
              {springEvents.length === 0 ? (
                <div style={{
                  backgroundColor: '#161B22', borderRadius: 12,
                  padding: '56px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🌸</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 6 }}>
                    No spring training games logged yet
                  </div>
                  <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 20 }}>
                    Made it to Arizona or Florida for spring ball? Log it here.
                  </div>
                  <button
                    onClick={() => openAddForm('spring_training', ['spring_training'])}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      cursor: 'pointer', backgroundColor: '#1F6FEB',
                      color: '#fff', fontWeight: 600, fontSize: 13,
                    }}
                  >
                    <Plus size={15} /> Log Your First Game
                  </button>
                </div>
              ) : (
                springEvents.map(e => (
                  <EventRow key={e.id} event={e} onEdit={() => openEditForm(e)} onDelete={() => deleteEvent(e.id)} />
                ))
              )}
            </div>

          ) : activeCategory === 'passport' ? (
            /* ── Passport tab ────────────────────────────────── */
            <PassportTabContent stamps={passportStamps} earnedCount={visitedCount} />

          ) : activeCategory === 'events' ? (
            /* ── Events tab ──────────────────────────────────── */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3' }}>Special Events</div>
                  <div style={{ fontSize: 13, color: '#8B949E', marginTop: 3 }}>
                    Postseason, All-Star, World Series &amp; more
                  </div>
                </div>
                <button
                  onClick={() => openAddForm('world_series', EVENTS_SPECIAL_SET)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    cursor: 'pointer', backgroundColor: '#1F6FEB',
                    color: '#fff', fontWeight: 600, fontSize: 13, flexShrink: 0,
                  }}
                >
                  <Plus size={15} /> Log Event
                </button>
              </div>

              {/* Type filter chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <button
                  onClick={() => setEventsTypeFilter('all')}
                  style={{
                    padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', border: '1.5px solid',
                    borderColor: eventsTypeFilter === 'all' ? '#1F6FEB' : '#30363D',
                    backgroundColor: eventsTypeFilter === 'all' ? 'rgba(31,111,235,0.12)' : 'transparent',
                    color: eventsTypeFilter === 'all' ? '#1F6FEB' : '#8B949E',
                  }}
                >
                  All <span style={{ fontWeight: 400, fontSize: 12 }}>({otherEvents.length})</span>
                </button>
                {EVENTS_TAB_TYPES.map(t => {
                  const count = otherEvents.filter(e => e.event_type === t.value).length
                  if (count === 0) return null
                  const active = eventsTypeFilter === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => setEventsTypeFilter(t.value)}
                      style={{
                        padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', border: '1.5px solid',
                        borderColor: active ? '#1F6FEB' : '#30363D',
                        backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                        color: active ? '#1F6FEB' : '#8B949E',
                      }}
                    >
                      {t.icon} {t.label} <span style={{ fontWeight: 400, fontSize: 12 }}>({count})</span>
                    </button>
                  )
                })}
              </div>

              {filteredOtherEvents.length === 0 ? (
                <div style={{
                  backgroundColor: '#161B22', borderRadius: 12,
                  padding: '56px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 6 }}>
                    No special events logged yet
                  </div>
                  <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 20 }}>
                    Attended a World Series game, All-Star Game, or postseason? Log it here.
                  </div>
                  <button
                    onClick={() => openAddForm('world_series', EVENTS_SPECIAL_SET)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      cursor: 'pointer', backgroundColor: '#1F6FEB',
                      color: '#fff', fontWeight: 600, fontSize: 13,
                    }}
                  >
                    <Plus size={15} /> Log Your First Event
                  </button>
                </div>
              ) : (
                filteredOtherEvents.map(e => (
                  <EventRow key={e.id} event={e} onEdit={() => openEditForm(e)} onDelete={() => deleteEvent(e.id)} />
                ))
              )}
            </div>

          ) : (
            /* ── MLB tab ─────────────────────────────────────── */
            <>
              {/* Visited section */}
              <div id="visited-section" style={{ marginBottom: 40, scrollMarginTop: 60 }}>
                <SectionHeader count={visitedList.length}>Visited</SectionHeader>
                {visitedList.length === 0 ? (
                  <div style={{
                    backgroundColor: '#161B22', borderRadius: 12,
                    padding: '40px 24px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>⚾</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 6 }}>
                      {search || filterLeague !== 'all' ? 'No parks match your filters' : 'Your road trip starts here'}
                    </div>
                    <div style={{ fontSize: 13, color: '#8B949E' }}>
                      {search || filterLeague !== 'all'
                        ? 'Try adjusting your search or filters.'
                        : 'Head to a game and log your first stadium!'}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {visitedList.map(stadium => (
                      <StadiumCard
                        key={stadium.id}
                        stadium={stadium}
                        visited
                        visitDate={latestVisit[stadium.id]}
                        visitCount={visitCountMap[stadium.id]}
                        nextGame={nextGames[stadium.abbreviation]}
                        photo={photos[stadium.abbreviation]}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Not Yet section */}
              <div id="not-yet-section" style={{ scrollMarginTop: 60 }}>
                <SectionHeader count={unvisitedList.length}>On the List</SectionHeader>
                {unvisitedList.length === 0 ? (
                  <div style={{
                    backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D',
                    padding: '32px 24px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>
                      {search || filterLeague !== 'all' ? 'No parks match your filters.' : 'You\'ve visited them all!'}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {unvisitedList.map(stadium => (
                      <StadiumCard
                        key={stadium.id}
                        stadium={stadium}
                        visited={false}
                        nextGame={nextGames[stadium.abbreviation]}
                        photo={photos[stadium.abbreviation]}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </main>

      {/* ── Special Event Form modal ──────────────────────────────── */}
      {showForm && (
        <SpecialEventForm
          event={editingEvent}
          defaultType={formDefaultType}
          allowedTypes={formAllowedTypes}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false)
            await loadEvents()
          }}
        />
      )}

      <style>{`
        .stadium-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 24px rgba(0,0,0,0.4) !important;
          border-color: #484F58 !important;
          opacity: 1 !important;
        }
        .stadium-card:active {
          transform: translateY(0) !important;
          transition: transform 0.05s !important;
        }
      `}</style>
    </div>
  )
}
