'use client'

interface ProgressRingProps {
  visited: number
  total: number
  size?: number
}

export default function ProgressRing({ visited, total, size = 160 }: ProgressRingProps) {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? visited / total : 0
  const offset = circumference - pct * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>
          {visited}
        </span>
        <span className="text-sm" style={{ color: '#64748b' }}>
          / {total}
        </span>
      </div>
    </div>
  )
}
