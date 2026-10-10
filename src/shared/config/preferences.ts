/** Keys for non-sensitive local preferences (stored through the platform layer). */
export const PREFERENCE_KEYS = {
  theme: 'theme',
  reduceMotion: 'reduce_motion',
  language: 'language',
  /** Roadmap R3: venue invitation opened before signing in (cleared once used). */
  pendingVenueInvite: 'pending_venue_invite',
  /** Block 11: ask for Face ID / fingerprint on open and on return ('on' or absent). */
  biometricLock: 'biometric_lock',
} as const
