'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Link2, Copy, Check } from 'lucide-react'

export default function ShareButton() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchToken() {
      const supabase = createClient()
      const { data } = await supabase
        .from('share_tokens')
        .select('token')
        .limit(1)
        .maybeSingle()
      setToken(data?.token ?? null)
      setLoading(false)
    }
    fetchToken()
  }, [])

  async function generateLink() {
    setCopying(true)
    const supabase = createClient()
    let t = token
    if (!t) {
      const { data } = await supabase
        .from('share_tokens')
        .insert({})
        .select('token')
        .single()
      t = data?.token ?? null
      setToken(t)
    }
    if (t) {
      const url = `${window.location.origin}/share/${t}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
    setCopying(false)
  }

  if (loading) return null

  return (
    <button
      onClick={generateLink}
      disabled={copying}
      className="btn-secondary"
      style={{ fontSize: '0.8rem', padding: '6px 14px', gap: '6px' }}
      title="Copy public share link to clipboard"
    >
      {copied ? (
        <>
          <Check size={14} style={{ color: '#22c55e' }} />
          <span style={{ color: '#22c55e' }}>Copied!</span>
        </>
      ) : (
        <>
          {token ? <Copy size={14} /> : <Link2 size={14} />}
          {token ? 'Copy Share Link' : 'Generate Share Link'}
        </>
      )}
    </button>
  )
}
