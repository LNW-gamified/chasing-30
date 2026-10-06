import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkCronAuth } from '@/lib/cron-auth'

// Called once a day by Vercel Cron (see vercel.json). Supabase pauses free
// projects after about a week of low activity, and a paused project takes the
// whole site down, login included, until someone clicks Resume in the Supabase
// dashboard. In the off-season nobody may open the app for a week, so this
// makes one small real read from the database every day to keep it counted as
// active.
//
// It reads baseball_history because that table allows anonymous reads and has
// a row to return; stadiums is readable only by logged-in users, so an
// anonymous read of it would quietly come back empty.

export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET)

  if (auth === 'not_configured') {
    console.error('keep-alive: CRON_SECRET is not set, so this route refuses to run. Add it in Vercel and redeploy.')
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (auth === 'unauthorized') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('keep-alive: Supabase environment variables are missing')
    return NextResponse.json({ ok: false, error: 'Supabase is not configured' }, { status: 500 })
  }

  // no-store so a cached answer can never stand in for a real database hit.
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  })

  const { data, error } = await supabase.from('baseball_history').select('id').limit(1)

  if (error) {
    console.error('keep-alive: database read failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const rows = data?.length ?? 0
  const checkedAt = new Date().toISOString()
  if (rows === 0) {
    // The query still reached the database, so it counts as activity, but an
    // empty answer means the table or its anonymous read policy changed.
    console.warn('keep-alive: database answered but returned no rows')
    return NextResponse.json({ ok: true, rows, checkedAt, warning: 'no rows returned' })
  }

  console.log(`keep-alive: database answered (${rows} row) at ${checkedAt}`)
  return NextResponse.json({ ok: true, rows, checkedAt })
}
