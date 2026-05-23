'use client'

interface ProgressRingProps {
  visited: number
  total: number
  size?: number
}

export default function ProgressRing({ visited, total, size = 220 }: ProgressRingProps) {
  const strokeWidth = 26
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? visited / total : 0
  const minArc = visited > 0 ? 0.04 : 0
  const offset = circumference - Math.max(pct, minArc) * circumference
  const gradId = `ring-grad-${size}`

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1F6FEB" />
            <stop offset="60%" stopColor="#3FB950" />
            <stop offset="100%" stopColor="#58D68D" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)',
            filter: 'drop-shadow(0 0 10px rgba(31,111,235,0.5))',
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span
          style={{
            fontSize: size >= 200 ? '2.25rem' : '1.75rem',
            fontWeight: 900,
            color: '#E6EDF3',
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}
        >
          {visited}
        </span>
        <span
          style={{
            fontSize: size >= 200 ? '1.1rem' : '0.85rem',
            color: '#8B949E',
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          / {total} parks
        </span>
      </div>
    </div>
  )
}
