import { STADIUM_TZ } from '@/lib/mlb-api'

export type DayNight = 'day' | 'night' | 'twilight' | null

// Parse "7:05 PM" or "1:10 PM" → 24-hour integer hour (19, 13, etc.)
function parseHour24(timeStr: string): number | null {
  const m = timeStr.match(/(\d+):\d+\s*(AM|PM)/i)
  if (!m) return null
  let h = parseInt(m[1])
  const isPM = m[2].toUpperCase() === 'PM'
  if (isPM && h !== 12) h += 12
  if (!isPM && h === 12) h = 0
  return h
}

// Get local sunset hour for a given lat/lng/date using sunrise-sunset.org
async function fetchSunsetLocalHour(lat: number, lng: number, date: string, tz: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK') return null
    const sunsetUTC: string = data.results.sunset
    const localHour = parseInt(
      new Date(sunsetUTC).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
    )
    return isNaN(localHour) ? null : localHour
  } catch {
    return null
  }
}

export async function classifyDayNight(
  firstPitchTime: string | null,
  visitDate:      string,
  teamAbbr:       string,
  lat:            number,
  lng:            number
): Promise<DayNight> {
  if (!firstPitchTime) return null
  const pitchHour = parseHour24(firstPitchTime)
  if (pitchHour === null) return null

  const tz = STADIUM_TZ[teamAbbr] ?? 'America/New_York'
  const sunsetHour = await fetchSunsetLocalHour(lat, lng, visitDate, tz)

  if (sunsetHour === null) {
    // Fallback heuristic if API fails
    if (pitchHour < 12 || (pitchHour >= 12 && pitchHour < 17)) return 'day'
    return 'night'
  }

  const diff = pitchHour - sunsetHour
  if (diff < -2)  return 'day'      // starts 2+ hrs before sunset
  if (diff < 0)   return 'twilight' // starts within 2 hrs before sunset
  return 'night'                     // starts after sunset
}

// Lightweight heuristic — no API call, used for bulk stats
export function classifyDayNightHeuristic(firstPitchTime: string | null): DayNight {
  if (!firstPitchTime) return null
  const h = parseHour24(firstPitchTime)
  if (h === null) return null
  if (h < 17)    return 'day'
  if (h < 19)    return 'twilight'
  return 'night'
}
