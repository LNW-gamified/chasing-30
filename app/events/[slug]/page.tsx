'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { BaseballLifeCategory } from '@/types'

// Large form only ever shown behind a click — load it on demand instead
// of shipping its code in this route's initial bundle.
const BaseballLifeForm = dynamic(() => import('@/components/BaseballLifeForm'), { ssr: false })

interface BaseballEvent {
  id: string; name: string; slug: string; category: string; description: string | null
}

interface BleEntry {
  id: string; category: string; event_type: string | null; venue: string | null
  city: string | null; state: string | null; visit_date: string
  final_score_home: number | null; final_score_away: number | null; notes: string | null
}

const EVENT_META: Record<string, { emoji: string; color: string; label: string }> = {
  all_star:       { emoji: '🌟', color: '#F5A623', label: 'All-Star' },
  home_run_derby: { emoji: '💥', color: '#E8820C', label: 'Home Run Derby' },
  playoffs:       { emoji: '🍂', color: '#E31937', label: 'Playoffs' },
  world_series:   { emoji: '🏆', color: '#C41E3A', label: 'World Series' },
  field_of_dreams:{ emoji: '🌽', color: '#3FB950', label: 'Field of Dreams' },
  spring_training:{ emoji: '🌞', color: '#1F6FEB', label: 'Spring Training' },
}

const MATCH_KEYWORDS: Record<string, string[]> = {
  'mlb-all-star-game': ['all-star', 'all star'],
  'home-run-derby': ['home run derby'],
  'wild-card-game': ['wild card'],
  'division-series-alds': ['alds'],
  'division-series-nlds': ['nlds'],
  'championship-series-alcs': ['alcs'],
  'championship-series-nlcs': ['nlcs'],
  'world-series': ['world series'],
  'field-of-dreams-game': ['field of dreams'],
  'spring-training-cactus': [],
  'spring-training-grapefruit': [],
}

const DEFAULT_EVENT_TYPE: Record<string, string> = {
  'mlb-all-star-game': 'All-Star Game', 'home-run-derby': 'Home Run Derby',
  'wild-card-game': 'Wild Card Game', 'division-series-alds': 'ALDS',
  'division-series-nlds': 'NLDS', 'championship-series-alcs': 'ALCS',
  'championship-series-nlcs': 'NLCS', 'world-series': 'World Series',
  'field-of-dreams-game': 'Field of Dreams Game',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function EventDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [event, setEvent] = useState<BaseballEvent | null>(null)
  const [entries, setEntries] = useState<BleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)

  async function loadData() {
    const supabase = createClient()
    const [{ data: ev }, { data: allBle }] = await Promise.all([
      supabase.from('baseball_events').select('*').eq('slug', slug).single(),
      supabase.from('baseball_life_entries')
        .select('id,category,event_type,venue,city,state,visit_date,final_score_home,final_score_away,notes')
        .order('visit_date', { ascending: false }),
    ])
    setEvent(ev ?? null)
    // Filter entries that match this event
    const keywords = MATCH_KEYWORDS[slug] ?? []
    const isST = slug.startsWith('spring-training')
    const matched = ((allBle ?? []) as BleEntry[]).filter(e => {
      if (isST) return e.category === 'spring_training'
      return e.category === 'mlb_special_event' && keywords.some(kw => e.event_type?.toLowerCase().includes(kw))
    })
    setEntries(matched)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [slug])

  if (loading) return <div style={{ color: '#8B949E', textAlign: 'center', padding: '80px 16px' }}>Loading…</div>
  if (!event) return <div style={{ color: '#8B949E', textAlign: 'center', padding: '80px 16px' }}>Event not found.</div>

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

        {/* Your History */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3', marginBottom: 14 }}>
            Your History {entries.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#3FB950', marginLeft: 8 }}>{entries.length} attended</span>}
          </div>
          {entries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entries.map(e => {
                const score = e.final_score_home != null && e.final_score_away != null
                  ? `${e.final_score_home}–${e.final_score_away}` : null
                const loc = [e.venue, e.city, e.state].filter(Boolean).join(', ')
                return (
                  <div key={e.id} style={{ backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #21262D', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{fmtDate(e.visit_date)}</div>
                        {loc && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{loc}</div>}
                        {e.notes && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 6, lineHeight: 1.5 }}>{e.notes}</div>}
                      </div>
                      {score && <div style={{ fontSize: 20, fontWeight: 900, color: '#F5A623', flexShrink: 0 }}>{score}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8B949E', fontSize: 13 }}>
              You haven&apos;t attended this event yet. Tap &quot;Log Attendance&quot; when you do!
            </div>
          )}
        </div>
      </div>

      {logOpen && (
        <BaseballLifeForm
          defaultCategory={cat}
          defaultEventType={DEFAULT_EVENT_TYPE[slug]}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); loadData() }}
        />
      )}
    </div>
  )
}
