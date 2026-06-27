'use client'

import { useState, useEffect, useCallback } from 'react'

export interface HistoryFact {
  id: string
  year: number | null
  fact: string
  category: string | null
  player_name: string | null
  team: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  record:      'RECORD',
  world_series:'WORLD SERIES',
  no_hitter:   'NO-HITTER',
  debut:       'DEBUT',
  death:       'FAREWELL',
  hall_of_fame:'HALL OF FAME',
  milestone:   'MILESTONE',
  postseason:  'POSTSEASON',
}

const CATEGORY_COLOR: Record<string, string> = {
  record:      '#FF6B35',
  world_series:'#F5A623',
  no_hitter:   '#3FB950',
  debut:       '#58A6FF',
  death:       '#8B949E',
  hall_of_fame:'#FFD700',
  milestone:   '#C678DD',
  postseason:  '#F5A623',
}

function DiamondWatermark() {
  return (
    <svg
      style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.05, pointerEvents: 'none' }}
      width={130} height={130} viewBox="0 0 130 130" fill="none"
    >
      {/* Outer diamond (the field shape) */}
      <path d="M65 8 L122 65 L65 122 L8 65 Z" fill="#F5A623" />
      {/* Infield grass */}
      <path d="M65 24 L106 65 L65 106 L24 65 Z" fill="#0B1A10" />
      {/* Base paths */}
      <line x1="65" y1="8"  x2="122" y2="65" stroke="#F5A623" strokeWidth="1" />
      <line x1="122" y1="65" x2="65" y2="122" stroke="#F5A623" strokeWidth="1" />
      <line x1="65" y1="122" x2="8"  y2="65" stroke="#F5A623" strokeWidth="1" />
      <line x1="8"  y1="65"  x2="65" y2="8"  stroke="#F5A623" strokeWidth="1" />
      {/* Bases */}
      <rect x="58" y="1"   width="14" height="14" rx="2" fill="#F5A623" transform="rotate(45 65 8)"  />
      <rect x="115" y="58" width="14" height="14" rx="2" fill="#F5A623" transform="rotate(45 122 65)" />
      <rect x="58" y="115" width="14" height="14" rx="2" fill="#F5A623" transform="rotate(45 65 122)" />
      <rect x="1"  y="58"  width="14" height="14" rx="2" fill="#F5A623" transform="rotate(45 8 65)"  />
      {/* Home plate */}
      <polygon points="65,109 71,115 65,121 59,115" fill="#F5A623" />
      {/* Pitcher's mound */}
      <circle cx="65" cy="65" r="5" fill="rgba(245,166,35,0.5)" />
    </svg>
  )
}

export default function OnThisDay({ facts }: { facts: HistoryFact[] }) {
  const [idx, setIdx]         = useState(0)
  const [fading, setFading]   = useState(false)

  const today    = new Date()
  const dateStr  = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()
  const hasFacts = facts.length > 0
  const fact     = hasFacts ? facts[idx] : null
  const cat      = fact?.category ?? null
  const label    = cat ? (CATEGORY_LABEL[cat] ?? cat.toUpperCase()) : null
  const color    = cat ? (CATEGORY_COLOR[cat] ?? '#8B949E') : '#8B949E'

  const goTo = useCallback((next: number) => {
    setFading(true)
    setTimeout(() => { setIdx(next); setFading(false) }, 180)
  }, [])

  const prev = () => goTo((idx - 1 + facts.length) % facts.length)
  const next = () => goTo((idx + 1) % facts.length)

  // Auto-advance every 14 seconds when multiple facts
  useEffect(() => {
    if (facts.length <= 1) return
    const t = setInterval(() => {
      setIdx(i => (i + 1) % facts.length)
    }, 14000)
    return () => clearInterval(t)
  }, [facts.length])

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      background: 'linear-gradient(150deg, #0d1f14 0%, #111f16 60%, #0d1f14 100%)',
      border: '1px solid #2a4a34',
      marginBottom: '1.25rem',
      boxShadow: 'inset 0 1px 0 rgba(245,166,35,0.06)',
    }}>
      {/* Dot-matrix grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(245,166,35,0.07) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }} />

      <DiamondWatermark />

      {/* ── Scoreboard header ─────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 9px',
        borderBottom: '1px solid rgba(245,166,35,0.12)',
        background: 'rgba(0,0,0,0.25)',
      }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.22em', color: '#F5A623',
          textShadow: '0 0 10px rgba(245,166,35,0.5)',
        }}>
          ◈ ON THIS DAY IN BASEBALL
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.14em', color: 'rgba(245,166,35,0.55)',
        }}>
          {dateStr}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '14px 16px 12px',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.18s ease',
        minHeight: 130,
      }}>
        {!hasFacts ? (
          /* Fallback */
          <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
            <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.6 }}>⚾</div>
            <div style={{
              fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.18em', color: 'rgba(245,166,35,0.4)',
            }}>
              NO HISTORIC RECORD FOR TODAY
            </div>
            <div style={{ fontSize: 13, color: '#8B949E', marginTop: 8, lineHeight: 1.5 }}>
              But history is being made somewhere —<br />check the scoreboard tomorrow.
            </div>
          </div>
        ) : (
          <>
            {/* Year + category badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
              {fact?.year != null && (
                <span style={{
                  fontFamily: 'monospace', fontSize: 26, fontWeight: 900, lineHeight: 1,
                  color: '#F5A623', letterSpacing: '0.03em',
                  textShadow: '0 0 14px rgba(245,166,35,0.35)',
                }}>
                  {fact.year}
                </span>
              )}
              {label && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4,
                  background: `${color}18`,
                  border: `1px solid ${color}55`,
                  fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.16em', color,
                }}>
                  {label}
                </span>
              )}
            </div>

            {/* Fact text */}
            <p style={{
              margin: '0 0 10px',
              fontSize: 14, lineHeight: 1.6,
              color: 'rgba(255,255,255,0.92)',
            }}>
              {fact?.fact}
            </p>

            {/* Player / Team tags */}
            {(fact?.player_name || fact?.team) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {fact.player_name && (
                  <span style={{
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.06em', color: 'rgba(245,166,35,0.75)',
                  }}>
                    ▸ {fact.player_name}
                  </span>
                )}
                {fact.team && (
                  <span style={{
                    fontFamily: 'monospace', fontSize: 12,
                    letterSpacing: '0.06em', color: 'rgba(200,223,192,0.4)',
                  }}>
                    {fact.team}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Carousel controls (only with multiple facts) ──────── */}
      {facts.length > 1 && (
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px 8px',
          borderTop: '1px solid rgba(245,166,35,0.08)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <button
            onClick={prev}
            aria-label="Previous fact"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(245,166,35,0.5)', fontSize: 13, padding: '2px 6px',
              fontFamily: 'monospace', lineHeight: 1,
              borderRadius: 4,
            }}
          >
            ◀
          </button>

          {/* Dot indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {facts.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Fact ${i + 1}`}
                style={{
                  width: i === idx ? 18 : 6, height: 6,
                  borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                  background: i === idx ? '#F5A623' : 'rgba(245,166,35,0.22)',
                  transition: 'all 0.25s ease',
                }}
              />
            ))}
            <span style={{
              fontFamily: 'monospace', fontSize: 11,
              color: 'rgba(245,166,35,0.35)', marginLeft: 4,
            }}>
              {idx + 1}/{facts.length}
            </span>
          </div>

          <button
            onClick={next}
            aria-label="Next fact"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(245,166,35,0.5)', fontSize: 13, padding: '2px 6px',
              fontFamily: 'monospace', lineHeight: 1,
              borderRadius: 4,
            }}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  )
}
