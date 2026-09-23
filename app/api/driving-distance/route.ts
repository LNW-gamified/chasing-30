import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Rounds to ~11m precision — plenty for a cache lookup between two
// stadiums/destinations, and it means tiny float differences in how a
// coordinate got stored still hit the same cache row.
function round(n: number): number {
  return Math.round(n * 10000) / 10000
}

export async function GET(req: NextRequest) {
  const fromLatRaw = req.nextUrl.searchParams.get('fromLat')
  const fromLngRaw = req.nextUrl.searchParams.get('fromLng')
  const toLatRaw   = req.nextUrl.searchParams.get('toLat')
  const toLngRaw   = req.nextUrl.searchParams.get('toLng')
  if (!fromLatRaw || !fromLngRaw || !toLatRaw || !toLngRaw) {
    return NextResponse.json({ miles: null, minutes: null })
  }

  const fromLat = round(parseFloat(fromLatRaw))
  const fromLng = round(parseFloat(fromLngRaw))
  const toLat   = round(parseFloat(toLatRaw))
  const toLng   = round(parseFloat(toLngRaw))

  // Normalize direction — A→B and B→A are cached as the same row
  // (driving distance is close enough to symmetric for this purpose),
  // so store/look up with whichever point comes first when compared.
  const forward = fromLat < toLat || (fromLat === toLat && fromLng <= toLng)
  const p1 = forward ? { lat: fromLat, lng: fromLng } : { lat: toLat, lng: toLng }
  const p2 = forward ? { lat: toLat, lng: toLng } : { lat: fromLat, lng: fromLng }

  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('route_cache')
    .select('miles, minutes')
    .eq('from_lat', p1.lat).eq('from_lng', p1.lng)
    .eq('to_lat', p2.lat).eq('to_lng', p2.lng)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({ miles: cached.miles, minutes: cached.minutes })
  }

  const apiKey = process.env.OPENROUTESERVICE_API_KEY
  if (!apiKey) return NextResponse.json({ miles: null, minutes: null })

  try {
    const res = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?start=${fromLng},${fromLat}&end=${toLng},${toLat}`,
      { headers: { Authorization: apiKey } }
    )
    if (!res.ok) return NextResponse.json({ miles: null, minutes: null })
    const data = await res.json()
    const meters: number = data.features?.[0]?.properties?.summary?.distance ?? null
    const seconds: number | null = data.features?.[0]?.properties?.summary?.duration ?? null
    if (meters == null) return NextResponse.json({ miles: null, minutes: null })

    const miles = Math.round(meters / 1609.344)
    const minutes = seconds != null ? Math.round(seconds / 60) : null

    // Best-effort write — a duplicate-key race (two requests for the
    // same pair at once) or any other insert failure shouldn't stop the
    // real answer from being returned.
    await supabase.from('route_cache').insert({
      from_lat: p1.lat, from_lng: p1.lng, to_lat: p2.lat, to_lng: p2.lng,
      miles, minutes,
    })

    return NextResponse.json({ miles, minutes })
  } catch {
    return NextResponse.json({ miles: null, minutes: null })
  }
}
