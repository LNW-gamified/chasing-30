'use client'

import { useEffect, useState } from 'react'
import TeamLogo from './TeamLogo'

export interface RingDot {
  abbr: string
  visited: boolean
}

interface Props {
  visited: number
  total: number
  dots: RingDot[]
}

export default function HeroRing({ visited, total, dots }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const size = 200
  const sw   = 12
  const r    = (size - sw * 2) / 2   // 88
  const circ = 2 * Math.PI * r
  const pct  = total > 0 ? visited / total : 0
  const offset = circ - Math.max(pct, visited > 0 ? 0.02 : 0) * circ
  const dotPx  = 18
  const dotHalf = dotPx / 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Progress ring SVG */}
      <svg
        width={size} height={size}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1C2430" strokeWidth={sw} />
        {/* Fill arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#3FB950" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)',
            filter: 'drop-shadow(0 0 10px rgba(63,185,80,0.45))',
          }}
        />
      </svg>

      {/* Team logo / indicator dots around ring perimeter */}
      {dots.map(({ abbr, visited: v }, i) => {
        const angle = (i / dots.length) * 2 * Math.PI - Math.PI / 2
        const x = size / 2 + r * Math.cos(angle) - dotHalf
        const y = size / 2 + r * Math.sin(angle) - dotHalf
        return (
          <div
            key={abbr}
            title={abbr}
            style={{
              position: 'absolute',
              left: x, top: y,
              width: dotPx, height: dotPx,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              background: v ? undefined : '#0D1117',
              border: `1.5px solid ${v ? '#3FB950' : '#21262D'}`,
              boxShadow: v ? '0 0 7px rgba(63,185,80,0.6)' : 'none',
              zIndex: v ? 2 : 1,
            }}
          >
            {v && (
              <TeamLogo
                abbreviation={abbr}
                size={dotPx}
                style={{ borderRadius: '50%', width: dotPx, height: dotPx }}
              />
            )}
          </div>
        )
      })}

      {/* Center: huge number */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 68, fontWeight: 900, color: '#E6EDF3',
          lineHeight: 1, letterSpacing: '-3px',
        }}>
          {visited}
        </span>
        <span style={{ fontSize: 17, color: '#8B949E', fontWeight: 600, lineHeight: 1, marginTop: 3 }}>
          / {total}
        </span>
      </div>
    </div>
  )
}
