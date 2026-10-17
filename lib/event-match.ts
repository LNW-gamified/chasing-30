// Shared rules for tying a logged Beyond-the-30 entry to a baseball_events row.
// Used by the Ballparks Events tab (attended badges) and the event detail page.

export interface EventEntryLike {
  category: string
  event_type: string | null
}

// Lowercase fragments searched for in entry.event_type.
const EVENT_KEYWORDS: Record<string, string[]> = {
  'mlb-all-star-game':        ['all-star', 'all star'],
  'home-run-derby':           ['home run derby'],
  'wild-card-game':           ['wild card'],
  'division-series-alds':     ['alds'],
  'division-series-nlds':     ['nlds'],
  'championship-series-alcs': ['alcs'],
  'championship-series-nlcs': ['nlcs'],
  'world-series':             ['world series'],
  'field-of-dreams-game':     ['field of dreams'],
  'banana-ball':              ['banana'],
  'arizona-fall-league':      ['arizona fall'],
  'cape-cod-league':          ['cape cod'],
  'college-world-series':     ['college'],
  'london-series':            ['london'],
  'mexico-series':            ['mexico'],
  'puerto-rico-series':       ['puerto rico'],
}

// Event type pre-selected in the log form when you tap "+ Log" on an event.
// Values must match the options in BaseballLifeForm's MLB_SPECIAL_EVENT_TYPES.
export const EVENT_DEFAULT_TYPE: Record<string, string> = {
  'mlb-all-star-game':        'All-Star Game',
  'home-run-derby':           'Home Run Derby',
  'wild-card-game':           'Wild Card Game',
  'division-series-alds':     'ALDS',
  'division-series-nlds':     'NLDS',
  'championship-series-alcs': 'ALCS',
  'championship-series-nlcs': 'NLCS',
  'world-series':             'World Series',
  'field-of-dreams-game':     'Field of Dreams Game',
  'banana-ball':              'Banana Ball',
  'arizona-fall-league':      'Arizona Fall League',
  'cape-cod-league':          'Cape Cod Baseball',
  'college-world-series':     'College Baseball',
  'london-series':            'London Series',
  'mexico-series':            'Mexico Series',
  'puerto-rico-series':       'Puerto Rico Series',
}

export function eventDefaultType(slug: string): string {
  return EVENT_DEFAULT_TYPE[slug] ?? ''
}

export function eventMatches(slug: string, e: EventEntryLike): boolean {
  if (slug.startsWith('spring-training')) return e.category === 'spring_training'
  const keywords = EVENT_KEYWORDS[slug]
  if (!keywords || e.category !== 'mlb_special_event') return false
  const type = e.event_type?.toLowerCase() ?? ''
  return keywords.some(kw => type.includes(kw))
}

// Events that can be planned as a custom stop in the trip form.
// eventType must match an option in BaseballLifeForm's MLB_SPECIAL_EVENT_TYPES.
export const CUSTOM_EVENT_OPTIONS: { slug: string; label: string; eventType: string }[] = [
  { slug: 'banana-ball',          label: 'Banana Ball',          eventType: 'Banana Ball' },
  { slug: 'college-world-series', label: 'College baseball',     eventType: 'College Baseball' },
  { slug: 'cape-cod-league',      label: 'Cape Cod League',      eventType: 'Cape Cod Baseball' },
  { slug: 'arizona-fall-league',  label: 'Arizona Fall League',  eventType: 'Arizona Fall League' },
  { slug: 'other-event',          label: 'Other game or event',  eventType: 'Other' },
]

export function customEventType(slug: string | null | undefined): string {
  return CUSTOM_EVENT_OPTIONS.find(o => o.slug === slug)?.eventType ?? 'Other'
}

export function customEventLabel(slug: string | null | undefined): string {
  return CUSTOM_EVENT_OPTIONS.find(o => o.slug === slug)?.label ?? 'Custom event'
}
