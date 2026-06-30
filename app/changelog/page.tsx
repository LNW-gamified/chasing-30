import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface ChangelogEntry {
  date: string
  title: string
  items: string[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'June 2026',
    title: 'Tickets, Reordering & International Baseball',
    items: [
      'Added "I have tickets" flagging for upcoming minor league games',
      'Added drag-free reordering (up/down arrows) for trip stops',
      'Added Babe Ruth Museum, Rickwood Field, and Jackie Robinson Museum as pilgrimage destinations',
      'Added London Series, Mexico Series, and Puerto Rico Series as MLB special events',
      'Added Opening Day, Two-Park Day, Hat Trick, and Rain Delay Survivor milestones',
      'Consolidated Baseball Life achievements into the main milestone system',
      'Unified rank and XP calculation across the entire app via lib/ranks.ts',
    ],
  },
  {
    date: 'June 2026',
    title: 'Visual Polish & Photo Galleries',
    items: [
      'Switched stadium map to light mode with dimmed tiles for better marker contrast',
      'Added multi-photo upload (up to 5 photos) for MLB game entries with private storage',
      'Added giveaway collection with category editing and lightbox photo viewer',
      'Redesigned the Records page hero, tabs, and Best Games section',
      'Fixed font sizing and color contrast issues across the app',
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div style={{ color: '#E6EDF3', minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px' }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#8B949E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Home
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>What&apos;s New</h1>
        <p style={{ fontSize: 13, color: '#8B949E', marginBottom: 32 }}>A running log of updates to Chasing 30.</p>

        {CHANGELOG.map((entry, i) => (
          <div key={i} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: i < CHANGELOG.length - 1 ? '1px solid #21262D' : 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{entry.date}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{entry.title}</div>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {entry.items.map((item, j) => (
                <li key={j} style={{ fontSize: 13, color: '#8B949E', marginBottom: 6, lineHeight: 1.5 }}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
