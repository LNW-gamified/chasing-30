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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#0a0e1a' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚾</div>
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
            Chasing 30
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8896ae' }}>
            MLB Stadium Tracker
          </p>
        </div>

        {/* Card */}
        <div
          className="card p-6"
          style={{ backgroundColor: '#111827', border: '1px solid #1f2937' }}
        >
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#f1f5f9' }}>
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
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}
              >
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center mt-2" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
