'use client'

import { useState } from 'react'
import SpecialVisitForm from '@/components/SpecialVisitForm'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export default function SpecialVisitButton({ label = 'Log Special Visit', variant = 'primary' }: { label?: string; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const style: React.CSSProperties = variant === 'primary' ? {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 12,
    background: 'rgba(31,111,235,0.12)', border: '1px solid rgba(31,111,235,0.3)',
    color: '#58A6FF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  } : {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 10, border: '1px solid #30363D',
    background: '#161B22', color: '#8B949E', fontWeight: 600, fontSize: 12, cursor: 'pointer',
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={style as React.CSSProperties}>
        <Plus size={14} />
        {label}
      </button>
      {open && (
        <SpecialVisitForm
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
