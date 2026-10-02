import type { Result } from '@/shared/lib/result'

export type ExternalFlowError = 'host_not_allowed' | 'failed'

/**
 * Port for external flows (Yoti, Stripe, Spotify). Web: full-page redirect with
 * a return URL. Native (Annex B): in-app browser + deep link back.
 */
export interface InAppBrowserService {
  openExternalFlow(url: string): Promise<Result<void, ExternalFlowError>>
}
