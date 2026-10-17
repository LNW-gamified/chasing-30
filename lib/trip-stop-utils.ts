import type { Stadium, TripStop } from '@/types'

// Best available coordinates for a stop: its ballpark, then its destination,
// then a custom event's own location. Shared by the mileage calculation and
// the mileage display so their segment numbering always lines up.
export function stopCoords(s: TripStop): { lat: number; lng: number } | null {
  const stadium = s.stadium as Stadium | null | undefined
  const destination = s.destination as { lat: number | null; lng: number | null } | null | undefined
  if (stadium?.lat != null && stadium?.lng != null) return { lat: stadium.lat, lng: stadium.lng }
  if (destination?.lat != null && destination?.lng != null) return { lat: destination.lat, lng: destination.lng }
  if (s.event_lat != null && s.event_lng != null) return { lat: s.event_lat, lng: s.event_lng }
  return null
}

// "7:05 PM PT" -> "19:05". Returns '' when there is no usable time.
export function toTwentyFourHour(text: string | null): string {
  const m = text?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const mer = m[3]?.toUpperCase()
  if (mer === 'PM' && h < 12) h += 12
  if (mer === 'AM' && h === 12) h = 0
  if (h > 23) return ''
  return `${String(h).padStart(2, '0')}:${m[2]}`
}
