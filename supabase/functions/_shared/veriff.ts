// Veriff IDV (document + selfie). Never return/store images, names, IDs or dates of birth.
// Protocol: https://devdocs.veriff.com/docs/hmac-authentication-and-endpoint-security
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_BASE = 'https://api-saas.veriff.com'

export type VeriffDecision = {
  eventId: string
  providerSessionId: string
  referenceId: string
  outcome: 'verified' | 'failed' | 'manual_review' | 'inconclusive' | 'expired'
  overThreshold: boolean
  identityOk: boolean
  occurredAt: string
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function veriffBaseUrl(raw = DEFAULT_BASE): string {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return DEFAULT_BASE
    if (url.hostname !== 'api-saas.veriff.com' && url.hostname !== 'stationapi.veriff.com')
      return DEFAULT_BASE
    return url.origin
  } catch {
    return DEFAULT_BASE
  }
}

export async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  )
  return [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return mismatch === 0
}

export async function verifyVeriffSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false
  const expected = await hmacHex(secret, rawBody)
  return timingSafeEqual(header.trim().toLowerCase(), expected)
}

export function yearsSince(isoDate: string, now = Date.now()): number | null {
  const match = DATE.exec(isoDate)
  if (!match) return null
  const year = Number(match[0].slice(0, 4))
  const month = Number(match[0].slice(5, 7))
  const day = Number(match[0].slice(8, 10))
  const birth = Date.UTC(year, month - 1, day)
  if (!Number.isFinite(birth) || birth > now) return null
  const current = new Date(now)
  let age = current.getUTCFullYear() - year
  if (
    current.getUTCMonth() + 1 < month ||
    (current.getUTCMonth() + 1 === month && current.getUTCDate() < day)
  )
    age -= 1
  return age
}

function outcomeFor(status: string): VeriffDecision['outcome'] | null {
  if (status === 'approved') return 'verified'
  if (status === 'declined') return 'failed'
  if (status === 'review') return 'manual_review'
  if (status === 'resubmission_requested') return 'inconclusive'
  if (status === 'expired' || status === 'abandoned') return 'expired'
  return null
}

function eventUuid(
  sessionId: string,
  attemptId: string,
  status: string,
  occurredAt: string,
): string {
  if (UUID.test(attemptId)) return attemptId
  const seed = `${sessionId}:${status}:${occurredAt}`
  const hex = [...new TextEncoder().encode(seed)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .padEnd(32, '0')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** Call only after HMAC verification. Date of birth is used in memory and discarded. */
export function minimizeVeriffDecision(
  data: unknown,
  threshold = 18,
  now = Date.now(),
): VeriffDecision | null {
  if (!record(data) || !record(data.verification)) return null
  const verification = data.verification
  const sessionId = verification.id
  const vendorData = verification.vendorData
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) return null
  if (typeof vendorData !== 'string' || !UUID.test(vendorData)) return null
  const outcome = outcomeFor(String(verification.status ?? ''))
  if (!outcome) return null
  const occurredAt =
    typeof verification.decisionTime === 'string' &&
    !Number.isNaN(Date.parse(verification.decisionTime))
      ? verification.decisionTime
      : null
  if (!occurredAt || Date.parse(occurredAt) > now + 300_000) return null
  const person = record(verification.person) ? verification.person : null
  const dob = person && typeof person.dateOfBirth === 'string' ? person.dateOfBirth : null
  const age = dob ? yearsSince(dob, now) : null
  const overThreshold = outcome === 'verified' && age !== null && age >= threshold
  const identityOk = outcome === 'verified'
  return {
    eventId: eventUuid(
      sessionId,
      String(verification.attemptId ?? ''),
      String(verification.status),
      occurredAt,
    ),
    providerSessionId: sessionId,
    referenceId: vendorData,
    outcome,
    overThreshold,
    identityOk,
    occurredAt,
  }
}

export function veriffSessionRequest(input: {
  referenceId: string
  callbackUrl: string
}): Record<string, unknown> {
  return {
    verification: {
      callback: input.callbackUrl,
      vendorData: input.referenceId,
    },
  }
}

export function parseVeriffSession(data: unknown): { id: string; url: string } | null {
  if (!record(data) || !record(data.verification)) return null
  const { id, url } = data.verification
  if (typeof id !== 'string' || !UUID.test(id) || typeof url !== 'string') return null
  return { id, url }
}

export async function deleteVeriffSession(input: {
  baseUrl: string
  apiKey: string
  secret: string
  sessionId: string
}): Promise<void> {
  const signature = await hmacHex(input.secret, input.sessionId)
  await fetch(`${input.baseUrl}/v1/sessions/${input.sessionId}`, {
    method: 'DELETE',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'X-AUTH-CLIENT': input.apiKey,
      'X-HMAC-SIGNATURE': signature,
    },
  }).catch(() => undefined)
}
