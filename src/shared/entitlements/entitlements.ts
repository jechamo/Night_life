/**
 * Entitlements are the ONLY source of truth for what a user may do (PRD 6.13).
 * The app never asks "has this user paid?"; it asks "does this user have X?".
 * Server-side the same question is answered by `has_entitlement()` in SQL.
 */
export const ENTITLEMENT_KEYS = [
  'unlimited_likes',
  'see_likes',
  'incognito',
  'boost',
  'undo',
  'premium_themes',
  // docs/MONETIZATION.md (ADR 0008). `advanced_filters` was dropped: every filter is free.
  'travel_mode',
  'priority_likes',
  'no_sponsored_cards',
] as const
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number]

export const ENTITLEMENT_SOURCES = [
  'admin',
  'promo',
  'tester',
  'stripe',
  'apple',
  'google',
] as const
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number]

export type EntitlementStatus = 'active' | 'revoked' | 'expired'

export interface Entitlement {
  key: EntitlementKey
  source: EntitlementSource
  status: EntitlementStatus
  /** ISO-8601 UTC. */
  startsAt: string
  /** ISO-8601 UTC; null = no end (e.g. admin grant). */
  endsAt: string | null
}

/** Pure check, evaluated against an explicit clock so it is testable. */
export function hasEntitlement(
  entitlements: readonly Entitlement[],
  key: EntitlementKey,
  now: Date,
): boolean {
  const t = now.getTime()
  return entitlements.some(
    (e) =>
      e.key === key &&
      e.status === 'active' &&
      Date.parse(e.startsAt) <= t &&
      (e.endsAt === null || Date.parse(e.endsAt) > t),
  )
}
