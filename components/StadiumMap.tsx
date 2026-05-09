'use client'

import dynamic from 'next/dynamic'
import type { StadiumWithVisit } from '@/types'

const StadiumMapInner = dynamic(() => import('./StadiumMapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{ height: '100%', backgroundColor: '#0f1729', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ color: '#64748b', fontWeight: 500 }}>Loading map...</div>
    </div>
  ),
})

export default function StadiumMap({ stadiums }: { stadiums: StadiumWithVisit[] }) {
  return <StadiumMapInner stadiums={stadiums} />
}
