'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signin' | 'forgot' | 'sent'>('signin')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setMode('sent')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚾</div>
          <h1 className="text-2xl font-bold" style={{ color: '#E6EDF3' }}>
            Chasing 30
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8B949E' }}>
            MLB Stadium Tracker
          </p>
        </div>

        {/* Card */}
        <div
          className="card p-6"
          style={{ backgroundColor: '#161B22', border: '1px solid #30363D' }}
        >
          {mode === 'sent' ? (
            <>
              <h2 className="text-lg font-semibold mb-3" style={{ color: '#E6EDF3' }}>
                Check your email
              </h2>
              <p className="text-sm mb-6" style={{ color: '#8B949E' }}>
                If an account exists for {email}, a password reset link is on its way. It expires after a while, so use it soon.
              </p>
              <button
                type="button"
                className="btn-primary w-full justify-center"
                onClick={() => { setMode('signin'); setError('') }}
              >
                Back to Sign In
              </button>
            </>
          ) : mode === 'forgot' ? (
            <>
              <h2 className="text-lg font-semibold mb-6" style={{ color: '#E6EDF3' }}>
                Reset Password
              </h2>
              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
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
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-center"
                  style={{ color: '#8B949E', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer' }}
                  onClick={() => { setMode('signin'); setError('') }}
                >
                  Back to Sign In
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-6" style={{ color: '#E6EDF3' }}>
                Sign In
              </h2>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-center"
                  style={{ color: '#58A6FF', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer' }}
                  onClick={() => { setMode('forgot'); setError('') }}
                >
                  Forgot password?
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
