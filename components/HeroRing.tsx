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
  gradient?: [string, string]   // tier-driven frame color, defaults to blue-green
  glow?: string                 // tier-driven glow color
}

// Row layout tapering from the wide "back" of the plate down to a single
// point, matching real home-plate proportions (flat top, two straight
// sides, two angled sides meeting at the tip). Sums to 30.
const ROWS = [7, 7, 7, 5, 3, 1]

export default function HeroRing({ visited, total, dots, gradient, glow }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const [gradFrom, gradTo] = gradient ?? ['#1F6FEB', '#3FB950']
  const glowColor = glow ?? 'rgba(63,185,80,0.8)'

  const dotPx = 26
  const gap   = 7
  const step  = dotPx + gap

  const maxRowCount = Math.max(...ROWS)
  const width  = maxRowCount * dotPx + (maxRowCount - 1) * gap + 28   // + side padding
  const height = ROWS.length * step - gap + 28                        // + top/bottom padding

  // Precompute each dot's (x, y), row-major, centered per row
  const positions: { x: number; y: number }[] = []
  ROWS.forEach((count, rowIdx) => {
    const rowWidth = count * dotPx + (count - 1) * gap
    const startX   = (width - rowWidth) / 2
    const y        = 14 + rowIdx * step
    for (let i = 0; i < count; i++) {
      positions.push({ x: startX + i * step, y })
    }
  })

  // Home-plate pentagon: flat top edge, straight sides down through the
  // first three (full-width) rows, then angled sides converging to a
  // point below the last row.
  const cornerY = 14 + 3 * step - gap / 2
  const apexY   = height - 4
  const plateD  = `M 2,2 L ${width - 2},2 L ${width - 2},${cornerY} L ${width / 2},${apexY} L 2,${cornerY} Z`

  const pct = total > 0 ? visited / total : 0
  const effectivePct = visited > 0 ? Math.max(pct, 0.03) : 0

  return (
    <div style={{ position: 'relative', width, flexShrink: 0 }}>
      {/* Home-plate frame */}
      <svg
        width={width} height={height}
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <linearGradient id="plateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={gradFrom} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
        </defs>

        {/* Track — full outline, dim */}
        <path d={plateD} fill="none" stroke="#1C2430" strokeWidth={3} strokeLinejoin="round" />

        {/* Progress trace — gradient portion of the outline, proportional
            to visited/total. pathLength="1" lets the dash math work in a
            normalized 0–1 range regardless of the path's real length. */}
        <path
          d={plateD} pathLength={1}
          fill="none" stroke="url(#plateGrad)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round"
          strokeDasharray={1}
          strokeDashoffset={mounted ? 1 - effectivePct : 1}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)',
            filter: `drop-shadow(0 0 5px ${glowColor})`,
          }}
        />
      </svg>

      {/* Stadium slots — ghost outline for unvisited, filled logo for visited */}
      {dots.map(({ abbr, visited: v, visitDate }, i) => {
        const pos = positions[i]
        if (!pos) return null

        if (!v || !abbr) {
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: pos.x, top: pos.y,
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
              position: 'absolute', left: pos.x, top: pos.y,
              width: dotPx, height: dotPx,
              borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${gradTo}`,
              boxShadow: `0 0 8px ${glowColor}`,
              zIndex: 2, cursor: 'help',
            }}
          >
            <TeamLogo abbreviation={abbr} size={dotPx} style={{ border: 'none' }} />
          </div>
        )
      })}

      {/* Count — sits below the plate shape now, since a pentagon has no
          natural hollow center the way a ring does */}
      <div style={{
        position: 'relative', marginTop: height, paddingTop: 6,
        display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 44, fontWeight: 900, color: '#E6EDF3', lineHeight: 1, letterSpacing: '-2px' }}>
          {visited}
        </span>
        <span style={{ fontSize: 16, color: '#8B949E', fontWeight: 600, lineHeight: 1 }}>
          / {total}
        </span>
      </div>
    </div>
  )
}
