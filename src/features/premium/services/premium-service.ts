import type { Result } from '@/shared/lib/result'
import type { CreditKind, ProductCode, Subscription } from '../model/catalog'
import type { Match } from '@/features/matching/services/matching-service'

export interface PremiumSocialState {
  incognito: boolean
  spotlightUntil: string | null
  sparksUnread: number
}
export type SocialPurchaseError =
  | 'no_credits'
  | 'limit_reached'
  | 'already_active'
  | 'wrong_place'
  | 'unavailable'
  | 'already_matched'
export type VenueProductCode =
  'sponsor_featured' | 'sponsor_featured_plus' | 'sponsor_top' | 'venue_pro_monthly'

export interface Invoice {
  orderId?: string | null
  id: string
  productCode: ProductCode
  amountCents: number
  issuedAt: string
  status: 'paid' | 'refunded'
}

export interface PremiumState {
  subscription: Subscription | null
  /** One-night pass end (06:00) if active. */
  oneNightUntil: string | null
  credits: Record<CreditKind, number>
  invoices: readonly Invoice[]
  notifyMe: boolean
}

export type PurchaseRedirect =
  { type: 'external'; url: string } | { type: 'internal'; path: string }
export type PurchaseError =
  'payments_disabled' | 'not_allowed' | 'already_subscribed' | 'gateway_error'
export type RedeemError = 'invalid' | 'expired' | 'used' | 'rate_limited'
export type PaidDmError = 'disabled' | 'no_credits' | 'red_light'

/**
 * Port for purchases (PRD 6.13, ADR 0008). The provider (Stripe web / stores) is chosen
 * server-side; entitlements are only granted by verified webhooks, never by the client.
 */
export interface PremiumService {
  getState(): Promise<PremiumState>
  purchaseStatus(id: string): Promise<'pending' | 'paid' | 'refunded' | 'expired'>
  portal(venueId?: string): Promise<string>
  getSocialState?(): Promise<PremiumSocialState>
  setIncognito?(on: boolean): Promise<PremiumSocialState>
  markSparksSeen?(): Promise<PremiumSocialState>
  sendSpark?(
    personId: string,
  ): Promise<Result<{ usedToday: number; match: Match | null }, SocialPurchaseError>>
  activateSpotlight?(
    placeId: string | null,
  ): Promise<Result<PremiumSocialState, SocialPurchaseError>>
  startVenuePurchase?(
    code: VenueProductCode,
    venueId: string,
    from?: string,
  ): Promise<Result<PurchaseRedirect, PurchaseError>>
  startPurchase(code: ProductCode): Promise<Result<PurchaseRedirect, PurchaseError>>
  /** Explicit persisted simulator; separate from Stripe test-card checkout. */
  completeTestPurchase(code: ProductCode): Promise<PremiumState>
  cancel(): Promise<PremiumState>
  resume(): Promise<PremiumState>
  withdraw(orderId?: string): Promise<Result<PremiumState, 'window_closed'>>
  redeem(code: string): Promise<Result<{ productCode: ProductCode; days: number }, RedeemError>>
  setNotifyMe(on: boolean): Promise<PremiumState>
  sendPaidDm(personId: string, text: string): Promise<Result<void, PaidDmError>>
}
