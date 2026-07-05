'use client'

import { useEffect, useState } from 'react'
import TeamLogo from './TeamLogo'

export interface RingDot {
  abbr: string | null  // null = not yet visited
  visited: boolean
  visitDate?: string   // ISO date for tooltip
}

interface Props {
  visited: number
  total: number
  dots: RingDot[]
  gradient?: [string, string]   // tier-driven ring color, defaults to blue-green
  glow?: string                 // tier-driven glow color for the tip + fill
}

export default function HeroRing({ visited, total, dots, gradient, glow }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const [gradFrom, gradTo] = gradient ?? ['#1F6FEB', '#3FB950']
  const glowColor = glow ?? 'rgba(63,185,80,0.8)'

  const size    = 200
  const sw      = 12
  const r       = (size - sw * 2) / 2   // 88
  const circ    = 2 * Math.PI * r
  const pct     = total > 0 ? visited / total : 0
  const offset  = circ - Math.max(pct, visited > 0 ? 0.025 : 0) * circ
  const dotPx   = 22
  const dotHalf = dotPx / 2

  // Arc tip position in SVG-local coords (before the -90deg CSS rotation)
  // Arc starts at 0-rad (rightmost point) and goes clockwise
  const effectivePct = visited > 0 ? Math.max(pct, 0.025) : pct
  const tipAngle = effectivePct * 2 * Math.PI
  const tipX = size / 2 + r * Math.cos(tipAngle)
  const tipY = size / 2 + r * Math.sin(tipAngle)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Progress ring SVG */}
      <svg
        width={size} height={size}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
      >
        <defs>
          {/* Tier-driven gradient following the arc bounding box */}
          <linearGradient id="arcGrad" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={gradFrom} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
          {/* Glow filter for arc tip */}
          <filter id="tipGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#1C2430" strokeWidth={sw} />

        {/* Fill arc — gradient stroke */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#arcGrad)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)',
            filter: `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 16px ${glowColor})`,
          }}
        />

        {/* Glow circle at arc tip */}
        {mounted && visited > 0 && (
          <circle
            cx={tipX} cy={tipY}
            r={sw / 2 + 2}
            fill={gradTo}
            filter="url(#tipGlow)"
            style={{ opacity: 0.9 }}
          />
        )}
      </svg>

      {/* Stadium slots — ghost outline for unvisited, filled logo for visited */}
      {dots.map(({ abbr, visited: v, visitDate }, i) => {
        const angle = (i / dots.length) * 2 * Math.PI - Math.PI / 2
        const x = size / 2 + r * Math.cos(angle) - dotHalf
        const y = size / 2 + r * Math.sin(angle) - dotHalf

        if (!v || !abbr) {
          // Unvisited slot — faint ghost outline so the ring reads as
          // "30 slots to fill" even early on, instead of empty track.
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: x, top: y,
                width: dotPx, height: dotPx,
                borderRadius: '50%',
                border: '1.5px dashed rgba(139,148,158,0.28)',
                background: 'rgba(255,255,255,0.02)',
                zIndex: 1,
              }}
            />
          )
        }

        const tooltipText = visitDate
          ? `${abbr} · ${new Date(visitDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          : abbr
        return (
          <div
            key={i}
            title={tooltipText}
            style={{
              position: 'absolute', left: x, top: y,
              width: dotPx, height: dotPx,
              borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              border: `2px solid ${gradTo}`,
              boxShadow: `0 0 8px ${glowColor}`,
              zIndex: 2, cursor: 'help',
            }}
          >
            <TeamLogo abbreviation={abbr} size={dotPx} style={{ borderRadius: '50%', width: dotPx, height: dotPx }} />
          </div>
        )
      })}

      {/* Center stats */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0, pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 64, fontWeight: 900, color: '#E6EDF3',
          lineHeight: 1, letterSpacing: '-3px',
        }}>
          {visited}
        </span>
        <span style={{ fontSize: 20, color: '#8B949E', fontWeight: 600, lineHeight: 1, marginTop: 2 }}>
          / {total}
        </span>
      </div>
    </div>
  )
}
