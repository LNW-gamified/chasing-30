import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 86400

export async function GET(req: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ videoId: null })

  const query = req.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ videoId: null })

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${apiKey}`
    )
    if (!res.ok) return NextResponse.json({ videoId: null })
    const data = await res.json()
    const videoId = data.items?.[0]?.id?.videoId ?? null
    return NextResponse.json({ videoId })
  } catch {
    return NextResponse.json({ videoId: null })
  }
}
