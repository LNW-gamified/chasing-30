'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { StopChecklistItem } from '@/types'

const CATEGORIES = [
  { id: 'food_drinks', icon: '🍺', label: 'Food & Drinks'       },
  { id: 'souvenirs',   icon: '🛍️', label: 'Souvenirs'            },
  { id: 'moments',     icon: '📸', label: 'Moments to Capture'  },
  { id: 'must_do',     icon: '✅', label: 'Must Do'              },
] as const

type CategoryId = typeof CATEGORIES[number]['id']

interface Props {
  stopId: string
  items: StopChecklistItem[]
  onReload: () => void
}

export default function StopChecklist({ stopId, items, onReload }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding]     = useState<CategoryId | null>(null)
  const [addText, setAddText]   = useState('')
  const [saving, setSaving]     = useState(false)

  const totalItems   = items.length
  const checkedCount = items.filter(i => i.checked).length

  async function addItem(category: CategoryId) {
    const trimmed = addText.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('stop_checklist').insert({ stop_id: stopId, category, item: trimmed })
    setAddText('')
    setAdding(null)
    setSaving(false)
    onReload()
  }

  async function toggleItem(id: string, checked: boolean) {
    const supabase = createClient()
    await supabase.from('stop_checklist').update({ checked }).eq('id', id)
    onReload()
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    await supabase.from('stop_checklist').delete().eq('id', id)
    onReload()
  }

  return (
    <div style={{ borderTop: '1px solid #30363D' }}>
      {/* Collapse toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8B949E' }}>Don't Forget</span>
          {totalItems > 0 ? (
            <span style={{
              fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 600,
              backgroundColor: checkedCount === totalItems
                ? 'rgba(63,185,80,0.12)' : 'rgba(139,148,158,0.1)',
              color: checkedCount === totalItems ? '#3FB950' : '#8B949E',
            }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''} · {checkedCount} checked
            </span>
          ) : (
            <span style={{ fontSize: 11, color: '#484F58' }}>Add items</span>
          )}
        </div>
        {expanded
          ? <ChevronUp  size={13} color="#484F58" />
          : <ChevronDown size={13} color="#484F58" />}
      </button>

      {expanded && (
        <div style={{ padding: '4px 16px 16px', backgroundColor: 'rgba(0,0,0,0.15)' }}>
          {CATEGORIES.map(cat => {
            const catItems = items.filter(i => i.category === cat.id)
            const sorted   = [
              ...catItems.filter(i => !i.checked),
              ...catItems.filter(i => i.checked),
            ]
            const isAdding = adding === cat.id

            return (
              <div key={cat.id} style={{ marginBottom: 14 }}>
                {/* Category heading */}
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#8B949E',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{cat.icon}</span> {cat.label}
                </div>

                {/* Items */}
                {sorted.map(item => (
                  <div
                    key={item.id}
                    className="checklist-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 0', borderBottom: '1px solid rgba(48,54,61,0.5)',
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item.id, !item.checked)}
                      style={{
                        flexShrink: 0, width: 17, height: 17, borderRadius: 4,
                        border: `2px solid ${item.checked ? '#3FB950' : '#484F58'}`,
                        backgroundColor: item.checked ? '#3FB950' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#0B1117', lineHeight: 1,
                      }}
                    >
                      {item.checked ? '✓' : ''}
                    </button>

                    {/* Label */}
                    <span style={{
                      flex: 1, fontSize: 13,
                      color: item.checked ? '#484F58' : '#E6EDF3',
                      textDecoration: item.checked ? 'line-through' : 'none',
                    }}>
                      {item.item}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="checklist-delete"
                      style={{
                        padding: '2px 3px', background: 'none', border: 'none',
                        cursor: 'pointer', color: '#484F58', lineHeight: 1,
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {/* Add item */}
                {isAdding ? (
                  <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                    <input
                      type="text"
                      value={addText}
                      onChange={e => setAddText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addItem(cat.id)
                        if (e.key === 'Escape') { setAdding(null); setAddText('') }
                      }}
                      placeholder={`Add to ${cat.label}…`}
                      autoFocus
                      style={{
                        flex: 1, padding: '5px 8px', borderRadius: 6,
                        border: '1px solid #30363D', backgroundColor: '#1C2430',
                        color: '#E6EDF3', fontSize: 12, outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => addItem(cat.id)}
                      disabled={saving || !addText.trim()}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        backgroundColor: '#1F6FEB', color: '#fff', border: 'none',
                        cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAdding(null); setAddText('') }}
                      style={{
                        padding: '5px 7px', borderRadius: 6,
                        border: '1px solid #30363D', backgroundColor: 'transparent',
                        color: '#8B949E', cursor: 'pointer',
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAdding(cat.id); setAddText('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      marginTop: 5, padding: '3px 0', background: 'none', border: 'none',
                      cursor: 'pointer', color: '#484F58', fontSize: 12,
                    }}
                  >
                    <Plus size={11} /> Add item
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .checklist-delete { opacity: 0; transition: opacity 0.12s; }
        .checklist-row:hover .checklist-delete { opacity: 1; }
        @media (max-width: 768px) { .checklist-delete { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
