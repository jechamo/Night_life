/**
 * Consents asked during onboarding / settings (PRD 6.1 table). Every one starts
 * OFF (no pre-ticked boxes) and can be revoked as easily as it was given.
 * Age verification, photo/identity verification, background location, push and
 * Spotify are asked in context, not here.
 */
export const ONBOARDING_CONSENTS = [
  'orientation',
  'precise_location',
  'marketing',
  'analytics',
] as const
export type ConsentKey = (typeof ONBOARDING_CONSENTS)[number]

export interface ConsentDefinition {
  key: ConsentKey
  /** Art. 9 GDPR special category: needs an explicit, signed confirmation. */
  special: boolean
}

export const CONSENT_DEFINITIONS: readonly ConsentDefinition[] = [
  { key: 'orientation', special: true },
  { key: 'precise_location', special: false },
  { key: 'marketing', special: false },
  { key: 'analytics', special: false },
]

export type ConsentChoices = Record<ConsentKey, boolean>

/** Privacy by default (PRD 1): nothing is granted until the user says so. */
export const DEFAULT_CONSENTS: Readonly<ConsentChoices> = {
  orientation: false,
  precise_location: false,
  marketing: false,
  analytics: false,
}
