'use client'

import type { EditorItem } from '@/components/GiveawayFoodEditor'

interface Props {
  item: EditorItem
  onClose: () => void
  onEdit: () => void
}

/**
 * Full-photo lightbox shown when tapping a My Collection card. Matches the
 * plain photo-lightbox style already used elsewhere in the app, plus an
 * Edit button that hands off to GiveawayFoodEditor for the actual form.
 */
export default function CollectibleLightbox({ item, onClose, onEdit }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photoUrl}
          alt={item.name}
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 12, objectFit: 'contain', marginBottom: 16 }}
        />
      ) : (
        <div
          onClick={e => e.stopPropagation()}
          style={{ width: 160, height: 160, borderRadius: 16, backgroundColor: '#161B22', border: '1px solid #30363D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, marginBottom: 16 }}
        >
          {item.category === 'memorabilia' ? '✍️' : item.category === 'souvenir' ? '🛍️' : item.category === 'food' ? '🍽️' : '🎁'}
        </div>
      )}

      <div onClick={e => e.stopPropagation()} style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#E6EDF3', marginBottom: 4 }}>{item.name}</div>
        <div style={{ fontSize: 13, color: '#F5A623', fontWeight: 600, textTransform: 'capitalize' }}>{item.category}</div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onEdit() }}
        style={{
          padding: '10px 24px', borderRadius: 10, border: 'none',
          backgroundColor: '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Edit
      </button>

      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
          width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>
    </div>
  )
}
