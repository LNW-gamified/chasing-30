'use client'

import { useState, useRef } from 'react'
import type { ReactElement } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StampDef {
  abbr: string
  team: string
  stadium: string
  city: string
  state: string
  primary: string   // team primary color — used for stamp frame & text
  secondary: string // team secondary color
  art: ReactElement // illustration with hardcoded stadium colors; grayscale applied externally
}

export interface StampData {
  stadiumId: string
  abbr: string
  visitDate: string | null
}

// ── Stadium illustrations ─────────────────────────────────────────────────────
// Each is an 80×80 SVG. When unearned, the wrapper applies grayscale(1).

const A = (viewBox = '0 0 80 80') => ({ viewBox, width: 80, height: 80, fill: 'none' as const })

const STAMP_DEFS: StampDef[] = [
  // ── AL East ────────────────────────────────────────────────────────────────
  {
    abbr: 'BAL', team: 'Baltimore Orioles', stadium: 'Camden Yards', city: 'Baltimore', state: 'MD',
    primary: '#DF4601', secondary: '#27251F',
    art: (
      <svg {...A()}>
        {/* B&O Warehouse — long brick building behind right field */}
        <rect x="5" y="24" width="70" height="40" fill="#DF4601" rx="2"/>
        <rect x="5" y="20" width="70" height="6" fill="#C03A00"/>
        {/* Arched windows */}
        <path d="M10 52 Q10 42 16 42 Q22 42 22 52" fill="#27251F" opacity="0.5"/>
        <path d="M25 52 Q25 42 31 42 Q37 42 37 52" fill="#27251F" opacity="0.5"/>
        <path d="M40 52 Q40 42 46 42 Q52 42 52 52" fill="#27251F" opacity="0.5"/>
        <path d="M55 52 Q55 42 61 42 Q67 42 67 52" fill="#27251F" opacity="0.5"/>
        {/* Brick lines */}
        <line x1="5" y1="32" x2="75" y2="32" stroke="#C03A00" strokeWidth="1"/>
        <line x1="5" y1="38" x2="75" y2="38" stroke="#C03A00" strokeWidth="1"/>
        {/* Ground */}
        <rect x="5" y="64" width="70" height="4" fill="#C03A00"/>
        <rect x="0" y="68" width="80" height="5" fill="#27251F" opacity="0.3"/>
      </svg>
    ),
  },
  {
    abbr: 'BOS', team: 'Boston Red Sox', stadium: 'Fenway Park', city: 'Boston', state: 'MA',
    primary: '#BD3039', secondary: '#0C2340',
    art: (
      <svg {...A()}>
        {/* Green Monster — the iconic tall left-field wall */}
        <rect x="8" y="10" width="64" height="58" fill="#285C2F" rx="2"/>
        {/* Manual scoreboard section (top-left) */}
        <rect x="8" y="10" width="26" height="28" fill="#1F4A23"/>
        <rect x="11" y="14" width="7" height="3" fill="#000" opacity="0.5"/>
        <rect x="20" y="14" width="7" height="3" fill="#000" opacity="0.5"/>
        <rect x="11" y="20" width="7" height="3" fill="#000" opacity="0.5"/>
        <rect x="20" y="20" width="7" height="3" fill="#000" opacity="0.5"/>
        <rect x="11" y="26" width="7" height="3" fill="#000" opacity="0.5"/>
        <rect x="20" y="26" width="7" height="3" fill="#000" opacity="0.5"/>
        {/* Ladder on right side */}
        <line x1="66" y1="14" x2="66" y2="68" stroke="white" strokeWidth="1.5" opacity="0.55"/>
        <line x1="61" y1="22" x2="71" y2="22" stroke="white" strokeWidth="1" opacity="0.5"/>
        <line x1="61" y1="32" x2="71" y2="32" stroke="white" strokeWidth="1" opacity="0.5"/>
        <line x1="61" y1="42" x2="71" y2="42" stroke="white" strokeWidth="1" opacity="0.5"/>
        <line x1="61" y1="52" x2="71" y2="52" stroke="white" strokeWidth="1" opacity="0.5"/>
        <line x1="61" y1="62" x2="71" y2="62" stroke="white" strokeWidth="1" opacity="0.5"/>
        {/* Grass at base */}
        <rect x="5" y="68" width="70" height="7" fill="#4A7C59" opacity="0.5"/>
      </svg>
    ),
  },
  {
    abbr: 'NYY', team: 'New York Yankees', stadium: 'Yankee Stadium', city: 'New York', state: 'NY',
    primary: '#003087', secondary: '#C4CED4',
    art: (
      <svg {...A()}>
        {/* Monument Park — central obelisk */}
        <rect x="35" y="18" width="10" height="44" fill="#003087"/>
        <polygon points="40,8 35,18 45,18" fill="#003087"/>
        <rect x="30" y="60" width="20" height="5" fill="#003087"/>
        {/* Side plaques */}
        <rect x="14" y="32" width="16" height="20" fill="#C4CED4" rx="1.5" opacity="0.8"/>
        <line x1="16" y1="38" x2="28" y2="38" stroke="#003087" strokeWidth="1.5"/>
        <line x1="16" y1="43" x2="28" y2="43" stroke="#003087" strokeWidth="1.5"/>
        <line x1="16" y1="48" x2="28" y2="48" stroke="#003087" strokeWidth="1.5"/>
        <rect x="50" y="32" width="16" height="20" fill="#C4CED4" rx="1.5" opacity="0.8"/>
        <line x1="52" y1="38" x2="64" y2="38" stroke="#003087" strokeWidth="1.5"/>
        <line x1="52" y1="43" x2="64" y2="43" stroke="#003087" strokeWidth="1.5"/>
        <line x1="52" y1="48" x2="64" y2="48" stroke="#003087" strokeWidth="1.5"/>
        {/* Grass */}
        <rect x="5" y="65" width="70" height="7" fill="#4A7C59" opacity="0.4"/>
      </svg>
    ),
  },
  {
    abbr: 'TB', team: 'Tampa Bay Rays', stadium: 'Tropicana Field', city: 'St. Petersburg', state: 'FL',
    primary: '#092C5C', secondary: '#8FBCE6',
    art: (
      <svg {...A()}>
        {/* Dome outline */}
        <path d="M8 68 Q40 8 72 68 Z" fill="rgba(9,44,92,0.12)"/>
        <path d="M8 68 Q40 8 72 68" fill="none" stroke="#092C5C" strokeWidth="3"/>
        {/* The famous circular catwalks (rings inside dome) */}
        <path d="M18 58 Q40 28 62 58" fill="none" stroke="#8FBCE6" strokeWidth="2" strokeDasharray="4,3"/>
        <path d="M23 63 Q40 38 57 63" fill="none" stroke="#8FBCE6" strokeWidth="1.8" strokeDasharray="4,3"/>
        <path d="M27 67 Q40 47 53 67" fill="none" stroke="#8FBCE6" strokeWidth="1.5" strokeDasharray="4,3"/>
        {/* Support struts from apex */}
        <line x1="40" y1="10" x2="14" y2="68" stroke="#092C5C" strokeWidth="1" opacity="0.35"/>
        <line x1="40" y1="10" x2="66" y2="68" stroke="#092C5C" strokeWidth="1" opacity="0.35"/>
        <line x1="40" y1="10" x2="40" y2="68" stroke="#092C5C" strokeWidth="1" opacity="0.25"/>
        {/* Ground */}
        <rect x="8" y="68" width="64" height="3" fill="#092C5C" opacity="0.4"/>
      </svg>
    ),
  },
  {
    abbr: 'TOR', team: 'Toronto Blue Jays', stadium: 'Rogers Centre', city: 'Toronto', state: 'ON',
    primary: '#134A8E', secondary: '#E8291C',
    art: (
      <svg {...A()}>
        {/* CN Tower */}
        {/* Buttressed base */}
        <path d="M30 72 L26 60 L38 30 L42 30 L54 60 L50 72 Z" fill="#134A8E" opacity="0.7"/>
        {/* Main shaft */}
        <rect x="37" y="12" width="6" height="58" fill="#134A8E"/>
        {/* Observation pod */}
        <ellipse cx="40" cy="22" rx="11" ry="5" fill="#E8291C"/>
        <rect x="37" y="18" width="6" height="9" fill="#134A8E"/>
        {/* Tip */}
        <rect x="39" y="5" width="2" height="10" fill="#134A8E"/>
        {/* Toronto skyline silhouette */}
        <rect x="5" y="62" width="20" height="8" fill="#134A8E" opacity="0.4"/>
        <rect x="60" y="58" width="15" height="12" fill="#134A8E" opacity="0.4"/>
        <rect x="58" y="52" width="8" height="18" fill="#134A8E" opacity="0.3"/>
        {/* Ground */}
        <rect x="0" y="70" width="80" height="5" fill="#134A8E" opacity="0.25"/>
      </svg>
    ),
  },

  // ── AL Central ─────────────────────────────────────────────────────────────
  {
    abbr: 'CWS', team: 'Chicago White Sox', stadium: 'Guaranteed Rate Field', city: 'Chicago', state: 'IL',
    primary: '#27251F', secondary: '#C4CED4',
    art: (
      <svg {...A()}>
        {/* Old Comiskey scoreboard homage — exploding scoreboard */}
        <rect x="12" y="8" width="56" height="40" fill="#27251F" rx="3"/>
        <rect x="16" y="12" width="48" height="12" fill="#1A1A1A" rx="1"/>
        {/* Pinlights / dot-matrix rows */}
        {[15,20,25].map(y => [18,24,30,36,42,48,54].map(x => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={1.5} fill="#C4CED4" opacity={0.6}/>
        )))}
        <line x1="16" y1="30" x2="64" y2="30" stroke="#C4CED4" strokeWidth="0.5" opacity="0.4"/>
        <line x1="16" y1="36" x2="64" y2="36" stroke="#C4CED4" strokeWidth="0.5" opacity="0.4"/>
        {/* Exploding fireworks burst */}
        {[[-12,14],[-8,18],[0,20],[8,18],[12,14],[-10,10],[10,10]].map(([dx,dy],i) => (
          <line key={i} x1="40" y1="48" x2={40+dx} y2={48+dy} stroke="#C4CED4" strokeWidth="1.5" strokeLinecap="round"/>
        ))}
        {[[-12,14],[-8,18],[0,20],[8,18],[12,14]].map(([dx,dy],i) => (
          <circle key={i} cx={40+dx} cy={48+dy} r={2} fill="#C4CED4"/>
        ))}
        {/* Ground */}
        <rect x="5" y="68" width="70" height="5" fill="#27251F" opacity="0.4"/>
      </svg>
    ),
  },
  {
    abbr: 'CLE', team: 'Cleveland Guardians', stadium: 'Progressive Field', city: 'Cleveland', state: 'OH',
    primary: '#00385D', secondary: '#E31937',
    art: (
      <svg {...A()}>
        {/* Cleveland skyline — Key Tower prominent */}
        <path d="M5 70 L5 52 L12 52 L12 44 L18 44 L18 38 L22 38 L22 32 L26 32 L26 18 L30 14 L34 18 L34 32 L38 32 L38 40 L44 40 L44 32 L48 28 L52 32 L52 40 L58 40 L58 46 L64 46 L64 52 L70 52 L70 58 L75 58 L75 70 Z" fill="#00385D"/>
        {/* Key Tower highlight (the tallest in Cleveland) */}
        <rect x="26" y="14" width="8" height="56" fill="#E31937" opacity="0.7"/>
        <rect x="27" y="12" width="6" height="4" fill="#E31937" opacity="0.9"/>
        {/* Sky */}
        <rect x="0" y="0" width="80" height="14" fill="rgba(0,56,93,0.1)"/>
        {/* Ground */}
        <rect x="0" y="70" width="80" height="5" fill="#00385D" opacity="0.3"/>
      </svg>
    ),
  },
  {
    abbr: 'DET', team: 'Detroit Tigers', stadium: 'Comerica Park', city: 'Detroit', state: 'MI',
    primary: '#0C2340', secondary: '#FA4616',
    art: (
      <svg {...A()}>
        {/* Tiger head silhouette */}
        <path d="M40 15 C25 15 14 25 14 40 C14 55 25 65 40 65 C55 65 66 55 66 40 C66 25 55 15 40 15 Z" fill="#FA4616"/>
        {/* Ears */}
        <path d="M22 20 L18 8 L30 17 Z" fill="#FA4616"/>
        <path d="M58 20 L62 8 L50 17 Z" fill="#FA4616"/>
        {/* Face markings (tiger stripes) */}
        <path d="M28 28 C32 34 38 34 40 28" fill="none" stroke="#0C2340" strokeWidth="2.5"/>
        <path d="M52 28 C48 34 42 34 40 28" fill="none" stroke="#0C2340" strokeWidth="2.5"/>
        <line x1="40" y1="42" x2="40" y2="50" stroke="#0C2340" strokeWidth="2"/>
        <line x1="32" y1="44" x2="40" y2="42" stroke="#0C2340" strokeWidth="1.5"/>
        <line x1="48" y1="44" x2="40" y2="42" stroke="#0C2340" strokeWidth="1.5"/>
        {/* Eyes */}
        <circle cx="30" cy="36" r="4" fill="#0C2340"/>
        <circle cx="50" cy="36" r="4" fill="#0C2340"/>
        <circle cx="31" cy="35" r="1.5" fill="white" opacity="0.6"/>
        <circle cx="51" cy="35" r="1.5" fill="white" opacity="0.6"/>
        {/* Nose */}
        <path d="M37 48 L43 48 L40 52 Z" fill="#0C2340"/>
      </svg>
    ),
  },
  {
    abbr: 'KC', team: 'Kansas City Royals', stadium: 'Kauffman Stadium', city: 'Kansas City', state: 'MO',
    primary: '#004687', secondary: '#BD9B60',
    art: (
      <svg {...A()}>
        {/* Kauffman fountains — iconic water jets */}
        {/* Water pool base */}
        <ellipse cx="40" cy="66" rx="34" ry="6" fill="rgba(0,70,135,0.25)"/>
        {/* Main center jet */}
        <path d="M40 66 C38 52 36 36 40 12 C44 36 42 52 40 66 Z" fill="#004687" opacity="0.85"/>
        <ellipse cx="40" cy="12" rx="5" ry="8" fill="#BD9B60" opacity="0.9"/>
        {/* Left jet */}
        <path d="M26 64 C24 52 22 40 28 24 C31 40 29 52 26 64 Z" fill="#004687" opacity="0.7"/>
        <ellipse cx="28" cy="24" rx="4" ry="6" fill="#BD9B60" opacity="0.7"/>
        {/* Right jet */}
        <path d="M54 64 C56 52 58 40 52 24 C49 40 51 52 54 64 Z" fill="#004687" opacity="0.7"/>
        <ellipse cx="52" cy="24" rx="4" ry="6" fill="#BD9B60" opacity="0.7"/>
        {/* Outer small jets */}
        <path d="M14 62 C13 52 14 44 18 34 C20 44 18 52 14 62 Z" fill="#004687" opacity="0.5"/>
        <path d="M66 62 C67 52 66 44 62 34 C60 44 62 52 66 62 Z" fill="#004687" opacity="0.5"/>
        {/* Water droplets */}
        <circle cx="30" cy="20" r="2" fill="#BD9B60" opacity="0.6"/>
        <circle cx="50" cy="20" r="2" fill="#BD9B60" opacity="0.6"/>
      </svg>
    ),
  },
  {
    abbr: 'MIN', team: 'Minnesota Twins', stadium: 'Target Field', city: 'Minneapolis', state: 'MN',
    primary: '#002B5C', secondary: '#D31145',
    art: (
      <svg {...A()}>
        {/* Minneapolis skyline — IDS Tower as centerpiece */}
        <path d="M5 70 L5 54 L12 54 L12 46 L18 46 L18 40 L22 40 L22 34 L26 34 L26 28 L30 28 L30 12 L34 8 L38 12 L38 28 L42 28 L42 36 L46 36 L46 28 L50 24 L54 28 L54 36 L60 36 L60 44 L66 44 L66 50 L72 50 L72 56 L76 56 L76 70 Z" fill="#002B5C"/>
        {/* IDS Tower highlight (step-back top) */}
        <rect x="30" y="8" width="8" height="62" fill="#D31145" opacity="0.6"/>
        <rect x="32" y="4" width="4" height="6" fill="#D31145" opacity="0.8"/>
        {/* Small accent buildings */}
        <rect x="46" y="24" width="8" height="46" fill="#D31145" opacity="0.35"/>
        {/* Ground */}
        <rect x="0" y="70" width="80" height="5" fill="#002B5C" opacity="0.35"/>
      </svg>
    ),
  },

  // ── AL West ────────────────────────────────────────────────────────────────
  {
    abbr: 'HOU', team: 'Houston Astros', stadium: 'Minute Maid Park', city: 'Houston', state: 'TX',
    primary: '#002D62', secondary: '#EB6E1F',
    art: (
      <svg {...A()}>
        {/* The famous left field train */}
        {/* Track */}
        <line x1="5" y1="60" x2="75" y2="60" stroke="#002D62" strokeWidth="2.5"/>
        <line x1="5" y1="60" x2="75" y2="60" stroke="#EB6E1F" strokeWidth="1" strokeDasharray="6,4"/>
        {/* Locomotive body */}
        <rect x="10" y="38" width="48" height="22" fill="#EB6E1F" rx="3"/>
        {/* Engine nose */}
        <path d="M58 42 L58 60 L68 60 L68 48 Z" fill="#EB6E1F"/>
        <rect x="68" y="54" width="5" height="6" fill="#002D62" rx="1"/>
        {/* Windows */}
        <rect x="14" y="42" width="10" height="8" fill="#002D62" rx="1.5"/>
        <rect x="28" y="42" width="10" height="8" fill="#002D62" rx="1.5"/>
        <rect x="42" y="42" width="10" height="8" fill="#002D62" rx="1.5"/>
        {/* Wheels */}
        <circle cx="22" cy="62" r="5" fill="#002D62" stroke="#EB6E1F" strokeWidth="1.5"/>
        <circle cx="22" cy="62" r="2" fill="#EB6E1F"/>
        <circle cx="42" cy="62" r="5" fill="#002D62" stroke="#EB6E1F" strokeWidth="1.5"/>
        <circle cx="42" cy="62" r="2" fill="#EB6E1F"/>
        <circle cx="60" cy="62" r="5" fill="#002D62" stroke="#EB6E1F" strokeWidth="1.5"/>
        <circle cx="60" cy="62" r="2" fill="#EB6E1F"/>
        {/* Steam puffs */}
        <circle cx="16" cy="32" r="5" fill="white" opacity="0.4"/>
        <circle cx="22" cy="26" r="4" fill="white" opacity="0.3"/>
        <circle cx="28" cy="22" r="3" fill="white" opacity="0.2"/>
      </svg>
    ),
  },
  {
    abbr: 'LAA', team: 'Los Angeles Angels', stadium: 'Angel Stadium', city: 'Anaheim', state: 'CA',
    primary: '#BA0021', secondary: '#003263',
    art: (
      <svg {...A()}>
        {/* The Big A — iconic A-frame structure */}
        {/* Left leg of A */}
        <path d="M24 72 L40 14 L44 14 L44 72 Z" fill="#BA0021"/>
        {/* Right leg of A */}
        <path d="M56 72 L40 14 L36 14 L36 72 Z" fill="#BA0021"/>
        {/* Crossbar of A */}
        <rect x="30" y="46" width="20" height="5" fill="#BA0021"/>
        {/* Halo (circle at top) */}
        <ellipse cx="40" cy="10" rx="16" ry="4.5" fill="none" stroke="#C4CED4" strokeWidth="3"/>
        <ellipse cx="40" cy="10" rx="16" ry="4.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5"/>
        {/* Light strips on A */}
        <line x1="32" y1="64" x2="40" y2="22" stroke="white" strokeWidth="1" opacity="0.35"/>
        <line x1="48" y1="64" x2="40" y2="22" stroke="white" strokeWidth="1" opacity="0.35"/>
        {/* Ground */}
        <rect x="5" y="72" width="70" height="4" fill="#003263" opacity="0.4"/>
      </svg>
    ),
  },
  {
    abbr: 'OAK', team: 'Oakland Athletics', stadium: 'Oakland Coliseum', city: 'Oakland', state: 'CA',
    primary: '#003831', secondary: '#EFB21E',
    art: (
      <svg {...A()}>
        {/* Mount Davis — the infamous upper deck fill-in */}
        <rect x="8" y="8" width="64" height="46" fill="#003831" rx="2"/>
        {/* Tiered sections */}
        <rect x="12" y="14" width="56" height="10" fill="#EFB21E" opacity="0.2"/>
        <rect x="12" y="26" width="56" height="10" fill="#EFB21E" opacity="0.2"/>
        <rect x="12" y="38" width="56" height="10" fill="#EFB21E" opacity="0.2"/>
        {/* Vertical columns */}
        {[18,28,38,48,58].map(x => (
          <line key={x} x1={x} y1="8" x2={x} y2="54" stroke="#EFB21E" strokeWidth="1" opacity="0.5"/>
        ))}
        {/* Foul poles */}
        <line x1="15" y1="8" x2="15" y2="60" stroke="#EFB21E" strokeWidth="2.5"/>
        <line x1="65" y1="8" x2="65" y2="60" stroke="#EFB21E" strokeWidth="2.5"/>
        {/* Scoreboard area */}
        <rect x="30" y="10" width="20" height="12" fill="#EFB21E" opacity="0.3"/>
        {/* Ground */}
        <rect x="8" y="54" width="64" height="6" fill="#003831"/>
        <rect x="8" y="60" width="64" height="4" fill="#4A7C59" opacity="0.4"/>
      </svg>
    ),
  },
  {
    abbr: 'SEA', team: 'Seattle Mariners', stadium: 'T-Mobile Park', city: 'Seattle', state: 'WA',
    primary: '#005C5C', secondary: '#0C2C56',
    art: (
      <svg {...A()}>
        {/* T-Mobile Park retractable roof — the distinctive curved arm */}
        {/* Main roof arc */}
        <path d="M5 65 C5 35 30 8 72 6" fill="none" stroke="#005C5C" strokeWidth="7" strokeLinecap="round"/>
        {/* Roof panel (translucent) */}
        <path d="M5 65 C5 37 30 11 70 9 L70 20 C32 22 15 46 15 65 Z" fill="rgba(0,92,92,0.2)"/>
        {/* Secondary structural members */}
        <path d="M5 65 C5 40 28 14 68 12" fill="none" stroke="#0C2C56" strokeWidth="3" opacity="0.5"/>
        {/* Support struts */}
        <line x1="28" y1="12" x2="22" y2="65" stroke="#0C2C56" strokeWidth="2" opacity="0.5"/>
        <line x1="48" y1="8" x2="38" y2="65" stroke="#0C2C56" strokeWidth="2" opacity="0.5"/>
        <line x1="65" y1="8" x2="55" y2="65" stroke="#0C2C56" strokeWidth="2" opacity="0.5"/>
        {/* Field */}
        <rect x="5" y="65" width="70" height="6" fill="#4A7C59" opacity="0.45"/>
      </svg>
    ),
  },
  {
    abbr: 'TEX', team: 'Texas Rangers', stadium: 'Globe Life Field', city: 'Arlington', state: 'TX',
    primary: '#003278', secondary: '#C0111F',
    art: (
      <svg {...A()}>
        {/* Texas Lone Star */}
        <path d="M40,6 L48.5,31 L76,31 L53.7,47.5 L62.2,72.5 L40,56 L17.8,72.5 L26.3,47.5 L4,31 L31.5,31 Z" fill="#C0111F"/>
        {/* Star inner highlight */}
        <path d="M40,16 L46,34 L65,34 L50,45 L56,63 L40,52 L24,63 L30,45 L15,34 L34,34 Z" fill="rgba(255,255,255,0.12)"/>
        {/* Center glow */}
        <circle cx="40" cy="42" r="7" fill="rgba(255,255,255,0.2)"/>
        {/* Outer ring accent */}
        <path d="M40,6 L48.5,31 L76,31 L53.7,47.5 L62.2,72.5 L40,56 L17.8,72.5 L26.3,47.5 L4,31 L31.5,31 Z" fill="none" stroke="#003278" strokeWidth="1.5" opacity="0.5"/>
      </svg>
    ),
  },

  // ── NL East ────────────────────────────────────────────────────────────────
  {
    abbr: 'ATL', team: 'Atlanta Braves', stadium: 'Truist Park', city: 'Cumberland', state: 'GA',
    primary: '#CE1141', secondary: '#13274F',
    art: (
      <svg {...A()}>
        {/* Atlanta skyline silhouette */}
        <path d="M5 70 L5 54 L10 54 L10 46 L15 46 L15 40 L20 40 L20 34 L24 34 L24 28 L28 28 L28 20 L32 14 L36 20 L36 28 L40 28 L40 36 L44 36 L44 26 L48 20 L52 26 L52 36 L58 36 L58 42 L63 42 L63 48 L68 48 L68 54 L72 54 L72 58 L75 58 L75 70 Z" fill="#13274F"/>
        {/* Bank of America Plaza highlight (tallest) */}
        <rect x="28" y="14" width="8" height="56" fill="#CE1141" opacity="0.75"/>
        {/* Spire */}
        <rect x="31" y="8" width="2" height="8" fill="#CE1141" opacity="0.9"/>
        {/* Second-tallest */}
        <rect x="44" y="20" width="8" height="50" fill="#CE1141" opacity="0.45"/>
        {/* Ground */}
        <rect x="0" y="70" width="80" height="5" fill="#13274F" opacity="0.35"/>
      </svg>
    ),
  },
  {
    abbr: 'MIA', team: 'Miami Marlins', stadium: 'loanDepot Park', city: 'Miami', state: 'FL',
    primary: '#00A3E0', secondary: '#FF6600',
    art: (
      <svg {...A()}>
        {/* Miami skyline + open retractable roof */}
        {/* Buildings */}
        <path d="M5 68 L5 52 L10 52 L10 44 L15 44 L15 36 L20 36 L20 28 L26 28 L26 20 L30 16 L34 20 L34 28 L40 28 L40 22 L44 18 L48 22 L48 28 L54 28 L54 36 L60 36 L60 44 L65 44 L65 52 L72 52 L72 58 L76 58 L76 68 Z" fill="#00A3E0" opacity="0.8"/>
        {/* Open roof frame arms */}
        <path d="M20 36 Q40 18 60 36" fill="none" stroke="#FF6600" strokeWidth="3" strokeLinecap="round"/>
        <path d="M15 40 Q40 22 65 40" fill="none" stroke="#FF6600" strokeWidth="1.5" opacity="0.5"/>
        {/* Water reflection */}
        <path d="M5 68 Q40 62 75 68 L75 75 L5 75 Z" fill="rgba(0,163,224,0.2)"/>
        {/* Palm tree */}
        <line x1="70" y1="68" x2="70" y2="50" stroke="#4A7C59" strokeWidth="1.5"/>
        <path d="M64 50 Q70 44 76 50" fill="none" stroke="#4A7C59" strokeWidth="1.5"/>
        <path d="M66 54 Q70 47 74 54" fill="none" stroke="#4A7C59" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    abbr: 'NYM', team: 'New York Mets', stadium: 'Citi Field', city: 'New York', state: 'NY',
    primary: '#002D72', secondary: '#FF5910',
    art: (
      <svg {...A()}>
        {/* NY skyline with Home Run Apple */}
        {/* Skyline */}
        <path d="M5 68 L5 50 L10 50 L10 42 L15 42 L15 34 L22 34 L22 24 L26 18 L30 24 L30 34 L36 34 L36 40 L44 40 L44 34 L50 28 L54 34 L54 40 L60 40 L60 46 L66 46 L66 52 L72 52 L72 58 L76 58 L76 68 Z" fill="#002D72" opacity="0.85"/>
        {/* The famous Home Run Apple */}
        <circle cx="40" cy="32" r="14" fill="#FF5910"/>
        <path d="M34 22 C32 15 36 11 40 14 C44 11 48 15 46 22" fill="none" stroke="#FF5910" strokeWidth="2"/>
        {/* Apple stem */}
        <rect x="39" y="14" width="2" height="6" fill="#4A7C59"/>
        <path d="M41 16 C44 12 47 12 46 16" fill="none" stroke="#4A7C59" strokeWidth="1.5"/>
        {/* Apple highlight */}
        <path d="M32 26 C32 22 34 20 36 22" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
        {/* Ground */}
        <rect x="0" y="68" width="80" height="6" fill="#002D72" opacity="0.3"/>
      </svg>
    ),
  },
  {
    abbr: 'PHI', team: 'Philadelphia Phillies', stadium: 'Citizens Bank Park', city: 'Philadelphia', state: 'PA',
    primary: '#E81828', secondary: '#002D72',
    art: (
      <svg {...A()}>
        {/* Liberty Bell */}
        {/* Bell yoke */}
        <rect x="30" y="6" width="20" height="8" fill="#E81828" rx="2"/>
        <rect x="34" y="4" width="12" height="5" fill="#002D72" rx="2"/>
        {/* Bell body */}
        <path d="M22 14 Q22 10 30 10 L50 10 Q58 10 58 14 L60 52 Q52 66 40 66 Q28 66 20 52 Z" fill="#E81828"/>
        {/* Bell lip (flare at bottom) */}
        <path d="M18 52 Q28 70 40 70 Q52 70 62 52" fill="none" stroke="#E81828" strokeWidth="4"/>
        {/* The Crack */}
        <path d="M40 18 L37 34 L40 56" stroke="#002D72" strokeWidth="2.5" fill="none"/>
        {/* Bell clapper */}
        <line x1="40" y1="58" x2="40" y2="72" stroke="#E81828" strokeWidth="3"/>
        <circle cx="40" cy="74" r="4" fill="#E81828"/>
        {/* Surface details */}
        <path d="M26 30 Q33 25 38 28" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    abbr: 'WSH', team: 'Washington Nationals', stadium: 'Nationals Park', city: 'Washington', state: 'DC',
    primary: '#AB0003', secondary: '#14225A',
    art: (
      <svg {...A()}>
        {/* Capitol dome */}
        {/* Building base / steps */}
        <rect x="12" y="54" width="56" height="18" fill="#AB0003"/>
        {/* Columns */}
        {[18,25,32,39,46,53,60].map(x => (
          <line key={x} x1={x} y1="54" x2={x} y2="72" stroke="rgba(0,0,0,0.2)" strokeWidth="2"/>
        ))}
        {/* Drum / drum ring */}
        <rect x="22" y="40" width="36" height="16" fill="#AB0003"/>
        {/* Windows on drum */}
        <path d="M26 48 Q26 42 30 42 Q34 42 34 48" fill="#14225A" opacity="0.4"/>
        <path d="M36 48 Q36 42 40 42 Q44 42 44 48" fill="#14225A" opacity="0.4"/>
        <path d="M46 48 Q46 42 50 42 Q54 42 54 48" fill="#14225A" opacity="0.4"/>
        {/* Dome */}
        <path d="M22 42 Q40 8 58 42 Z" fill="#AB0003"/>
        <path d="M25 42 Q40 12 55 42 Z" fill="rgba(255,255,255,0.1)"/>
        {/* Lantern at top */}
        <rect x="37" y="12" width="6" height="10" fill="#14225A"/>
        <rect x="38" y="7" width="4" height="7" fill="#AB0003"/>
        {/* Flagpole */}
        <line x1="40" y1="5" x2="40" y2="9" stroke="#14225A" strokeWidth="1.5"/>
      </svg>
    ),
  },

  // ── NL Central ─────────────────────────────────────────────────────────────
  {
    abbr: 'CHC', team: 'Chicago Cubs', stadium: 'Wrigley Field', city: 'Chicago', state: 'IL',
    primary: '#0E3386', secondary: '#CC3433',
    art: (
      <svg {...A()}>
        {/* Wrigley — ivy wall with hand-turned scoreboard */}
        {/* Brick wall base */}
        <rect x="5" y="36" width="70" height="36" fill="#CC3433" rx="1"/>
        {/* Brick mortar lines */}
        {[42,48,54,60].map(y => (
          <line key={y} x1="5" y1={y} x2="75" y2={y} stroke="#A02828" strokeWidth="0.8"/>
        ))}
        {/* Ivy clusters along the top of the wall */}
        <ellipse cx="13" cy="36" rx="9" ry="10" fill="#285C2F"/>
        <ellipse cx="26" cy="33" rx="10" ry="10" fill="#3A6B3A"/>
        <ellipse cx="40" cy="35" rx="10" ry="10" fill="#285C2F"/>
        <ellipse cx="54" cy="33" rx="10" ry="10" fill="#3A6B3A"/>
        <ellipse cx="67" cy="36" rx="9" ry="10" fill="#285C2F"/>
        {/* Hand-turned scoreboard (left) */}
        <rect x="6" y="8" width="30" height="25" fill="#0E3386"/>
        {/* Score lines */}
        <line x1="9" y1="16" x2="33" y2="16" stroke="white" strokeWidth="1" opacity="0.6"/>
        <line x1="9" y1="22" x2="33" y2="22" stroke="white" strokeWidth="1" opacity="0.6"/>
        <line x1="9" y1="28" x2="33" y2="28" stroke="white" strokeWidth="1" opacity="0.6"/>
        {/* Number blocks */}
        <rect x="10" y="17" width="6" height="4" fill="white" opacity="0.4"/>
        <rect x="18" y="17" width="6" height="4" fill="white" opacity="0.4"/>
        <rect x="26" y="17" width="6" height="4" fill="white" opacity="0.4"/>
      </svg>
    ),
  },
  {
    abbr: 'CIN', team: 'Cincinnati Reds', stadium: 'Great American Ball Park', city: 'Cincinnati', state: 'OH',
    primary: '#C6011F', secondary: '#000000',
    art: (
      <svg {...A()}>
        {/* Ohio River bridge (Roebling suspension bridge) */}
        {/* River */}
        <rect x="0" y="56" width="80" height="18" fill="rgba(198,1,31,0.12)" rx="2"/>
        {/* Bridge deck */}
        <rect x="4" y="52" width="72" height="5" fill="#C6011F"/>
        {/* Two main towers */}
        <rect x="18" y="24" width="7" height="30" fill="#000000"/>
        <polygon points="21.5,16 18,24 25,24" fill="#000000"/>
        <rect x="55" y="24" width="7" height="30" fill="#000000"/>
        <polygon points="58.5,16 55,24 62,24" fill="#000000"/>
        {/* Main cables */}
        <path d="M21.5 18 Q40 48 58.5 18" fill="none" stroke="#C6011F" strokeWidth="2.5"/>
        {/* Hanger cables */}
        {[28,33,37,40,43,47,52].map((x,i) => {
          const my = 48 - Math.abs(40-x)*0.3
          return <line key={i} x1={x} y1={52-Math.abs(40-x)*0.5} x2={x} y2={52} stroke="#C6011F" strokeWidth="1" opacity="0.6"/>
        })}
        {/* Support lines from top */}
        <line x1="21.5" y1="18" x2="5" y2="52" stroke="#C6011F" strokeWidth="1.5" opacity="0.5"/>
        <line x1="58.5" y1="18" x2="75" y2="52" stroke="#C6011F" strokeWidth="1.5" opacity="0.5"/>
      </svg>
    ),
  },
  {
    abbr: 'MIL', team: 'Milwaukee Brewers', stadium: 'American Family Field', city: 'Milwaukee', state: 'WI',
    primary: '#12284B', secondary: '#FFC52F',
    art: (
      <svg {...A()}>
        {/* Retractable roof — fan-blade panels converging at center hub */}
        {/* Left roof panel */}
        <path d="M40 38 L6 22 L8 32 L40 40 Z" fill="#FFC52F" opacity="0.9"/>
        {/* Right roof panel */}
        <path d="M40 38 L74 22 L72 32 L40 40 Z" fill="#FFC52F" opacity="0.9"/>
        {/* Lower panels */}
        <path d="M40 40 L6 54 L8 45 L40 40 Z" fill="#12284B"/>
        <path d="M40 40 L74 54 L72 45 L40 40 Z" fill="#12284B"/>
        {/* Center hub */}
        <circle cx="40" cy="39" r="9" fill="#FFC52F"/>
        <circle cx="40" cy="39" r="4" fill="#12284B"/>
        {/* Milwaukee skyline below */}
        <path d="M12 68 L12 58 L18 58 L18 54 L24 54 L24 58 L30 58 L30 62 L36 62 L36 58 L44 58 L44 62 L50 62 L50 56 L56 56 L56 58 L62 58 L62 62 L68 62 L68 68 Z" fill="#12284B" opacity="0.5"/>
      </svg>
    ),
  },
  {
    abbr: 'PIT', team: 'Pittsburgh Pirates', stadium: 'PNC Park', city: 'Pittsburgh', state: 'PA',
    primary: '#FDB827', secondary: '#27251F',
    art: (
      <svg {...A()}>
        {/* Roberto Clemente Bridge / Allegheny River suspension bridge */}
        {/* River */}
        <rect x="0" y="56" width="80" height="16" fill="rgba(253,184,39,0.12)"/>
        {/* Bridge deck */}
        <rect x="4" y="52" width="72" height="5" fill="#FDB827"/>
        {/* Towers */}
        <rect x="17" y="22" width="8" height="32" fill="#27251F"/>
        <polygon points="21,13 17,22 25,22" fill="#27251F"/>
        <rect x="55" y="22" width="8" height="32" fill="#27251F"/>
        <polygon points="59,13 55,22 63,22" fill="#27251F"/>
        {/* Main cables */}
        <path d="M21 15 Q40 46 59 15" fill="none" stroke="#FDB827" strokeWidth="2.5"/>
        {/* Hangers */}
        {[25,30,35,40,45,50,55].map(x => (
          <line key={x} x1={x} y1={x <= 40 ? 15+(40-x)*0.75 : 15+(x-40)*0.75} x2={x} y2={52} stroke="#FDB827" strokeWidth="1" opacity="0.65"/>
        ))}
        {/* Anchor cables */}
        <line x1="21" y1="15" x2="5" y2="52" stroke="#FDB827" strokeWidth="1.5" opacity="0.5"/>
        <line x1="59" y1="15" x2="75" y2="52" stroke="#FDB827" strokeWidth="1.5" opacity="0.5"/>
        {/* Pittsburgh skyline hint */}
        <rect x="5" y="40" width="10" height="16" fill="#27251F" opacity="0.35"/>
        <rect x="66" y="36" width="10" height="20" fill="#27251F" opacity="0.35"/>
      </svg>
    ),
  },
  {
    abbr: 'STL', team: 'St. Louis Cardinals', stadium: 'Busch Stadium', city: 'St. Louis', state: 'MO',
    primary: '#C41E3A', secondary: '#0C2340',
    art: (
      <svg {...A()}>
        {/* Gateway Arch — the most iconic shape in baseball geography */}
        <path d="M14 72 C14 72 8 30 40 8 C72 30 66 72 66 72"
          fill="none" stroke="#C41E3A" strokeWidth="6" strokeLinecap="round"/>
        {/* Inner arch shadow/depth */}
        <path d="M18 72 C18 72 13 33 40 13 C67 33 62 72 62 72"
          fill="none" stroke="rgba(196,30,58,0.25)" strokeWidth="10"/>
        {/* Base ground line */}
        <line x1="8" y1="72" x2="72" y2="72" stroke="#C41E3A" strokeWidth="2.5"/>
        {/* Jefferson National Expansion Memorial grounds */}
        <path d="M22 72 L22 65 L58 65 L58 72" fill="none" stroke="#C41E3A" strokeWidth="1" opacity="0.5"/>
        <path d="M30 72 L30 68 L50 68 L50 72" fill="none" stroke="#C41E3A" strokeWidth="1" opacity="0.4"/>
        {/* Mississippi River hint */}
        <path d="M68 68 Q72 60 76 64 Q78 68 80 65 L80 80 L68 80 Z" fill="rgba(12,35,64,0.2)"/>
      </svg>
    ),
  },

  // ── NL West ────────────────────────────────────────────────────────────────
  {
    abbr: 'ARI', team: 'Arizona Diamondbacks', stadium: 'Chase Field', city: 'Phoenix', state: 'AZ',
    primary: '#A71930', secondary: '#E3D4AD',
    art: (
      <svg {...A()}>
        {/* Chase Field — retractable roof in desert heat */}
        {/* Desert sun */}
        <circle cx="40" cy="20" r="12" fill="#F5A623" opacity="0.6"/>
        {[0,45,90,135,180,225,270,315].map(deg => {
          const r = deg * Math.PI / 180
          return <line key={deg} x1={40+14*Math.cos(r)} y1={20+14*Math.sin(r)} x2={40+18*Math.cos(r)} y2={20+18*Math.sin(r)} stroke="#F5A623" strokeWidth="1.5" opacity="0.5"/>
        })}
        {/* Retractable roof arc */}
        <path d="M8 58 C8 30 35 8 72 8" fill="none" stroke="#A71930" strokeWidth="5" strokeLinecap="round"/>
        {/* Roof panel */}
        <path d="M8 58 C8 32 35 12 70 11 L70 20 C37 21 18 40 18 58 Z" fill="rgba(167,25,48,0.2)"/>
        {/* Saguaro cacti */}
        <line x1="62" y1="70" x2="62" y2="42" stroke="#4A7C59" strokeWidth="3" strokeLinecap="round"/>
        <line x1="55" y1="54" x2="62" y2="54" stroke="#4A7C59" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="62" y1="49" x2="70" y2="49" stroke="#4A7C59" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Desert ground */}
        <rect x="0" y="70" width="80" height="5" fill="#E3D4AD" opacity="0.3"/>
      </svg>
    ),
  },
  {
    abbr: 'COL', team: 'Colorado Rockies', stadium: 'Coors Field', city: 'Denver', state: 'CO',
    primary: '#333366', secondary: '#C4CED4',
    art: (
      <svg {...A()}>
        {/* Rocky Mountains — the defining backdrop */}
        {/* Sky */}
        <rect x="0" y="0" width="80" height="80" fill="rgba(51,51,102,0.06)"/>
        {/* Far mountains (lighter) */}
        <path d="M0 75 L8 52 L16 60 L28 38 L36 50 L44 40 L52 52 L60 36 L68 50 L76 38 L80 44 L80 75 Z" fill="#333366" opacity="0.4"/>
        {/* Near mountains (darker) */}
        <path d="M0 78 L10 55 L20 65 L35 30 L50 58 L64 38 L76 55 L80 50 L80 78 Z" fill="#333366" opacity="0.85"/>
        {/* Snow caps */}
        <path d="M35 30 L29 44 L41 44 Z" fill="white" opacity="0.88"/>
        <path d="M64 38 L59 50 L69 50 Z" fill="white" opacity="0.7"/>
        <path d="M10 55 L6 64 L14 64 Z" fill="white" opacity="0.5"/>
        {/* Field/ground */}
        <rect x="0" y="72" width="80" height="8" fill="#4A7C59" opacity="0.45"/>
      </svg>
    ),
  },
  {
    abbr: 'LAD', team: 'Los Angeles Dodgers', stadium: 'Dodger Stadium', city: 'Los Angeles', state: 'CA',
    primary: '#005A9C', secondary: '#EF3E42',
    art: (
      <svg {...A()}>
        {/* Dodger Stadium — Chavez Ravine hills and terraced pavilions */}
        {/* Sky */}
        <rect x="0" y="0" width="80" height="45" fill="rgba(0,90,156,0.08)"/>
        {/* Hills silhouette */}
        <path d="M0 80 L0 55 Q8 40 20 46 Q30 52 36 42 Q44 32 52 45 Q62 55 72 46 Q78 40 80 46 L80 80 Z" fill="#005A9C" opacity="0.65"/>
        {/* Terraced stadium pavilions */}
        <path d="M10 72 Q40 62 70 72 L70 78 L10 78 Z" fill="#005A9C" opacity="0.85"/>
        <path d="M15 66 Q40 58 65 66 L65 72 L15 72 Z" fill="#005A9C" opacity="0.7"/>
        {/* Palm trees */}
        <line x1="18" y1="46" x2="18" y2="32" stroke="#4A7C59" strokeWidth="1.5"/>
        <path d="M12 32 Q18 27 24 32" fill="none" stroke="#4A7C59" strokeWidth="1.5"/>
        <path d="M14 36 Q18 30 22 36" fill="none" stroke="#4A7C59" strokeWidth="1.5"/>
        <line x1="62" y1="46" x2="62" y2="34" stroke="#4A7C59" strokeWidth="1.5"/>
        <path d="M56 34 Q62 29 68 34" fill="none" stroke="#4A7C59" strokeWidth="1.5"/>
        <path d="M58 38 Q62 32 66 38" fill="none" stroke="#4A7C59" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    abbr: 'SD', team: 'San Diego Padres', stadium: 'Petco Park', city: 'San Diego', state: 'CA',
    primary: '#2F241D', secondary: '#FFC425',
    art: (
      <svg {...A()}>
        {/* Western Metal Supply Co. building — left-field corner landmark */}
        <rect x="5" y="14" width="32" height="58" fill="#2F241D" rx="2"/>
        {/* Windows in grid */}
        {[18,26,34,42,50,58].map(y => [9,18].map(x => (
          <rect key={`${x}${y}`} x={x} y={y} width="8" height="5" fill="#FFC425" opacity="0.55" rx="1"/>
        )))}
        {/* Building top cornice */}
        <rect x="3" y="12" width="36" height="4" fill="#FFC425" opacity="0.6"/>
        {/* San Diego Bay */}
        <path d="M37 55 Q52 48 68 52 Q76 55 78 60 L78 78 L37 78 Z" fill="rgba(47,36,29,0.15)"/>
        {/* Bay water shimmer */}
        <path d="M42 62 Q50 58 58 62" fill="none" stroke="#FFC425" strokeWidth="1.5" opacity="0.5"/>
        <path d="M46 68 Q55 63 65 68" fill="none" stroke="#FFC425" strokeWidth="1.5" opacity="0.4"/>
        {/* Seagulls */}
        <path d="M52 44 Q55 40 58 44" fill="none" stroke="#FFC425" strokeWidth="1.5"/>
        <path d="M62 40 Q65 36 68 40" fill="none" stroke="#FFC425" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    abbr: 'SF', team: 'San Francisco Giants', stadium: 'Oracle Park', city: 'San Francisco', state: 'CA',
    primary: '#FD5A1E', secondary: '#27251F',
    art: (
      <svg {...A()}>
        {/* Oracle Park — McCovey Cove splash zone */}
        {/* Right-field arcade wall */}
        <rect x="5" y="14" width="8" height="60" fill="#27251F"/>
        {/* Arched openings */}
        <path d="M5 30 Q9 22 13 30" fill="#FD5A1E" opacity="0.5"/>
        <path d="M5 46 Q9 38 13 46" fill="#FD5A1E" opacity="0.5"/>
        <path d="M5 62 Q9 54 13 62" fill="#FD5A1E" opacity="0.5"/>
        {/* McCovey Cove water */}
        <path d="M13 52 Q30 44 50 50 Q64 54 72 50 L72 78 L13 78 Z" fill="rgba(253,90,30,0.15)"/>
        {/* Splash waves */}
        <path d="M20 58 Q26 52 32 58" fill="none" stroke="#FD5A1E" strokeWidth="2"/>
        <path d="M36 54 Q42 48 48 54" fill="none" stroke="#FD5A1E" strokeWidth="2"/>
        <path d="M54 56 Q60 50 66 56" fill="none" stroke="#FD5A1E" strokeWidth="2"/>
        {/* Baseball in cove (splash!) */}
        <circle cx="44" cy="46" r="6" fill="white" stroke="#FD5A1E" strokeWidth="1.5"/>
        <path d="M41 43 C40 45 40 47 41 49" fill="none" stroke="#C0392B" strokeWidth="1"/>
        <path d="M47 43 C48 45 48 47 47 49" fill="none" stroke="#C0392B" strokeWidth="1"/>
        {/* Splash droplets */}
        <circle cx="34" cy="42" r="2" fill="#FD5A1E"/>
        <circle cx="54" cy="40" r="2" fill="#FD5A1E"/>
        <circle cx="40" cy="38" r="1.5" fill="#FD5A1E"/>
      </svg>
    ),
  },
]

// Row order: BAL BOS NYY TB TOR | CWS CLE DET KC MIN | HOU LAA OAK SEA TEX | ATL MIA NYM PHI WSH | CHC CIN MIL PIT STL | ARI COL LAD SD SF
const GRID_ORDER = [
  'BAL','BOS','NYY','TB','TOR',
  'CWS','CLE','DET','KC','MIN',
  'HOU','LAA','OAK','SEA','TEX',
  'ATL','MIA','NYM','PHI','WSH',
  'CHC','CIN','MIL','PIT','STL',
  'ARI','COL','LAD','SD','SF',
]

// ── Passport Stamp ────────────────────────────────────────────────────────────

function PassportStamp({ def, visitDate }: { def: StampDef; visitDate: string | null }) {
  const earned = !!visitDate
  const fmtDate = visitDate
    ? new Date(visitDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  if (earned) {
    return (
      // ── EARNED: rich gold gradient card ────────────────────────
      <div style={{
        background: 'linear-gradient(135deg, #C9A84C 0%, #8B6914 100%)',
        borderRadius: 12,
        border: '2px solid #C9A84C',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 0 20px rgba(201,168,76,0.4), 0 4px 16px rgba(0,0,0,0.5)',
      }}>
        {/* VISITED corner badge */}
        <div style={{
          position: 'absolute', top: 7, right: 7, zIndex: 3,
          backgroundColor: '#0a0e1a',
          color: '#C9A84C',
          fontFamily: 'monospace', fontSize: 7, fontWeight: 900,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '2px 5px', borderRadius: 3,
          border: '1px solid rgba(201,168,76,0.5)',
          pointerEvents: 'none',
        }}>✓ VISITED</div>

        {/* Header row */}
        <div style={{ padding: '8px 10px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
            {def.abbr}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.18em' }}>MLB</span>
        </div>

        {/* Illustration — full color, full opacity */}
        <div style={{ width: 120, height: 120, margin: '4px auto 2px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          <div style={{ transform: 'scale(1.5)', transformOrigin: 'top left', width: 80, height: 80 }}>
            {def.art}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '2px 10px 10px', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
            color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{def.stadium}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2, letterSpacing: '0.04em' }}>
            {def.city}, {def.state}
          </div>
          {fmtDate && (
            <div style={{
              fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
              color: '#F5E070', marginTop: 5, paddingTop: 5,
              borderTop: '1px solid rgba(255,255,255,0.25)',
            }}>{fmtDate}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    // ── UNEARNED: dark elevated card with ghost illustration ──────
    <div style={{
      backgroundColor: '#1a2744',
      borderRadius: 12,
      border: '1px solid #2a3a5c',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Header row */}
      <div style={{ padding: '8px 10px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
          {def.abbr}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.18em' }}>MLB</span>
      </div>

      {/* Illustration — ghost at 45% */}
      <div style={{ width: 120, height: 120, margin: '4px auto 2px', overflow: 'hidden', position: 'relative', flexShrink: 0, opacity: 0.45 }}>
        <div style={{ transform: 'scale(1.5)', transformOrigin: 'top left', width: 80, height: 80 }}>
          {def.art}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '2px 10px 10px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
          color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{def.stadium}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.70)', marginTop: 2, letterSpacing: '0.04em' }}>
          {def.city}, {def.state}
        </div>
      </div>
    </div>
  )
}

// ── Passport Grid ─────────────────────────────────────────────────────────────

interface Props {
  stamps: StampData[]
  userName: string
  passportNo: string
  earnedCount: number
}

export default function PassportGrid({ stamps, userName, passportNo, earnedCount }: Props) {
  const [copied, setCopied] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const visitMap = new Map(stamps.map(s => [s.abbr, s.visitDate]))
  const pct = Math.round((earnedCount / 30) * 100)

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: 'My Stadium Passport', text: `${userName} has visited ${earnedCount}/30 MLB stadiums!`, url })
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const DIVISIONS = [
    { label: 'American League East',    abbrs: ['BAL','BOS','NYY','TB','TOR']  },
    { label: 'American League Central', abbrs: ['CWS','CLE','DET','KC','MIN']  },
    { label: 'American League West',    abbrs: ['HOU','LAA','OAK','SEA','TEX'] },
    { label: 'National League East',    abbrs: ['ATL','MIA','NYM','PHI','WSH'] },
    { label: 'National League Central', abbrs: ['CHC','CIN','MIL','PIT','STL'] },
    { label: 'National League West',    abbrs: ['ARI','COL','LAD','SD','SF']   },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 48px' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#0a0e1a',
        borderRadius: 16,
        border: '1px solid rgba(197,164,126,0.2)',
        padding: '28px 28px 24px',
        marginBottom: 32,
        position: 'relative',
      }}>
        {/* Inline share button — top right */}
        <button
          onClick={handleShare}
          style={{
            position: 'absolute', top: 20, right: 20,
            padding: '7px 16px', borderRadius: 20,
            background: 'transparent',
            border: '1.5px solid rgba(197,164,126,0.4)',
            color: '#C5A47E', fontFamily: 'monospace',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
            cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          {copied ? '✓ COPIED' : '⬆ SHARE'}
        </button>

        {/* Title block */}
        <div style={{ marginBottom: 0, paddingRight: 100 }}>
          <div style={{
            fontSize: 36, fontWeight: 900, color: '#E6C99A',
            letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            Stadium Passport
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
            color: 'rgba(197,164,126,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>
            United States Baseball Tour · Est. 1869
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(197,164,126,0.12)', margin: '16px 0' }} />

        {/* Holder info */}
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(197,164,126,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>Holder</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#E6C99A' }}>{userName}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(197,164,126,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>Passport No.</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#E6C99A' }}>{passportNo}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(197,164,126,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Tour Progress
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#E6C99A' }}>
              <span style={{ fontSize: 22 }}>{earnedCount}</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}> of 30</span>
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(197,164,126,0.1)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(197,164,126,0.2)' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 6,
              background: 'linear-gradient(90deg, #C5A47E, #E6C99A)',
              transition: 'width 0.8s ease',
              minWidth: earnedCount > 0 ? 12 : 0,
            }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(197,164,126,0.35)', marginTop: 5, letterSpacing: '0.1em' }}>
            {30 - earnedCount} parks remaining on the tour
          </div>
        </div>
      </div>

      {/* ── Stamp grid ────────────────────────────────────────── */}
      <div ref={gridRef}>
        {DIVISIONS.map(({ label, abbrs }) => {
          const earnedInDiv = abbrs.filter(a => {
            const vd = visitMap.get(a)
            return vd !== null && vd !== undefined
          }).length
          return (
            <div key={label} style={{ marginBottom: 32 }}>
              {/* Division header — gold left border accent */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12, paddingLeft: 14,
                borderLeft: '3px solid #F5A623',
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#E6EDF3' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#F5A623' }}>{earnedInDiv}/5</span>
              </div>

              {/* 3 cols mobile, 5 cols desktop */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {abbrs.map(abbr => {
                  const def = STAMP_DEFS.find(d => d.abbr === abbr)
                  if (!def) return null
                  const visitDate = visitMap.get(abbr) ?? null
                  return <PassportStamp key={abbr} def={def} visitDate={visitDate} />
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Share CTA ─────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={handleShare}
          style={{
            width: '100%', padding: '18px 24px', borderRadius: 14,
            background: '#1F6FEB',
            border: '1.5px solid #1F6FEB',
            color: '#ffffff', fontFamily: 'monospace',
            fontSize: 14, fontWeight: 900, letterSpacing: '0.2em',
            cursor: 'pointer', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            boxShadow: '0 2px 16px rgba(197,164,126,0.08)',
          }}
        >
          <span style={{ fontSize: 18 }}>{copied ? '✓' : '⬆'}</span>
          {copied ? 'COPIED TO CLIPBOARD' : 'SHARE MY PASSPORT'}
        </button>
        <div style={{
          textAlign: 'center', marginTop: 12,
          fontFamily: 'monospace', fontSize: 8,
          color: 'rgba(197,164,126,0.25)', letterSpacing: '0.14em',
        }}>
          CHASING 30 · OFFICIAL STADIUM PASSPORT · VALID ALL 30 PARKS
        </div>
      </div>
    </div>
  )
}
