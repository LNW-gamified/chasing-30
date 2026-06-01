import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY
  if (!apiKey) return NextResponse.json({ miles: null })

  const fromLat = req.nextUrl.searchParams.get('fromLat')
  const fromLng = req.nextUrl.searchParams.get('fromLng')
  const toLat   = req.nextUrl.searchParams.get('toLat')
  const toLng   = req.nextUrl.searchParams.get('toLng')
  if (!fromLat || !fromLng || !toLat || !toLng) return NextResponse.json({ miles: null })

  try {
    const res = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?start=${fromLng},${fromLat}&end=${toLng},${toLat}`,
      { headers: { Authorization: apiKey } }
    )
    if (!res.ok) return NextResponse.json({ miles: null })
    const data = await res.json()
    const meters: number = data.features?.[0]?.properties?.summary?.distance ?? null
    if (meters == null) return NextResponse.json({ miles: null })
    return NextResponse.json({ miles: Math.round(meters / 1609.344) })
  } catch {
    return NextResponse.json({ miles: null })
  }
}
