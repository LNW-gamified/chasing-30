'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import SpecialEventForm from '@/components/SpecialEventForm'
import { formatDate } from '@/lib/utils'
import type { SpecialEvent, SpecialEventType } from '@/types'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

const EVENT_META: Record<SpecialEventType, { label: string; icon: string; color: string }> = {
  world_series:      { label: 'World Series',              icon: '🏆', color: '#F5A623' },
  all_star_game:     { label: 'MLB All-Star Game',          icon: '⭐', color: '#1F6FEB' },
  postseason:        { label: 'MLB Postseason',             icon: '🍂', color: '#F5A623' },
  spring_training:   { label: 'Spring Training',            icon: '🌸', color: '#3FB950' },
  minor_league:      { label: 'Minor League',               icon: '🌱', color: '#10b981' },
  historic_ballpark: { label: 'Historic Ballpark',          icon: '🏛️', color: '#8b5cf6' },
  international:     { label: 'International Game',         icon: '🌍', color: '#06b6d4' },
  other:             { label: 'Other Experience',           icon: '📝', color: '#8B949E' },
}

// Use MLB logo from ESPN CDN for WS and All-Star
const MLB_LOGO = 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png'
const HISTORIC_ICONS: Record<string, string> = {
  'National Baseball Hall of Fame': '🏛️',
  'Louisville Slugger Museum & Factory': '🏏',
  'Negro Leagues Baseball Museum': '✊',
  'Field of Dreams': '🌽',
  'Rickwood Field': '🏟️',
}

function eventTitle(e: SpecialEvent): string {
  const t = e.event_type
  if (t === 'world_series') {
    const matchup = e.home_team && e.visiting_team ? ` — ${e.visiting_team} @ ${e.home_team}` : ''
    return `World Series${e.event_year ? ` ${e.event_year}` : ''}${e.game_number ? ` Game ${e.game_number}` : ''}${matchup}`
  }
  if (t === 'all_star_game') return `MLB All-Star Game${e.event_year ? ` ${e.event_year}` : ''}`
  if (t === 'postseason') {
    const matchup = e.home_team && e.visiting_team ? ` — ${e.visiting_team} @ ${e.home_team}` : ''
    return `${e.series_round ?? 'Postseason'}${e.event_year ? ` ${e.event_year}` : ''}${e.game_number ? ` Game ${e.game_number}` : ''}${matchup}`
  }
  if (t === 'spring_training') {
    const matchup = e.home_team && e.visiting_team ? `${e.visiting_team} @ ${e.home_team}` : (e.home_team ?? '')
    return `Spring Training — ${matchup || e.stadium_name || 'Game'}`
  }
  if (t === 'minor_league') {
    const matchup = e.home_team && e.visiting_team ? `${e.visiting_team} @ ${e.home_team}` : (e.home_team ?? '')
    return `${e.ml_level ?? 'Minor League'} — ${matchup || e.stadium_name || 'Game'}`
  }
  if (t === 'historic_ballpark') return e.venue_name ?? 'Historic Ballpark Visit'
  if (t === 'international') return e.series_name ?? `International Game — ${e.city ?? ''}`
  if (t === 'other') return e.custom_title ?? 'Baseball Experience'
  return 'Special Event'
}

function eventSubtitle(e: SpecialEvent): string {
  const parts: string[] = []
  if (e.stadium_name) parts.push(e.stadium_name)
  if (e.city) parts.push(e.city + (e.state ? `, ${e.state}` : '') + (e.country ? `, ${e.country}` : ''))
  else if (e.country) parts.push(e.country)
  return parts.join(' · ')
}

export default function SpecialEventsPage() {
  const [events, setEvents] = useState<SpecialEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SpecialEvent | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<SpecialEventType | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('special_events')
      .select('*')
      .order('event_date', { ascending: false })
    setEvents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    const supabase = createClient()
    await supabase.from('special_events').delete().eq('id', id)
    await load()
  }

  function openAdd() { setEditingEvent(undefined); setShowForm(true) }
  function openEdit(e: SpecialEvent) { setEditingEvent(e); setShowForm(true) }

  const byType = Object.keys(EVENT_META) as SpecialEventType[]
  const filteredEvents = activeFilter ? events.filter((e) => e.event_type === activeFilter) : events

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#E6EDF3' }}>Special Events</h1>
          <p className="text-base mt-0.5" style={{ color: '#8B949E' }}>
            {events.length} experience{events.length !== 1 ? 's' : ''} logged
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Log an Event
        </button>
      </div>

      {/* Category grid */}
      {events.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {byType.map((type) => {
            const count = events.filter((e) => e.event_type === type).length
            if (count === 0) return null
            const meta = EVENT_META[type]
            const active = activeFilter === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveFilter(active ? null : type)}
                className="card p-4 text-left transition-all"
                style={{
                  border: active ? `2px solid ${meta.color}` : '1px solid #30363D',
                  backgroundColor: active ? `${meta.color}18` : '#161B22',
                  cursor: 'pointer',
                }}
              >
                <div className="text-2xl mb-2">{meta.icon}</div>
                <div className="text-3xl font-bold leading-none" style={{ color: meta.color }}>{count}</div>
                <div className="text-xs mt-1.5 leading-snug" style={{ color: '#8B949E' }}>{meta.label}</div>
              </button>
            )
          })}
        </div>
      )}
      {activeFilter && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm" style={{ color: '#8B949E' }}>
            Showing: <span style={{ color: EVENT_META[activeFilter].color }}>{EVENT_META[activeFilter].label}</span>
          </span>
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8B949E' }}
          >
            Clear filter
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: '#8B949E' }}>Loading...</div>
      ) : events.length === 0 ? (
        <div className="card p-16 text-center" style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-4xl mb-4">⭐</div>
          <div className="text-lg font-semibold mb-1" style={{ color: '#8B949E' }}>No special events yet</div>
          <div className="text-base mb-5" style={{ color: '#8B949E' }}>
            Log a World Series, All-Star Game, minor league game, historic ballpark visit, and more
          </div>
          <button onClick={openAdd} className="btn-primary mx-auto">
            <Plus size={16} /> Log an Event
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredEvents.map((e) => {
            const meta = EVENT_META[e.event_type]
            const expanded = expandedId === e.id
            const useMlbLogo = e.event_type === 'world_series' || e.event_type === 'all_star_game'
            const historicIcon = e.event_type === 'historic_ballpark' ? HISTORIC_ICONS[e.venue_name ?? ''] : null

            return (
              <div
                key={e.id}
                className="card overflow-hidden"
                style={{ borderLeft: `3px solid ${meta.color}40` }}
              >
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                >
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${meta.color}20 0%, ${meta.color}10 100%)`,
                      border: `1px solid ${meta.color}25`,
                    }}
                  >
                    {useMlbLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={MLB_LOGO} alt="MLB" width={34} height={34} style={{ objectFit: 'contain' }} />
                    ) : historicIcon ? (
                      <span>{historicIcon}</span>
                    ) : (
                      <span>{meta.icon}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base" style={{ color: '#E6EDF3' }}>
                      {eventTitle(e)}
                    </div>
                    <div className="text-base mt-0.5 flex flex-wrap gap-2" style={{ color: '#8B949E' }}>
                      <span>{formatDate(e.event_date)}</span>
                      {eventSubtitle(e) && <span>· {eventSubtitle(e)}</span>}
                    </div>
                    <span
                      className="inline-block mt-1 text-base px-2.5 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); openEdit(e) }}
                      className="p-1.5 rounded" style={{ color: '#8B949E' }} title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); deleteEvent(e.id) }}
                      className="p-1.5 rounded" style={{ color: '#8B949E' }} title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    {expanded ? <ChevronUp size={16} style={{ color: '#8B949E' }} /> : <ChevronDown size={16} style={{ color: '#8B949E' }} />}
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div style={{ borderTop: '1px solid #30363D' }} className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      {e.weather && (
                        <div>
                          <div className="label">Weather</div>
                          <div className="text-sm" style={{ color: '#E6EDF3' }}>
                            {e.weather}{e.temperature ? ` · ${e.temperature}°F` : ''}
                          </div>
                        </div>
                      )}
                      {e.attendance && (
                        <div>
                          <div className="label">Attendance</div>
                          <div className="text-sm" style={{ color: '#E6EDF3' }}>{e.attendance.toLocaleString()}</div>
                        </div>
                      )}
                      {(e.seat_section || e.seat_row || e.seat_number) && (
                        <div>
                          <div className="label">Seating</div>
                          <div className="text-sm" style={{ color: '#E6EDF3' }}>
                            Sec {e.seat_section}, Row {e.seat_row}, Seat {e.seat_number}
                          </div>
                        </div>
                      )}
                    </div>

                    {e.photo_url && (
                      <div className="mb-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.photo_url} alt="Event photo" className="rounded-lg"
                          style={{ maxHeight: 220, objectFit: 'cover', width: '100%' }} />
                      </div>
                    )}

                    {e.notes && (
                      <div>
                        <div className="label mb-1">Notes</div>
                        <div className="text-sm whitespace-pre-wrap p-3 rounded-lg"
                          style={{ color: '#8B949E', backgroundColor: '#0d1424' }}>
                          {e.notes}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <SpecialEventForm
          event={editingEvent}
          onClose={() => { setShowForm(false); setEditingEvent(undefined) }}
          onSaved={() => { setShowForm(false); setEditingEvent(undefined); load() }}
        />
      )}
    </AppShell>
  )
}
