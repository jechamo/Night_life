/**
 * Port for return URLs and deep links (PRD 3.3 point 5). External flows (Yoti,
 * Stripe, Spotify) always receive a return URL built here, so the native app can
 * swap it for a universal link / custom scheme without touching features.
 */
export interface DeepLinksService {
  buildReturnUrl(path: string, params?: Record<string, string>): string
  /** Subscribes to links opened while the app is running (native only on web: no-op). */
  onUrlOpen(handler: (url: URL) => void): () => void
}
