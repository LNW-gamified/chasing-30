'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Link2, Copy, Check, AlertCircle } from 'lucide-react'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for http or older browsers
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export default function ShareButton() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchToken() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('share_tokens')
          .select('token')
          .limit(1)
          .maybeSingle()
        setToken(data?.token ?? null)
      } catch {
        // table may not exist yet — button still renders, will show error on click
      } finally {
        setLoading(false)
      }
    }
    fetchToken()
  }, [])

  async function handleClick() {
    setBusy(true)
    setError(null)

    try {
      const supabase = createClient()
      let t = token

      if (!t) {
        const { data, error: insertErr } = await supabase
          .from('share_tokens')
          .insert({ created_at: new Date().toISOString() })
          .select('token')
          .single()
        if (insertErr || !data?.token) {
          setError(insertErr?.message ?? 'Could not create share link')
          setBusy(false)
          return
        }
        t = data.token as string
        setToken(t)
      }

      const url = `${window.location.origin}/share/${t}`
      const ok = await copyText(url)
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } else {
        setError(`Link: ${url}`)
      }
    } catch (e) {
      setError('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={busy}
        className="btn-secondary"
        style={{ fontSize: '0.9rem', padding: '6px 14px', gap: '6px' }}
        title="Copy public share link to clipboard"
      >
        {copied ? (
          <>
            <Check size={14} style={{ color: '#3FB950' }} />
            <span style={{ color: '#3FB950' }}>Link copied!</span>
          </>
        ) : busy ? (
          <>
            <Link2 size={14} />
            <span>Generating...</span>
          </>
        ) : (
          <>
            {token ? <Copy size={14} /> : <Link2 size={14} />}
            {token ? 'Copy Share Link' : 'Generate Share Link'}
          </>
        )}
      </button>
      {error && (
        <div className="flex items-center gap-1.5 text-xs max-w-xs" style={{ color: '#F85149' }}>
          <AlertCircle size={12} style={{ flexShrink: 0 }} />
          <span className="break-all">{error}</span>
        </div>
      )}
    </div>
  )
}
