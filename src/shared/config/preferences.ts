/** Keys for non-sensitive local preferences (stored through the platform layer). */
export const PREFERENCE_KEYS = {
  theme: 'theme',
  reduceMotion: 'reduce_motion',
  language: 'language',
  /** Roadmap R3: venue invitation opened before signing in (cleared once used). */
  pendingVenueInvite: 'pending_venue_invite',
} as const
