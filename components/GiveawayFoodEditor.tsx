'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const COLLECTIBLE_CATEGORIES = [
  { value: 'giveaway',    label: 'Giveaway',    emoji: '🎁' },
  { value: 'souvenir',    label: 'Souvenir',    emoji: '🛍️' },
  { value: 'memorabilia', label: 'Memorabilia', emoji: '✍️' },
  { value: 'food',        label: 'Food & Drink',emoji: '🍔' },
] as const

const GIVEAWAY_SUBTYPES = [
  { value: 'bobblehead', label: 'Bobblehead', emoji: '🪆' },
  { value: 'jersey',     label: 'Jersey',     emoji: '👕' },
  { value: 'tshirt',     label: 'T-Shirt',    emoji: '👔' },
  { value: 'hat',        label: 'Hat',        emoji: '🧢' },
  { value: 'other',      label: 'Other',      emoji: '🎁' },
] as const

export interface EditorItem {
  id: string
  name: string
  category: string
  giveawayType?: string | null
  photoUrl: string | null
  rating?: number | null
  price?: number | null
  signedBy?: string | null
  acquiredFrom?: string | null
  stadiumVisitId?: string | null
  baseballLifeEntryId?: string | null
  scopedStadiumId?: string | null
  scopedMinorLeagueStadiumId?: string | null
}

interface Props {
  item: EditorItem
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

interface MlbGameOption { id: string; visit_date: string; home_team: string | null; visiting_team: string | null }
interface MilbGameOption { id: string; visit_date: string; opponent: string | null }

/**
 * Shared edit/delete/photo-upload lightbox for everything in collectible_log —
 * giveaways, souvenirs, memorabilia, and food/drink. Food is just another
 * category value here now, not a separate table or item type. One table,
 * one editor, one add button, regardless of where it's opened from.
 */
export default function GiveawayFoodEditor({ item, onClose, onSaved, onDeleted }: Props) {
  const isNew = item.id === 'new'
  const needsGamePicker = isNew && !item.stadiumVisitId && !item.baseballLifeEntryId

  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [giveawayType, setGiveawayType] = useState<string>(item.giveawayType ?? 'other')
  const [rating, setRating] = useState<number | null>(item.rating ?? null)
  const [price, setPrice] = useState<string>(item.price != null ? String(item.price) : '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl)
  const [signedBy, setSignedBy] = useState<string>(item.signedBy ?? '')
  const [acquiredFrom, setAcquiredFrom] = useState<string>(item.acquiredFrom ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [selectedStadiumVisitId, setSelectedStadiumVisitId] = useState<string>(item.stadiumVisitId ?? '')
  const [selectedBleId, setSelectedBleId] = useState<string>(item.baseballLifeEntryId ?? '')
  const [mlbGames, setMlbGames] = useState<MlbGameOption[]>([])
  const [milbGames, setMilbGames] = useState<MilbGameOption[]>([])
  const [loadingGames, setLoadingGames] = useState(false)

  const isMemorabilia = category === 'memorabilia'
  const isGiveaway = category === 'giveaway'
  const isFood = category === 'food'
  const tempId = `temp-${Date.now()}`

  useEffect(() => {
    if (!needsGamePicker) return
    setLoadingGames(true)
    const supabase = createClient()

    const mlbQuery = supabase
      .from('stadium_visits')
      .select('id, visit_date, home_team, visiting_team')
      .order('visit_date', { ascending: false })
    const scopedMlbQuery = item.scopedStadiumId
      ? mlbQuery.eq('stadium_id', item.scopedStadiumId)
      : mlbQuery

    const milbQuery = supabase
      .from('baseball_life_entries')
      .select('id, visit_date, opponent')
      .eq('category', 'minor_league')
      .order('visit_date', { ascending: false })
    const scopedMilbQuery = item.scopedMinorLeagueStadiumId
      ? milbQuery.eq('minor_league_stadium_id', item.scopedMinorLeagueStadiumId)
      : milbQuery

    Promise.all([scopedMlbQuery, scopedMilbQuery]).then(([mlbRes, milbRes]) => {
      if (mlbRes.data) setMlbGames(mlbRes.data as MlbGameOption[])
      if (milbRes.data) setMilbGames(milbRes.data as MilbGameOption[])
      setLoadingGames(false)
    })
  }, [needsGamePicker, item.scopedStadiumId, item.scopedMinorLeagueStadiumId])

  function pickMlbGame(id: string) {
    setSelectedStadiumVisitId(id)
    if (id) setSelectedBleId('')
  }

  function pickMilbGame(id: string) {
    setSelectedBleId(id)
    if (id) setSelectedStadiumVisitId('')
  }

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
    if (needsGamePicker && !selectedStadiumVisitId && !selectedBleId) return
    setSaving(true)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const finalStadiumVisitId = needsGamePicker ? (selectedStadiumVisitId || null) : (item.stadiumVisitId ?? null)
    const finalBleId = needsGamePicker ? (selectedBleId || null) : (item.baseballLifeEntryId ?? null)

    const payload = {
      name: name.trim(),
      category,
      giveaway_type: isGiveaway ? giveawayType : null,
      rating: isFood ? rating : null,
      price: isFood && price.trim() ? Number(price) : null,
      photo_url: photoUrl,
      signed_by: isMemorabilia && signedBy.trim() ? signedBy.trim() : null,
      acquired_from: isMemorabilia && acquiredFrom.trim() ? acquiredFrom.trim() : null,
    }

    if (isNew) {
      await supabase.from('collectible_log').insert({
        ...payload,
        user_id: userId,
        stadium_visit_id: finalStadiumVisitId,
        baseball_life_entry_id: finalBleId,
      })
    } else {
      await supabase.from('collectible_log').update(payload).eq('id', item.id)
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (isNew) { onClose(); return }
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('collectible_log').delete().eq('id', item.id)
    setDeleting(false)
    onDeleted()
  }

  const canSave = name.trim() && (!needsGamePicker || selectedStadiumVisitId || selectedBleId)

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
            {isNew ? 'Add Item' : 'Edit Item'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8B949E', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {needsGamePicker && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, backgroundColor: '#0D1117', border: '1px solid #30363D' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Which game?
            </div>
            {loadingGames ? (
              <div style={{ fontSize: 13, color: '#8B949E' }}>Loading games…</div>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 4 }}>MLB Game</div>
                  <select
                    value={selectedStadiumVisitId}
                    onChange={e => pickMlbGame(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 13, cursor: 'pointer' }}
                  >
                    <option value="">— Select an MLB game —</option>
                    {mlbGames.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.visit_date} · {g.home_team ?? '?'} vs {g.visiting_team ?? '?'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 4 }}>MiLB Game</div>
                  <select
                    value={selectedBleId}
                    onChange={e => pickMilbGame(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 13, cursor: 'pointer' }}
                  >
                    <option value="">— Select a MiLB game —</option>
                    {milbGames.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.visit_date} · vs {g.opponent ?? '?'}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginBottom: 14, textAlign: 'center' }}>
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photoUrl} alt={name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
          ) : (
            <div style={{ width: '100%', height: 120, borderRadius: 10, backgroundColor: '#0D1117', border: '1px dashed #30363D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 8 }}>
              {isFood ? '🍽️' : '🎁'}
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
            {COLLECTIBLE_CATEGORIES.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>
        </div>

        {isGiveaway && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Giveaway Type</div>
            <select
              value={giveawayType}
              onChange={e => setGiveawayType(e.target.value)}
              style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 14, cursor: 'pointer' }}
            >
              {GIVEAWAY_SUBTYPES.map(t => (
                <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
              ))}
            </select>
          </div>
        )}

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

        {isFood && (
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
            disabled={saving || !canSave}
            style={{ flex: 1, padding: '10px', borderRadius: 8, backgroundColor: '#1F6FEB', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving || !canSave ? 0.6 : 1 }}
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
