/**
 * Allowlist of external hosts the app may send the user to (PRD 6.15 A01/API7).
 * Never navigate to a URL that does not pass `isAllowedExternalUrl`: it blocks
 * plain HTTP, credentials-in-URL tricks and look-alike hosts.
 * Every new integration must be added here AND to the third-party list (PRD 7).
 */
export const EXTERNAL_HOST_ALLOWLIST = [
  // Veriff hosted IDV (PRD 6.2, 11.3)
  { host: 'veriff.com', allowSubdomains: true },
  { host: 'veriff.me', allowSubdomains: true },
  // Yoti age / identity verification (PRD 6.2)
  { host: 'yoti.com', allowSubdomains: true },
  // Stripe Checkout and customer portal (PRD 6.13)
  { host: 'checkout.stripe.com', allowSubdomains: false },
  { host: 'billing.stripe.com', allowSubdomains: false },
  // Spotify login for the Anthem (PRD 6.1)
  { host: 'accounts.spotify.com', allowSubdomains: false },
] as const satisfies readonly { host: string; allowSubdomains: boolean }[]

export type HostRule = { host: string; allowSubdomains: boolean }

export function isAllowedExternalUrl(
  raw: string,
  allowlist: readonly HostRule[] = EXTERNAL_HOST_ALLOWLIST,
): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  const hostname = url.hostname.toLowerCase()
  return allowlist.some(
    ({ host, allowSubdomains }) =>
      hostname === host || (allowSubdomains && hostname.endsWith(`.${host}`)),
  )
}
