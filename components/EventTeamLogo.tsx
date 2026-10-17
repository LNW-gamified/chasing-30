'use client'

import { useState } from 'react'

// Logos for non-MLB teams (Banana Ball, etc.) are plain files in
// public/banana-ball/, named after the team in lowercase with hyphens:
//   "Savannah Bananas" -> public/banana-ball/savannah-bananas.png
// png, svg and webp are tried in that order. No file means a colored
// initials badge, so a missing logo never breaks a card.

export function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const EXTENSIONS = ['png', 'svg', 'webp', 'jpg', 'jpeg']

function badgeColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h}, 45%, 32%)`
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase()
}

interface Props {
  name: string
  size?: number
  folder?: string
}

// Use key={name} where the name can change, so the extension attempt resets.
export default function EventTeamLogo({ name, size = 36, folder = 'banana-ball' }: Props) {
  const [attempt, setAttempt] = useState(0)
  const slug = teamSlug(name)
  const box: React.CSSProperties = {
    width: size, height: size, flexShrink: 0, borderRadius: 10, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (!slug || attempt >= EXTENSIONS.length) {
    return (
      <div style={{ ...box, background: badgeColor(name), border: '1px solid rgba(255,255,255,0.12)' }} aria-label={name}>
        <span style={{ fontSize: size * 0.38, fontWeight: 800, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>
          {initials(name)}
        </span>
      </div>
    )
  }

  return (
    <div style={{ ...box, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${folder}/${slug}.${EXTENSIONS[attempt]}`}
        alt={name}
        width={Math.round(size * 0.84)}
        height={Math.round(size * 0.84)}
        onError={() => setAttempt(a => a + 1)}
        style={{ objectFit: 'contain', display: 'block' }}
      />
    </div>
  )
}
