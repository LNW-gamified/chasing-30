'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { BaseballLifeCategory } from '@/types'
import { eventMatches, eventDefaultType } from '@/lib/event-match'
import { GAME_MOMENTS } from '@/lib/moments'
import EventTeamLogo from '@/components/EventTeamLogo'

// Large form only ever shown behind a click — load it on demand instead
// of shipping its code in this route's initial bundle.
const BaseballLifeForm = dynamic(() => import('@/components/BaseballLifeForm'), { ssr: false })

interface BaseballEvent {
  id: string; name: string; slug: string; category: string; description: string | null
}

interface BleEntry {
  id: string; category: string; event_type: string | null; venue: string | null
  city: string | null; state: string | null; visit_date: string
  home_team: string | null; away_team: string | null; opponent: string | null
  final_score_home: number | null; final_score_away: number | null
  game_time: string | null
  ticket_section: string | null; ticket_row: string | null; ticket_seats: string[] | null
  weather_temp: string | null; weather_conditions: string | null
  moments: string[] | null; companions: string[] | null
  giveaway_items: Array<{ name?: string }> | null
  photos: string[] | null
  notes: string | null
}

const EVENT_META: Record<string, { emoji: string; color: string; label: string }> = {
  all_star:       { emoji: '🌟', color: '#F5A623', label: 'All-Star' },
  home_run_derby: { emoji: '💥', color: '#E8820C', label: 'Home Run Derby' },
  playoffs:       { emoji: '🍂', color: '#E31937', label: 'Playoffs' },
  world_series:   { emoji: '🏆', color: '#C41E3A', label: 'World Series' },
  field_of_dreams:{ emoji: '🌽', color: '#3FB950', label: 'Field of Dreams' },
  spring_training:{ emoji: '🌞', color: '#1F6FEB', label: 'Spring Training' },
  exhibition:     { emoji: '🍌', color: '#F5A623', label: 'Banana Ball & Exhibition' },
  amateur:        { emoji: '🎓', color: '#58A6FF', label: 'Amateur & Collegiate' },
  international:  { emoji: '🌍', color: '#58A6FF', label: 'International Games' },
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const detailLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.06em' }

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={detailLabel}>{label}</div>
      <div style={{ fontSize: 13, color: '#E6EDF3', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  )
}

export default function EventDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [event, setEvent] = useState<BaseballEvent | null>(null)
  const [entries, setEntries] = useState<BleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [year, setYear] = useState<string>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  async function loadData() {
    const supabase = createClient()
    const [{ data: ev }, { data: allBle }] = await Promise.all([
      supabase.from('baseball_events').select('*').eq('slug', slug).single(),
      supabase.from('baseball_life_entries')
        .select('id,category,event_type,venue,city,state,visit_date,home_team,away_team,opponent,final_score_home,final_score_away,game_time,ticket_section,ticket_row,ticket_seats,weather_temp,weather_conditions,moments,companions,giveaway_items,photos,notes')
        .order('visit_date', { ascending: false }),
    ])
    setEvent(ev ?? null)
    setEntries(((allBle ?? []) as BleEntry[]).filter(e => eventMatches(slug, e)))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [slug])

  if (loading) return <div style={{ color: '#8B949E', textAlign: 'center', padding: '80px 16px' }}>Loading…</div>
  if (!event) return <div style={{ color: '#8B949E', textAlign: 'center', padding: '80px 16px' }}>Event not found.</div>

  const years = Array.from(new Set(entries.map(e => e.visit_date.slice(0, 4)))).sort().reverse()
  const shown = year === 'all' ? entries : entries.filter(e => e.visit_date.startsWith(year))
  const meta = EVENT_META[event.category] ?? { emoji: '🏆', color: '#F5A623', label: event.category }
  const cat: BaseballLifeCategory = event.category === 'spring_training' ? 'spring_training' : 'mlb_special_event'

  return (
    <div style={{ color: '#E6EDF3', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>

        <Link href="/stadiums" onClick={() => { sessionStorage.setItem('ballparks-tab', 'events') }} style={{ fontSize: 13, color: '#8B949E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>← Ballparks</Link>

        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg, rgba(${parseInt(meta.color.slice(1,3),16)},${parseInt(meta.color.slice(3,5),16)},${parseInt(meta.color.slice(5,7),16)},0.2) 0%, rgba(${parseInt(meta.color.slice(1,3),16)},${parseInt(meta.color.slice(3,5),16)},${parseInt(meta.color.slice(5,7),16)},0.06) 100%)`, borderRadius: 16, padding: '32px 24px', textAlign: 'center', marginBottom: 24, border: `1px solid rgba(${parseInt(meta.color.slice(1,3),16)},${parseInt(meta.color.slice(3,5),16)},${parseInt(meta.color.slice(5,7),16)},0.3)` }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>{meta.emoji}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{meta.label}</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#E6EDF3', margin: '0 0 12px', lineHeight: 1.2 }}>{event.name}</h1>
          {event.description && <p style={{ fontSize: 14, color: '#8B949E', lineHeight: 1.6, margin: 0, maxWidth: 480, marginInline: 'auto' }}>{event.description}</p>}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setLogOpen(true)}
              style={{ padding: '12px 28px', borderRadius: 12, border: 'none', backgroundColor: meta.color, color: entries.length > 0 ? '#000' : '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              {entries.length > 0 ? '+ Log Another Attendance' : '+ Log Attendance'}
            </button>
          </div>
        </div>

        {/* Summary */}
        {entries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Games', value: entries.length },
              { label: 'Venues', value: new Set(entries.map(e => e.venue).filter(Boolean)).size },
              { label: 'Cities', value: new Set(entries.map(e => [e.city, e.state].filter(Boolean).join(', ')).filter(Boolean)).size },
            ].map(t => (
              <div key={t.label} style={{ backgroundColor: '#161B22', border: '1px solid #21262D', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: meta.color, lineHeight: 1.1 }}>{t.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8B949E', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Your History */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>
              Your History {entries.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#3FB950', marginLeft: 8 }}>{entries.length} attended</span>}
            </div>
            {years.length > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', ...years].map(y => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    style={{ fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${year === y ? meta.color : '#30363D'}`,
                      backgroundColor: year === y ? `${meta.color}22` : 'transparent',
                      color: year === y ? meta.color : '#8B949E' }}
                  >
                    {y === 'all' ? 'All' : y}
                  </button>
                ))}
              </div>
            )}
          </div>
          {shown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shown.map(e => {
                const open = openId === e.id
                const hasScore = e.final_score_home != null && e.final_score_away != null
                const away = e.away_team ?? e.opponent
                const home = e.home_team
                const loc = [e.venue, e.city, e.state].filter(Boolean).join(', ')
                const seats = [e.ticket_section && `Sec ${e.ticket_section}`, e.ticket_row && `Row ${e.ticket_row}`, e.ticket_seats?.length ? `Seat ${e.ticket_seats.join(', ')}` : null].filter(Boolean).join(' · ')
                const weather = [e.weather_temp, e.weather_conditions].filter(Boolean).join(' · ')
                const moments = (e.moments ?? []).map(id => GAME_MOMENTS.find(m => m.id === id)).filter(Boolean)
                const giveaways = (e.giveaway_items ?? []).map(g => g?.name).filter(Boolean) as string[]
                const photos = (e.photos ?? []).filter(u => typeof u === 'string' && u.startsWith('http'))
                const hasSheet = !!(e.game_time || seats || weather || moments.length || giveaways.length || (e.companions ?? []).length || photos.length || e.notes)
                return (
                  <div key={e.id} style={{ backgroundColor: '#161B22', borderRadius: 12, border: `1px solid ${open ? meta.color + '66' : '#21262D'}`, overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenId(open ? null : e.id)}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {away && <EventTeamLogo key={away} name={away} size={36} />}
                        {home && <div style={{ marginLeft: -8 }}><EventTeamLogo key={home} name={home} size={36} /></div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3 }}>
                          {away && home ? `${away} vs ${home}` : (away ? `vs ${away}` : (e.event_type ?? event.name))}
                        </div>
                        <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>{fmtDate(e.visit_date)}</div>
                        {loc && <div style={{ fontSize: 13, color: '#8B949E', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc}</div>}
                      </div>
                      {hasScore && (
                        <div style={{ fontSize: 20, fontWeight: 900, color: meta.color, flexShrink: 0 }}>
                          {e.final_score_away}–{e.final_score_home}
                        </div>
                      )}
                      <span style={{ fontSize: 13, color: '#8B949E', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
                    </button>

                    {open && (
                      <div style={{ borderTop: '1px solid #21262D', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {!hasSheet && (
                          <div style={{ fontSize: 13, color: '#8B949E' }}>No extra details were logged for this game.</div>
                        )}
                        {(e.game_time || seats || weather) && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                            {e.game_time && <Detail label="First pitch" value={e.game_time} />}
                            {seats && <Detail label="Seats" value={seats} />}
                            {weather && <Detail label="Weather" value={weather} />}
                          </div>
                        )}
                        {moments.length > 0 && (
                          <div>
                            <div style={detailLabel}>Moments</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                              {moments.map(m => (
                                <span key={m!.id} style={{ fontSize: 13, color: '#E6EDF3', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #30363D', borderRadius: 999, padding: '3px 10px' }}>
                                  {m!.icon} {m!.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {giveaways.length > 0 && <Detail label="Giveaways and souvenirs" value={giveaways.join(', ')} />}
                        {(e.companions ?? []).length > 0 && <Detail label="Went with" value={(e.companions ?? []).join(', ')} />}
                        {e.notes && <Detail label="Notes" value={e.notes} />}
                        {photos.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {photos.map(u => (
                              <a key={u} href={u} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={u} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #30363D' }} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8B949E', fontSize: 13 }}>
              {entries.length > 0
                ? 'No games logged for that year.'
                : 'You haven\'t attended this event yet. Tap "Log Attendance" when you do!'}
            </div>
          )}
        </div>
      </div>

      {logOpen && (
        <BaseballLifeForm
          defaultCategory={cat}
          defaultEventType={eventDefaultType(slug) || undefined}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); loadData() }}
        />
      )}
    </div>
  )
}
