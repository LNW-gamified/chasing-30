import { NextRequest, NextResponse } from 'next/server'

// Compute a future Unix timestamp for traffic estimation.
// Always returns a time in the future so Google Maps can apply traffic models.
function departureTimestamp(gameDate: string, gameTime?: string | null): number {
  // Parse game hour from strings like "7:10 PM ET", "1:05 PM CT", etc.
  let gameHour = 19 // default 7 PM
  let gameMin  = 0
  if (gameTime) {
    const m = gameTime.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (m) {
      gameHour = parseInt(m[1])
      gameMin  = parseInt(m[2])
      if (m[3].toUpperCase() === 'PM' && gameHour !== 12) gameHour += 12
      if (m[3].toUpperCase() === 'AM' && gameHour === 12) gameHour = 0
    }
  }

  // Depart 3 hours before first pitch
  let deptHour = gameHour - 3
  if (deptHour < 0) deptHour = 0

  // Build a Date from game_date (YYYY-MM-DD) at departure hour, treated as local noon-anchored
  const [y, mo, d] = gameDate.split('-').map(Number)
  const dept = new Date(y, mo - 1, d, deptHour, gameMin, 0, 0)

  // If the computed departure is in the past, shift to the same day-of-week next week
  // (preserves weekday traffic pattern, which is what matters for estimation)
  const now = Date.now()
  if (dept.getTime() < now + 60_000) {
    const daysAhead = ((dept.getDay() - new Date().getDay() + 7) % 7) || 7
    dept.setDate(dept.getDate() + daysAhead)
  }

  return Math.floor(dept.getTime() / 1000)
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ minutes: null, miles: null })

  const p         = req.nextUrl.searchParams
  const fromLat   = p.get('fromLat')
  const fromLng   = p.get('fromLng')
  const toLat     = p.get('toLat')
  const toLng     = p.get('toLng')
  const gameDate  = p.get('gameDate')
  const gameTime  = p.get('gameTime')   // optional

  if (!fromLat || !fromLng || !toLat || !toLng || !gameDate) {
    return NextResponse.json({ minutes: null, miles: null })
  }

  const deptTs  = departureTimestamp(gameDate, gameTime)
  const dayName = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${fromLat},${fromLng}` +
    `&destinations=${toLat},${toLng}` +
    `&departure_time=${deptTs}` +
    `&traffic_model=best_guess` +
    `&units=imperial` +
    `&key=${apiKey}`

  try {
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ minutes: null, miles: null })

    const data = await res.json()
    const el   = data?.rows?.[0]?.elements?.[0]
    if (!el || el.status !== 'OK') return NextResponse.json({ minutes: null, miles: null })

    // Prefer traffic-aware duration; fall back to base duration
    const seconds = el.duration_in_traffic?.value ?? el.duration?.value ?? null
    const meters  = el.distance?.value ?? null

    if (seconds == null) return NextResponse.json({ minutes: null, miles: null })

    const minutes = Math.round(seconds / 60)
    const miles   = meters != null ? Math.round(meters / 1609.344 * 10) / 10 : null

    return NextResponse.json({ minutes, miles, dayName })
  } catch {
    return NextResponse.json({ minutes: null, miles: null })
  }
}
