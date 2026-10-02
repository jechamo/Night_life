/**
 * Place categories (PRD 2.2) plus "event". Keys are stable snake_case identifiers
 * shared with the database enums; labels live in i18n (`venueTypes.<key>`).
 */
export const VENUE_TYPES = [
  'nightclub', // discoteca
  'club',
  'pub',
  'bar',
  'dive_bar', // garito
  'lounge',
  'terrace', // terraza
  'beach_club',
] as const

export type VenueType = (typeof VENUE_TYPES)[number]

/** Every key that has its own accent colour (PRD 8.2): venue types + events. */
export const ACCENT_KEYS = [...VENUE_TYPES, 'event'] as const
export type AccentKey = (typeof ACCENT_KEYS)[number]
