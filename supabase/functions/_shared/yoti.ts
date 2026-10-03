// Yoti Age Verification (OVER only). Never return/store images, document data or age.
// Protocol: https://developers.yoti.com/age-verification/notifications
export type AgeMethod = 'facial_estimation' | 'document' | 'digital_id'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const YOTI_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAune8+8vPz/pQD6IzdWvX
Q66nh/RcywopCI01Wjo6i7vlH2iVOP1oCkgbObe12iMmVXKRiXgMNT6aXIGe6Ggw
dodzAmt3vT1fmrgub7Of6MgJ56ri2uH1O54DTjbnEbEcLXX13teOusZavntrkNpp
x1c8L0Ol41mRvImJeMHM6I16rLhqB/w1m7USMvof/K6GaP+VmmciZTPyZ6IsXxvB
k0ZoqWqrt2xENlg4O6LXMo7eHEiG+edm9uDpbZK1RhiCd6hyDZ/t4bBQNg4misFF
WezQSiUlPwBLRg1AJ3CNrtBzs49BZ30U7WSPUS0Gsq1lhhDtUtJUt4CdkDAfkVY6
2C6aaqKV940GcPFN7MjOeFus3VNJE3zyHVLT8DStuLMXHY+gQBGFOyxN6heZbm7a
Sl9fi7VXlDTlv1jpk4DFMQYF2fpAyomm95GavhllJnDxC2t8ebu0O23B88hPGI3K
kyLtPA8ie6UNmwNqLYpOEN/pwayYw75FcENBDxnWhoe9AgMBAAE=
-----END PUBLIC KEY-----`

export type AgeNotification = {
  eventId: string
  providerSessionId: string
  referenceId: string
  method: AgeMethod
  outcome: 'verified' | 'manual_review'
  threshold: number
  occurredAt: string
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Signature covers the provider payload, excluding its UNSIGNED sequence_number. */
export function notificationMessage(data: Record<string, unknown>): string {
  const payload = { ...data }
  delete payload.signature
  delete payload.sequence_number
  return JSON.stringify(payload).replace(/\s/g, '')
}

/** A public key is injectable for unit tests; handlers always use the pinned Yoti key. */
export async function verifyAgeNotification(
  data: unknown,
  publicKeyPem = YOTI_PUBLIC_KEY,
): Promise<boolean> {
  if (!record(data) || typeof data.signature !== 'string') return false
  try {
    const signature = Uint8Array.from(atob(data.signature), (c) => c.charCodeAt(0))
    const keyBytes = Uint8Array.from(atob(publicKeyPem.replace(/-----[\w ]+-----|\s/g, '')), (c) =>
      c.charCodeAt(0),
    )
    const key = await crypto.subtle.importKey(
      'spki',
      keyBytes,
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const saltLength = signature.byteLength - 32 - 2
    if (saltLength < 0) return false
    return await crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength },
      key,
      signature,
      new TextEncoder().encode(notificationMessage(data)),
    )
  } catch {
    return false
  }
}

/** Call only after signature verification; discard everything not in this allowlist. */
export function minimizeAgeNotification(data: unknown, now = Date.now()): AgeNotification | null {
  if (!record(data)) return null
  for (const key of ['id', 'session_key', 'reference_id']) {
    if (typeof data[key] !== 'string' || !UUID.test(data[key])) return null
  }
  const method =
    data.method === 'AGE_ESTIMATION'
      ? 'facial_estimation'
      : data.method === 'DOC_SCAN'
        ? 'document'
        : data.method === 'DIGITAL_ID'
          ? 'digital_id'
          : null
  if (!method || !['COMPLETE', 'FAIL', 'ERROR'].includes(String(data.state))) return null
  if (
    typeof data.timestamp !== 'number' ||
    !Number.isSafeInteger(data.timestamp) ||
    data.timestamp < 1 ||
    data.timestamp * 1000 > now + 300_000
  )
    return null
  // Sessions are OVER, so `age` is the threshold, never an actual date of birth/age.
  if (typeof data.age !== 'number' || !Number.isInteger(data.age) || data.age < 18 || data.age > 30)
    return null
  // Liveness is mandatory for facial estimation and document+selfie.
  if (data.state === 'COMPLETE' && method !== 'digital_id' && data.check_type !== 'PASSIVE')
    return null
  return {
    eventId: data.id as string,
    providerSessionId: data.session_key as string,
    referenceId: data.reference_id as string,
    method,
    outcome: data.state === 'COMPLETE' ? 'verified' : 'manual_review',
    threshold: data.age,
    occurredAt: new Date(data.timestamp * 1000).toISOString(),
  }
}

export function ageSessionRequest(input: {
  referenceId: string
  threshold: number
  method: AgeMethod
  callbackUrl: string
  webhookUrl: string
}): Record<string, unknown> {
  return {
    type: 'OVER',
    ttl: 900,
    age_estimation: {
      allowed: input.method === 'facial_estimation',
      threshold: input.threshold,
      level: 'PASSIVE',
      retry_limit: 2,
    },
    digital_id: { allowed: input.method !== 'document', threshold: 18, retry_limit: 2 },
    doc_scan: {
      allowed: true,
      threshold: 18,
      authenticity: 'AUTO',
      level: 'PASSIVE',
      retry_limit: 2,
    },
    reference_id: input.referenceId,
    callback: { auto: true, url: input.callbackUrl },
    cancel_url: input.callbackUrl,
    notification_url: input.webhookUrl,
    retry_enabled: true,
    resume_enabled: true,
    synchronous_checks: true,
  }
}
