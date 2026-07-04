'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

const COLLECTIBLE_CATEGORIES = [
  { value: 'giveaway',    label: 'Giveaway',    emoji: '🎁' },
  { value: 'souvenir',    label: 'Souvenir',    emoji: '🛍️' },
  { value: 'memorabilia', label: 'Memorabilia', emoji: '✍️' },
] as const

const FOOD_TYPES = [
  { value: 'hot_dog',   label: 'Hot Dog',   emoji: '🌭' },
  { value: 'specialty', label: 'Specialty', emoji: '🍔' },
  { value: 'dessert',   label: 'Dessert',   emoji: '🍦' },
  { value: 'drink',     label: 'Drink',     emoji: '🥤' },
  { value: 'other',     label: 'Other',     emoji: '🍽️' },
] as const

export type EditorItemType = 'collectible' | 'food'

export interface EditorItem {
  id: string
  itemType: EditorItemType
  name: string
  category: string
  photoUrl: string | null
  rating?: number | null
  price?: number | null
  signedBy?: string | null
  acquiredFrom?: string | null
  stadiumVisitId?: string | null
  baseballLifeEntryId?: string | null
}

interface Props {
  item: EditorItem
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

/**
 * Shared edit/delete/photo-upload lightbox for:
 * - collectible items (giveaways, souvenirs, memorabilia) — collectible_log table
 * - food/drink items — food_log table
 * Also used with item.id === 'new' to create a fresh row (isNew = true).
 */
export default function GiveawayFoodEditor({ item, onClose, onSaved, onDeleted }: Props) {
  const isNew = item.id === 'new'
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [rating, setRating] = useState<number | null>(item.rating ?? null)
  const [price, setPrice] = useState<string>(item.price != null ? String(item.price) : '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl)
  const [signedBy, setSignedBy] = useState<string>(item.signedBy ?? '')
  const [acquiredFrom, setAcquiredFrom] = useState<string>(item.acquiredFrom ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const typeOptions = item.itemType === 'food' ? FOOD_TYPES : COLLECTIBLE_CATEGORIES
  const isMemorabilia = item.itemType === 'collectible' && category === 'memorabilia'
  const tempId = `temp-${Date.now()}`

  async function uploadPhoto(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${isNew ? tempId : item.id}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('achievement-photos').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('achievement-photos').getPublicUrl(data.path)
      setPhotoUrl(urlData.publicUrl)
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (item.itemType === 'food') {
      const payload = {
        name: name.trim(),
        category,
        rating,
        price: price.trim() ? Number(price) : null,
        photo_url: photoUrl,
      }
      if (isNew) {
        await supabase.from('food_log').insert({
          ...payload,
          user_id: userId,
          stadium_visit_id: item.stadiumVisitId ?? null,
          baseball_life_entry_id: item.baseballLifeEntryId ?? null,
        })
      } else {
        await supabase.from('food_log').update(payload).eq('id', item.id)
      }
    } else {
      const payload = {
        name: name.trim(),
        category,
        photo_url: photoUrl,
        signed_by: isMemorabilia && signedBy.trim() ? signedBy.trim() : null,
        acquired_from: isMemorabilia && acquiredFrom.trim() ? acquiredFrom.trim() : null,
      }
      if (isNew) {
        await supabase.from('collectible_log').insert({
          ...payload,
          user_id: userId,
          stadium_visit_id: item.stadiumVisitId ?? null,
          baseball_life_entry_id: item.baseballLifeEntryId ?? null,
        })
      } else {
        await supabase.from('collectible_log').update(payload).eq('id', item.id)
      }
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (isNew) { onClose(); return }
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const supabase = createClient()
    const table = item.itemType === 'food' ? 'food_log' : 'collectible_log'
    await supabase.from(table).delete().eq('id', item.id)
    setDeleting(false)
    onDeleted()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 400, backgroundColor: '#161B22', borderRadius: 16, border: '1px solid #30363D', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#E6EDF3' }}>
            {isNew ? 'Add ' : 'Edit '}{item.itemType === 'food' ? 'Food & Drink' : 'Collectible'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8B949E', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14, textAlign: 'center' }}>
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photoUrl} alt={name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
          ) : (
            <div style={{ width: '100%', height: 120, borderRadius: 10, backgroundColor: '#0D1117', border: '1px dashed #30363D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 8 }}>
              {item.itemType === 'food' ? '🍽️' : '🎁'}
            </div>
          )}
          <label style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: '#58A6FF', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.5 : 1 }}>
            {uploading ? 'Uploading…' : photoUrl ? 'Replace Photo' : 'Add Photo'}
            <input
              type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Name</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Category</div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 14, cursor: 'pointer' }}
          >
            {typeOptions.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>
        </div>

        {isMemorabilia && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Signed By (optional)</div>
              <input
                value={signedBy}
                onChange={e => setSignedBy(e.target.value)}
                placeholder="e.g. Cal Raleigh"
                style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Acquired From (optional)</div>
              <input
                value={acquiredFrom}
                onChange={e => setAcquiredFrom(e.target.value)}
                placeholder="e.g. Team store, in-person"
                style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </>
        )}

        {item.itemType === 'food' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Rating</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0, opacity: rating != null && n <= rating ? 1 : 0.25 }}
                  >⭐</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Price ($, optional)</div>
              <input
                type="number" step="0.01" value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{ flex: 1, padding: '10px', borderRadius: 8, backgroundColor: '#1F6FEB', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : isNew ? 'Add Item' : 'Save Changes'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '10px 16px', borderRadius: 8,
              backgroundColor: confirmDelete ? '#F85149' : 'transparent',
              border: `1px solid ${confirmDelete ? '#F85149' : '#F8514966'}`,
              color: confirmDelete ? '#fff' : '#F85149',
              fontSize: 14, fontWeight: 700, cursor: deleting ? 'default' : 'pointer',
            }}
          >
            {isNew ? 'Cancel' : deleting ? '…' : confirmDelete ? 'Confirm?' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
