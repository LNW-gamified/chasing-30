'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

// Giveaway item types
const GIVEAWAY_TYPES = [
  { value: 'bobblehead', label: 'Bobblehead', emoji: '🪆' },
  { value: 'figurine',   label: 'Figurine',   emoji: '🏺' },
  { value: 'jersey',     label: 'Jersey',     emoji: '👕' },
  { value: 'tshirt',     label: 'T-Shirt',    emoji: '👔' },
  { value: 'hat',        label: 'Hat',        emoji: '🎩' },
  { value: 'poster',     label: 'Poster',     emoji: '📋' },
  { value: 'other',      label: 'Other',      emoji: '🎁' },
] as const

const FOOD_TYPES = [
  { value: 'hot_dog',  label: 'Hot Dog',  emoji: '🌭' },
  { value: 'specialty',label: 'Specialty',emoji: '🍔' },
  { value: 'dessert',  label: 'Dessert',  emoji: '🍦' },
  { value: 'drink',    label: 'Drink',    emoji: '🥤' },
  { value: 'other',    label: 'Other',    emoji: '🍽️' },
] as const

export type EditorItemType = 'giveaway' | 'food' | 'milb_giveaway'

export interface EditorItem {
  id: string
  itemType: EditorItemType
  name: string
  category: string
  photoUrl: string | null
  rating?: number | null   // food only
  price?: number | null    // food only
  itemIndex?: number       // milb_giveaway only — index within giveaway_items array; id is the parent baseball_life_entries row id
}

interface Props {
  item: EditorItem
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

/**
 * Shared edit/delete/photo-upload lightbox for both giveaway items
 * (achievement_claims table) and food/drink items (food_log table).
 *
 * NOTE ON SCHEMA: these tables/shapes do not share a common structure.
 * - food_log has real columns: name, category, rating, price, photo_url
 * - achievement_claims (MLB giveaways) stores most detail in extra_data (jsonb):
 *     extra_data.bobblehead_name -> name
 *     extra_data.photo_url       -> photo
 *     giveaway_type (real column) -> category
 * - MiLB giveaways aren't rows at all — they're objects inside the
 *   giveaway_items jsonb array column on baseball_life_entries. item.id is
 *   the parent entry's id and item.itemIndex is the array position; saving
 *   means read-modify-write the whole array. No category field exists here.
 * This component normalizes all three into the same form and writes back
 * to the correct table/shape on save.
 */
export default function GiveawayFoodEditor({ item, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [rating, setRating] = useState<number | null>(item.rating ?? null)
  const [price, setPrice] = useState<string>(item.price != null ? String(item.price) : '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const typeOptions = item.itemType === 'food' ? FOOD_TYPES : GIVEAWAY_TYPES

  async function uploadPhoto(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${item.id}-${Date.now()}.${ext}`
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

    if (item.itemType === 'food') {
      await supabase.from('food_log').update({
        name: name.trim(),
        category,
        rating,
        price: price.trim() ? Number(price) : null,
        photo_url: photoUrl,
      }).eq('id', item.id)
    } else if (item.itemType === 'milb_giveaway') {
      const { data: entry } = await supabase.from('baseball_life_entries').select('giveaway_items').eq('id', item.id).single()
      const items = Array.isArray(entry?.giveaway_items) ? [...entry.giveaway_items] : []
      if (item.itemIndex != null && items[item.itemIndex]) {
        items[item.itemIndex] = { ...items[item.itemIndex], name: name.trim(), photo_url: photoUrl }
      }
      await supabase.from('baseball_life_entries').update({ giveaway_items: items }).eq('id', item.id)
    } else {
      const { data: existing } = await supabase.from('achievement_claims').select('extra_data').eq('id', item.id).single()
      await supabase.from('achievement_claims').update({
        giveaway_type: category,
        extra_data: {
          ...(existing?.extra_data ?? {}),
          bobblehead_name: name.trim(),
          photo_url: photoUrl,
        },
      }).eq('id', item.id)
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const supabase = createClient()
    if (item.itemType === 'milb_giveaway') {
      const { data: entry } = await supabase.from('baseball_life_entries').select('giveaway_items').eq('id', item.id).single()
      const items = Array.isArray(entry?.giveaway_items) ? [...entry.giveaway_items] : []
      if (item.itemIndex != null) items.splice(item.itemIndex, 1)
      await supabase.from('baseball_life_entries').update({ giveaway_items: items }).eq('id', item.id)
    } else {
      const table = item.itemType === 'food' ? 'food_log' : 'achievement_claims'
      await supabase.from(table).delete().eq('id', item.id)
    }
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
            {item.itemType === 'food' ? 'Edit Food & Drink' : 'Edit Giveaway'}
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

        {item.itemType !== 'milb_giveaway' && (
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
            {saving ? 'Saving…' : 'Save Changes'}
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
            {deleting ? '…' : confirmDelete ? 'Confirm?' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
