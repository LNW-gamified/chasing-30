import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const date = searchParams.get('date')
  const apiKey = process.env.OPENWEATHER_API_KEY

  if (!lat || !lng || !date || !apiKey) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const gameDate = new Date(date + 'T12:00:00')
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const todayDate = new Date(todayStr + 'T12:00:00')
  const diffDays = Math.round((gameDate.getTime() - todayDate.getTime()) / 86400000)

  // Only support today, yesterday, and next 4 days on free OWM tier
  if (diffDays < -1 || diffDays > 4) {
    return NextResponse.json({ outOfRange: true })
  }

  try {
    let temp: number | null = null
    let description: string | null = null

    if (diffDays <= 0) {
      // Today or yesterday — use current conditions
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=imperial&appid=${apiKey}`
      )
      if (!res.ok) return NextResponse.json({ error: 'OWM error' }, { status: 502 })
      const data = await res.json()
      temp = Math.round(data.main.temp)
      description = titleCase(data.weather?.[0]?.description ?? '')
    } else {
      // Next 1–4 days — use 5-day/3-hour forecast, find entry closest to noon on target day
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=imperial&appid=${apiKey}`
      )
      if (!res.ok) return NextResponse.json({ error: 'OWM error' }, { status: 502 })
      const data = await res.json()

      const targetNoon = new Date(date + 'T12:00:00').getTime() / 1000
      const closest = (data.list ?? []).reduce((best: any, entry: any) =>
        !best || Math.abs(entry.dt - targetNoon) < Math.abs(best.dt - targetNoon) ? entry : best
      , null)

      if (closest) {
        temp = Math.round(closest.main.temp)
        description = titleCase(closest.weather?.[0]?.description ?? '')
      }
    }

    return NextResponse.json({ temp, description })
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }
}

function titleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}
