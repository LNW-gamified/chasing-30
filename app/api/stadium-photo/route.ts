import { NextRequest, NextResponse } from 'next/server'
import { fetchStadiumWiki } from '@/lib/stadium-wikipedia'

// Stadium photos/summaries barely ever change — this lets client
// components get real server-side caching (the `next.revalidate` option on
// fetchStadiumWiki's own fetch has no effect when called directly from a
// 'use client' component, since that runs the browser's native fetch, not
// Next's patched one) instead of re-hitting Wikipedia on every page load.
export const revalidate = 604800

export async function GET(req: NextRequest) {
  const abbr = req.nextUrl.searchParams.get('abbr')
  const abbrs = req.nextUrl.searchParams.get('abbrs')

  if (abbrs) {
    const list = abbrs.split(',').map(a => a.trim()).filter(Boolean)
    const results = await Promise.all(list.map(async a => [a, (await fetchStadiumWiki(a)).photo] as const))
    return NextResponse.json(Object.fromEntries(results))
  }

  if (!abbr) return NextResponse.json({ summary: null, photo: null })
  const data = await fetchStadiumWiki(abbr)
  return NextResponse.json(data)
}
