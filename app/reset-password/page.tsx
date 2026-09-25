'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // The reset link in the email carries a recovery token in the URL —
    // Supabase's client picks it up automatically on load and fires this
    // event once a valid recovery session is established. Until that
    // happens, there's nothing legitimate to let someone set a password
    // for, so the form stays hidden.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // Covers the case where the event already fired before this listener
    // was attached (a fast page load).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords don\u2019t match.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1800)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚾</div>
          <h1 className="text-2xl font-bold" style={{ color: '#E6EDF3' }}>
            Chasing 30
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8B949E' }}>
            MLB Stadium Tracker
          </p>
        </div>

        <div
          className="card p-6"
          style={{ backgroundColor: '#161B22', border: '1px solid #30363D' }}
        >
          {done ? (
            <>
              <h2 className="text-lg font-semibold mb-3" style={{ color: '#E6EDF3' }}>
                Password updated
              </h2>
              <p className="text-sm" style={{ color: '#8B949E' }}>
                Taking you to your dashboard…
              </p>
            </>
          ) : !ready ? (
            <>
              <h2 className="text-lg font-semibold mb-3" style={{ color: '#E6EDF3' }}>
                Checking your link…
              </h2>
              <p className="text-sm" style={{ color: '#8B949E' }}>
                If this doesn&apos;t update in a few seconds, the reset link may have expired. Request a new one from the sign-in page.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-6" style={{ color: '#E6EDF3' }}>
                Set a New Password
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div
                    className="p-3 rounded-lg text-sm"
                    style={{ backgroundColor: 'rgba(248,81,73,0.1)', color: '#F85149' }}
                  >
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full justify-center mt-2" disabled={loading}>
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
