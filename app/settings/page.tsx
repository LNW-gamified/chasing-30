'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const [units, setUnits] = useState<'mi' | 'km'>('mi')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata
      if (meta?.distance_units) setUnits(meta.distance_units)
    })
  }, [])

  async function saveUnits(value: 'mi' | 'km') {
    setUnits(value)
    setSaving(true)
    const supabase = createClient()
    await supabase.auth.updateUser({ data: { distance_units: value } })
    setSaving(false)
  }

  return (
    <div style={{ color: '#E6EDF3', minHeight: '100vh' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 80px' }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#8B949E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Home
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 24 }}>Settings</h1>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Units</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {(['mi', 'km'] as const).map(u => (
            <button
              key={u}
              onClick={() => saveUnits(u)}
              disabled={saving}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 10,
                border: `1.5px solid ${units === u ? '#1F6FEB' : '#30363D'}`,
                backgroundColor: units === u ? '#1F6FEB' : '#161B22',
                color: units === u ? '#fff' : '#8B949E',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              {u === 'mi' ? 'Miles' : 'Kilometers'}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.6 }}>
          More preferences — notifications, favorite team, and data export — live in your profile menu (tap your avatar in the top right).
        </div>
      </div>
    </div>
  )
}
