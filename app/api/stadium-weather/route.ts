import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const BASEBALL_MONTHS = [4, 5, 6, 7, 8, 9, 10]

// Fetch 3 complete calendar years of historical data
const FETCH_START = '2022-01-01'
const FETCH_END   = '2024-12-31'

function computeRating(avgHigh: number, avgPrecipDays: number): 'great' | 'good' | 'fair' | 'avoid' {
  const LEVELS = ['avoid', 'fair', 'good', 'great'] as const
  let level: number
  if (avgHigh >= 65 && avgHigh <= 80)                                level = 3 // great
  else if ((avgHigh >= 55 && avgHigh < 65) || (avgHigh > 80 && avgHigh <= 90)) level = 2 // good
  else if ((avgHigh >= 45 && avgHigh < 55) || (avgHigh > 90 && avgHigh <= 95)) level = 1 // fair
  else                                                               level = 0 // avoid

  // Heavy precipitation downgrades by one level
  if (avgPrecipDays > 8 && level > 0) level--

  return LEVELS[level]
}

interface YearMonthBucket {
  temps:      number[]
  precipDays: number
  winds:      number[]
}

export async function GET(req: NextRequest) {
  const stadiumId = req.nextUrl.searchParams.get('stadiumId')
  if (!stadiumId) return NextResponse.json({ error: 'Missing stadiumId' }, { status: 400 })

  const supabase = await createClient()

  // Return cached data if all 12 months are present (historical averages never change)
  const { data: cached } = await supabase
    .from('stadium_weather')
    .select('*')
    .eq('stadium_id', stadiumId)
    .order('month')

  if (cached && cached.length === 12) {
    return NextResponse.json({ data: cached })
  }

  // Fetch stadium coordinates
  const { data: stadium } = await supabase
    .from('stadiums')
    .select('lat, lng')
    .eq('id', stadiumId)
    .single()

  if (!stadium) return NextResponse.json({ error: 'Stadium not found' }, { status: 404 })

  // Call Open-Meteo historical archive API (no key required)
  const meteoUrl =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${stadium.lat}&longitude=${stadium.lng}` +
    `&start_date=${FETCH_START}&end_date=${FETCH_END}` +
    `&daily=temperature_2m_max,precipitation_sum,windspeed_10m_max` +
    `&temperature_unit=fahrenheit`

  let meteoRes: Response
  try {
    meteoRes = await fetch(meteoUrl, { next: { revalidate: 0 } })
  } catch {
    return NextResponse.json({ error: 'Weather API unreachable' }, { status: 502 })
  }
  if (!meteoRes.ok) return NextResponse.json({ error: 'Weather API error' }, { status: 502 })

  const meteoJson = await meteoRes.json()
  const { time, temperature_2m_max, precipitation_sum, windspeed_10m_max } = meteoJson.daily as {
    time: string[]
    temperature_2m_max: (number | null)[]
    precipitation_sum:  (number | null)[]
    windspeed_10m_max:  (number | null)[]
  }

  // Bucket daily values by (year-index 0-2, month 1-12)
  const buckets: Record<number, YearMonthBucket[]> = {}
  for (let m = 1; m <= 12; m++) {
    buckets[m] = [
      { temps: [], precipDays: 0, winds: [] },
      { temps: [], precipDays: 0, winds: [] },
      { temps: [], precipDays: 0, winds: [] },
    ]
  }

  for (let i = 0; i < time.length; i++) {
    const d     = new Date(time[i] + 'T12:00:00Z')
    const month = d.getUTCMonth() + 1
    const yi    = d.getUTCFullYear() - 2022
    if (yi < 0 || yi > 2) continue

    const bucket = buckets[month][yi]
    if (temperature_2m_max[i]  != null) bucket.temps.push(temperature_2m_max[i]!)
    if (windspeed_10m_max[i]   != null) bucket.winds.push(windspeed_10m_max[i]!)
    if (precipitation_sum[i]   != null && precipitation_sum[i]! > 1) bucket.precipDays++
  }

  const mean = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length

  // Average across the 3 years and compute rating
  const rows = []
  for (let month = 1; month <= 12; month++) {
    const years = buckets[month].filter(y => y.temps.length > 0)
    if (years.length === 0) continue

    const avgHigh       = mean(years.map(y => mean(y.temps)))
    const avgPrecipDays = mean(years.map(y => y.precipDays))
    const avgWindSpeed  = mean(years.map(y => mean(y.winds)))
    const rating        = computeRating(Math.round(avgHigh), avgPrecipDays)

    rows.push({
      stadium_id:      stadiumId,
      month,
      avg_high_temp:   Math.round(avgHigh * 10) / 10,
      avg_precip_days: Math.round(avgPrecipDays * 10) / 10,
      avg_wind_speed:  Math.round(avgWindSpeed * 10) / 10,
      rating,
      last_updated:    new Date().toISOString(),
    })
  }

  // Upsert all 12 months
  await supabase
    .from('stadium_weather')
    .upsert(rows, { onConflict: 'stadium_id,month' })

  return NextResponse.json({ data: rows.filter(r => BASEBALL_MONTHS.includes(r.month)) })
}
