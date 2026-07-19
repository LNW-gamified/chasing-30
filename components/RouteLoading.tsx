import { Loader2 } from 'lucide-react'

export default function RouteLoading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, minHeight: '60vh', color: '#8B949E',
    }}>
      <Loader2 size={26} className="animate-spin" color="#1F6FEB" />
      <span style={{ fontSize: 13, fontWeight: 600 }}>Loading…</span>
    </div>
  )
}
