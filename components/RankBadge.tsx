// Custom SVG badge for each rank in the baseball career ladder.
// All badges use a 0 0 100 112 viewBox; width/height props scale them.

type SvgProps = { width: number; height: number; viewBox: string; fill: 'none' }
type Props = { rankName: string; size?: number }

export function RankBadge({ rankName, size = 100 }: Props) {
  const height = Math.round(size * 1.12)
  const svgProps: SvgProps = { width: size, height, viewBox: '0 0 100 112', fill: 'none' }

  switch (rankName) {
    case 'Sandlot Kid':       return <SandlotKid {...svgProps} />
    case 'Minor Leaguer':     return <MinorLeaguer {...svgProps} />
    case 'September Call-Up': return <SeptemberCallUp {...svgProps} />
    case 'Rotation Ace':      return <RotationAce {...svgProps} />
    case 'All-Star':          return <AllStar {...svgProps} />
    case 'Hall of Famer':     return <HallOfFamer {...svgProps} />
    default:                  return <SandlotKid {...svgProps} />
  }
}

// ── Sandlot Kid: plain baseball with dirt texture ─────────────────────────────
function SandlotKid(p: SvgProps) {
  return (
    <svg {...p}>
      <circle cx="50" cy="56" r="44" fill="#FEFEF4" stroke="#C8B098" strokeWidth="2" />
      <circle cx="50" cy="56" r="44" fill="rgba(160,110,55,0.08)" />
      {/* Left seam */}
      <path d="M27 43 C20 49 20 63 27 69" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="27" y1="47" x2="20" y2="44" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="53" x2="17" y2="52" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="59" x2="16" y2="59" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="26" y1="65" x2="19" y2="68" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      {/* Right seam */}
      <path d="M73 43 C80 49 80 63 73 69" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="73" y1="47" x2="80" y2="44" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="75" y1="53" x2="83" y2="52" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="76" y1="59" x2="84" y2="59" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="74" y1="65" x2="81" y2="68" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Minor Leaguer: baseball + team bus ───────────────────────────────────────
function MinorLeaguer(p: SvgProps) {
  return (
    <svg {...p}>
      {/* Baseball */}
      <circle cx="50" cy="42" r="34" fill="#FEFEF4" stroke="#C8B098" strokeWidth="2" />
      {/* Left seam */}
      <path d="M30 31 C24 36 24 48 30 53" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="35" x2="24" y2="32" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="28" y1="41" x2="21" y2="40" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="28" y1="47" x2="21" y2="47" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      {/* Right seam */}
      <path d="M70 31 C76 36 76 48 70 53" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" />
      <line x1="70" y1="35" x2="76" y2="32" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="72" y1="41" x2="79" y2="40" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="72" y1="47" x2="79" y2="47" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      {/* Connector */}
      <line x1="50" y1="76" x2="50" y2="83" stroke="#484F58" strokeWidth="1.5" strokeDasharray="2,2" />
      {/* Bus body */}
      <rect x="12" y="83" width="76" height="22" rx="4" fill="#2E86C1" stroke="#1A5276" strokeWidth="1.5" />
      {/* Windshield */}
      <rect x="14" y="86" width="15" height="9" rx="2" fill="#AED6F1" stroke="#1A5276" strokeWidth="0.8" />
      {/* Windows */}
      <rect x="33" y="86" width="12" height="9" rx="2" fill="#AED6F1" stroke="#1A5276" strokeWidth="0.8" />
      <rect x="49" y="86" width="12" height="9" rx="2" fill="#AED6F1" stroke="#1A5276" strokeWidth="0.8" />
      <rect x="65" y="86" width="12" height="9" rx="2" fill="#AED6F1" stroke="#1A5276" strokeWidth="0.8" />
      {/* Wheels */}
      <circle cx="27" cy="105" r="5" fill="#17202A" stroke="#2E86C1" strokeWidth="1" />
      <circle cx="27" cy="105" r="2" fill="#2E86C1" />
      <circle cx="68" cy="105" r="5" fill="#17202A" stroke="#2E86C1" strokeWidth="1" />
      <circle cx="68" cy="105" r="2" fill="#2E86C1" />
    </svg>
  )
}

// ── September Call-Up: baseball + rising arrow ────────────────────────────────
function SeptemberCallUp(p: SvgProps) {
  return (
    <svg {...p}>
      {/* Baseball */}
      <circle cx="50" cy="56" r="44" fill="#FEFEF4" stroke="#C8B098" strokeWidth="2" />
      {/* Left seam */}
      <path d="M27 43 C20 49 20 63 27 69" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="27" y1="47" x2="20" y2="44" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="53" x2="17" y2="52" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="59" x2="16" y2="59" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="26" y1="65" x2="19" y2="68" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      {/* Right seam */}
      <path d="M73 43 C80 49 80 63 73 69" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="73" y1="47" x2="80" y2="44" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="75" y1="53" x2="83" y2="52" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="76" y1="59" x2="84" y2="59" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="74" y1="65" x2="81" y2="68" stroke="#C0392B" strokeWidth="1.5" strokeLinecap="round" />
      {/* Rising arrow (green) */}
      <line x1="50" y1="76" x2="50" y2="40" stroke="#3FB950" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M38 52 L50 38 L62 52" stroke="#3FB950" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Rotation Ace: baseball wreathed in flames ─────────────────────────────────
function RotationAce(p: SvgProps) {
  return (
    <svg {...p}>
      <defs>
        <linearGradient id="flameGrad" x1="50" y1="108" x2="50" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E25822" />
          <stop offset="55%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#FFE066" />
        </linearGradient>
      </defs>
      {/* Outer flames */}
      <path d="M36 108 C28 92 20 80 34 68 C30 80 42 76 40 62 C47 76 49 70 50 58 C51 70 53 76 60 62 C58 76 70 80 66 68 C80 80 72 92 64 108 Z"
        fill="url(#flameGrad)" />
      {/* Inner flame highlight */}
      <path d="M43 108 C40 96 36 88 43 82 C41 90 48 88 47 79 C51 87 53 83 50 74 C53 83 55 87 58 79 C57 88 59 90 57 82 C64 88 60 96 57 108 Z"
        fill="#FFE066" opacity="0.45" />
      {/* Baseball on top */}
      <circle cx="50" cy="46" r="36" fill="#FEFEF4" stroke="#C8B098" strokeWidth="2" />
      {/* Left seam */}
      <path d="M30 35 C24 40 24 52 30 57" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="39" x2="24" y2="36" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="28" y1="44" x2="21" y2="43" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="28" y1="50" x2="21" y2="50" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      {/* Right seam */}
      <path d="M70 35 C76 40 76 52 70 57" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" />
      <line x1="70" y1="39" x2="76" y2="36" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="72" y1="44" x2="79" y2="43" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="72" y1="50" x2="79" y2="50" stroke="#C0392B" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

// ── All-Star: gold 5-pointed star badge ───────────────────────────────────────
// Star: center (50,54), outer R=42, inner r=18
const STAR = 'M50,12 L60.58,39.44 L89.94,41.02 L67.12,59.56 L74.69,87.98 L50,72 L25.31,87.98 L32.88,59.56 L10.06,41.02 L39.42,39.44 Z'

function AllStar(p: SvgProps) {
  return (
    <svg {...p}>
      <defs>
        <linearGradient id="starGold" x1="50" y1="12" x2="50" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE44D" />
          <stop offset="55%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#C8860A" />
        </linearGradient>
      </defs>
      {/* Drop shadow */}
      <path d={STAR} fill="rgba(0,0,0,0.18)" transform="translate(3,4)" />
      {/* Star body */}
      <path d={STAR} fill="url(#starGold)" stroke="#DAA520" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Inner highlight */}
      <path d="M50,24 L57,44.6 L78.6,45.3 L63.2,56.8 L68.3,77.6 L50,67 L31.7,77.6 L36.8,56.8 L21.4,45.3 L43,44.6 Z"
        fill="rgba(255,255,255,0.15)" />
      {/* Center glow */}
      <circle cx="50" cy="52" r="6" fill="rgba(255,255,255,0.38)" />
    </svg>
  )
}

// ── Hall of Famer: gold trophy + baseball + animated shimmer ──────────────────
function HallOfFamer(p: SvgProps) {
  return (
    <svg {...p}>
      <defs>
        <linearGradient id="hofGold" x1="30" y1="18" x2="70" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE44D" />
          <stop offset="45%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#C8860A" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="50" cy="107" rx="26" ry="3.5" fill="rgba(0,0,0,0.2)" />

      {/* Trophy cup */}
      <path d="M20 30 L80 30 L71 73 L29 73 Z" fill="url(#hofGold)" />
      {/* Cup sheen */}
      <path d="M31 34 L35 70" stroke="rgba(255,255,220,0.4)" strokeWidth="6" strokeLinecap="round" />
      <path d="M43 32 L45 71" stroke="rgba(255,255,220,0.2)" strokeWidth="3" strokeLinecap="round" />
      {/* Left handle */}
      <path d="M20 37 Q4 55 25 68" fill="none" stroke="#F5A623" strokeWidth="7" strokeLinecap="round" />
      {/* Right handle */}
      <path d="M80 37 Q96 55 75 68" fill="none" stroke="#F5A623" strokeWidth="7" strokeLinecap="round" />
      {/* Stem */}
      <rect x="40" y="73" width="20" height="12" fill="#DAA520" />
      {/* Base narrow */}
      <rect x="27" y="85" width="46" height="9" rx="2" fill="#F5A623" />
      {/* Base wide */}
      <rect x="17" y="93" width="66" height="11" rx="3" fill="url(#hofGold)" />

      {/* Shimmer sweep (CSS-animated) */}
      <rect
        x="-28" y="-5" width="28" height="125"
        fill="rgba(255,255,255,0.22)"
        transform="skewX(-12)"
        className="hof-shimmer-strip"
      />

      {/* Baseball on top */}
      <circle cx="50" cy="19" r="13" fill="#FEFEF4" stroke="#C8B098" strokeWidth="1.5" />
      <path d="M43 14 C40 18 40 22 43 26" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M57 14 C60 18 60 22 57 26" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="43" y1="17" x2="40" y2="15" stroke="#C0392B" strokeWidth="1" strokeLinecap="round" />
      <line x1="43" y1="23" x2="39" y2="23" stroke="#C0392B" strokeWidth="1" strokeLinecap="round" />
      <line x1="57" y1="17" x2="60" y2="15" stroke="#C0392B" strokeWidth="1" strokeLinecap="round" />
      <line x1="57" y1="23" x2="61" y2="23" stroke="#C0392B" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}
