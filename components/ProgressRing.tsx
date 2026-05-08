'use client'

interface ProgressRingProps {
  visited: number
  total: number
  size?: number
}

export default function ProgressRing({ visited, total, size = 160 }: ProgressRingProps) {
  const radius = (size - 24) / 2
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? visited / total : 0
  const minArc = visited > 0 ? 0.04 : 0
  const offset = circumference - Math.max(pct, minArc) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={14}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>
          {visited}
        </span>
        <span className="text-sm" style={{ color: '#a8b8c8' }}>
          / {total}
        </span>
      </div>
    </div>
  )
}
