'use client'

import dynamic from 'next/dynamic'
import type { StadiumWithVisit } from '@/types'

const StadiumMapInner = dynamic(() => import('./StadiumMapInner'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100%', width: '100%',
      backgroundColor: '#0B1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: '#8B949E', fontWeight: 500, fontSize: 14 }}>Loading map…</div>
    </div>
  ),
})

export default function StadiumMap({ stadiums }: { stadiums: StadiumWithVisit[] }) {
  return <StadiumMapInner stadiums={stadiums} />
}
