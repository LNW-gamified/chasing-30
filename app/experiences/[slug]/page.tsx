'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import BaseballLifeForm from '@/components/BaseballLifeForm'

interface BaseballExperience {
  id: string; name: string; slug: string; city: string; state: string | null
  country: string; description: string | null; highlights: string[] | null
  hours: string | null; admission: string | null; website_url: string | null
}

interface BleEntry {
  id: string; category: string; venue: string | null; event_type: string | null
  visit_date: string; notes: string | null
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ExperienceDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [exp, setExp] = useState<BaseballExperience | null>(null)
  const [entries, setEntries] = useState<BleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)

  async function loadData() {
    const supabase = createClient()
    const [{ data: experience }, { data: allBle }] = await Promise.all([
      supabase.from('baseball_experiences').select('*').eq('slug', slug).single(),
      supabase.from('baseball_life_entries')
        .select('id,category,venue,event_type,visit_date,notes')
        .eq('category', 'pilgrimage')
        .order('visit_date', { ascending: false }),
    ])
    setExp(experience ?? null)
    if (experience) {
      const nameLow = experience.name.toLowerCase()
      const keywords = nameLow.split(' ').slice(0, 2).join(' ')
      const matched = ((allBle ?? []) as BleEntry[]).filter(e =>
        e.venue?.toLowerCase().includes(keywords) ||
        e.event_type?.toLowerCase().includes(keywords)
      )
      setEntries(matched)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [slug])

  if (loading) return <div style={{ color: '#8B949E', textAlign: 'center', padding: '80px 16px' }}>Loading…</div>
  if (!exp) return <div style={{ color: '#8B949E', textAlign: 'center', padding: '80px 16px' }}>Experience not found.</div>

  const loc = [exp.city, exp.state, exp.country !== 'USA' ? exp.country : null].filter(Boolean).join(', ')
  const visited = entries.length > 0

  return (
    <div style={{ color: '#E6EDF3', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>

        <Link href="/stadiums" style={{ fontSize: 13, color: '#8B949E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>← Ballparks</Link>

        {/* Hero */}
        <div style={{ backgroundColor: '#161B22', borderRadius: 16, border: visited ? '1px solid rgba(63,185,80,0.35)' : '1px solid #21262D', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(139,148,158,0.15) 0%, rgba(139,148,158,0.04) 100%)', position: 'relative' }}>
            <span style={{ fontSize: 72 }}>🏛️</span>
            {visited && (
              <div style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#3FB950', color: '#0B1117', fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20 }}>Visited ✓</div>
            )}
          </div>
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <MapPin size={12} color="#8B949E" />
              <span style={{ fontSize: 12, color: '#8B949E' }}>{loc}</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#E6EDF3', margin: '0 0 12px', lineHeight: 1.2 }}>{exp.name}</h1>
            {exp.description && <p style={{ fontSize: 14, color: '#8B949E', lineHeight: 1.6, margin: '0 0 16px' }}>{exp.description}</p>}

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              {exp.admission && (
                <div>
                  <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admission</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginTop: 2 }}>{exp.admission}</div>
                </div>
              )}
              {exp.hours && (
                <div>
                  <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hours</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginTop: 2 }}>{exp.hours}</div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setLogOpen(true)}
                style={{ padding: '10px 20px', borderRadius: 10, backgroundColor: visited ? 'rgba(63,185,80,0.15)' : '#1F6FEB', color: visited ? '#3FB950' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: visited ? '1px solid rgba(63,185,80,0.3)' : 'none' } as React.CSSProperties}
              >
                {visited ? '+ Log Another Visit' : '+ Log a Visit'}
              </button>
              {exp.website_url && (
                <a href={`https://${exp.website_url}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #30363D', backgroundColor: 'transparent', color: '#8B949E', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ExternalLink size={13} /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Highlights */}
        {exp.highlights && exp.highlights.length > 0 && (
          <div style={{ backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #21262D', padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>What to See & Do</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exp.highlights.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#3FB950', flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#E6EDF3', lineHeight: 1.5 }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Visits */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3', marginBottom: 14 }}>
            Your Visits {entries.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#3FB950', marginLeft: 8 }}>{entries.length} logged</span>}
          </div>
          {entries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entries.map(e => (
                <div key={e.id} style={{ backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #21262D', padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{fmtDate(e.visit_date)}</div>
                  {e.venue && e.venue !== exp.name && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{e.venue}</div>}
                  {e.notes && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 6, lineHeight: 1.5 }}>{e.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8B949E', fontSize: 13 }}>
              You haven&apos;t visited yet. Tap &quot;Log a Visit&quot; when you do!
            </div>
          )}
        </div>
      </div>

      {logOpen && (
        <BaseballLifeForm
          defaultCategory="pilgrimage"
          defaultEventType={exp.name}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); loadData() }}
        />
      )}
    </div>
  )
}
