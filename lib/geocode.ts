// City-level geocoding for custom event stops, using Open-Meteo's free
// geocoding API (no key). Accurate to the city, not the street, which is
// enough for weather and driving-distance estimates.

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}

export interface GeocodeResult { lat: number; lng: number; label: string }

interface OpenMeteoPlace {
  name: string; latitude: number; longitude: number
  admin1?: string; country_code?: string
}

// Pure selection step, split out so it can be tested without the network.
export function pickPlace(results: OpenMeteoPlace[], state: string): OpenMeteoPlace | null {
  const wanted = US_STATES[state.trim().toUpperCase()] ?? state.trim()
  const us = results.filter(r => r.country_code === 'US')
  const pool = us.length > 0 ? us : results
  if (wanted) {
    const hit = pool.find(r => r.admin1?.toLowerCase() === wanted.toLowerCase())
    if (hit) return hit
  }
  return pool[0] ?? null
}

export async function geocodeCity(city: string, state: string): Promise<GeocodeResult | null> {
  const name = city.trim()
  if (!name) return null
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`,
    )
    if (!res.ok) return null
    const data = await res.json() as { results?: OpenMeteoPlace[] }
    const place = pickPlace(data.results ?? [], state)
    if (!place) return null
    return {
      lat: place.latitude,
      lng: place.longitude,
      label: [place.name, place.admin1].filter(Boolean).join(', '),
    }
  } catch {
    return null
  }
}
