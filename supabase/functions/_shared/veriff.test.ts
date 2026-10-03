import {
  hmacHex,
  minimizeVeriffDecision,
  parseVeriffSession,
  shouldDeleteVeriffSession,
  timingSafeEqual,
  verifyVeriffSignature,
  veriffSessionRequest,
  yearsSince,
} from './veriff.ts'

function assert(value: unknown, message = 'assertion failed'): asserts value {
  if (!value) throw new Error(message)
}

const sessionId = '12df6045-3846-3e45-946a-14fa6136d78b'
const attemptId = '00bca969-b53a-4fad-b065-874d41a7b2b8'
const referenceId = '00000000-0000-4000-8000-000000000001'
const secret = 'abcdef12-abcd-abcd-abcd-abcdef012345'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/

const approved = {
  status: 'success',
  verification: {
    id: sessionId,
    attemptId,
    vendorData: referenceId,
    status: 'approved',
    decisionTime: '2024-11-06T07:17:36.916Z',
    person: {
      firstName: 'never stored',
      lastName: 'never stored',
      dateOfBirth: '1967-03-30',
      idNumber: 'never stored',
    },
    document: { number: 'never stored', type: 'PASSPORT' },
  },
}

function variant(patch: Record<string, unknown>) {
  return { ...approved, verification: { ...approved.verification, ...patch } }
}

Deno.test('HMAC matches Veriff hex digest and rejects tampering', async () => {
  const body = JSON.stringify(approved)
  const signature = await hmacHex(secret, body)
  assert(await verifyVeriffSignature(body, signature, secret))
  assert(!(await verifyVeriffSignature(body, signature, 'other-secret')))
  assert(!(await verifyVeriffSignature(` ${body}`, signature, secret)))
  assert(timingSafeEqual(signature, signature))
  assert(!timingSafeEqual(signature, signature.replace(/.$/, '0')))
})

Deno.test('Decision is minimized: no name, document, selfie or date of birth', async () => {
  const result = await minimizeVeriffDecision(approved)
  assert(result?.outcome === 'verified' && result.overThreshold && result.identityOk)
  assert(result.providerSessionId === sessionId && result.referenceId === referenceId)
  assert(UUID.test(result.eventId))
  assert(!('person' in result) && !('document' in result) && !('dateOfBirth' in result))
  assert((await minimizeVeriffDecision(variant({ status: 'declined' })))?.outcome === 'failed')
  assert(
    (await minimizeVeriffDecision(variant({ status: 'resubmission_requested' })))?.outcome ===
      'inconclusive',
  )
  assert(
    (await minimizeVeriffDecision({ verification: { id: sessionId, status: 'approved' } })) ===
      null,
  )
  assert(yearsSince('1967-03-30', Date.parse('2024-11-06T00:00:00Z')) === 57)
})

Deno.test('Approved document of a minor is a negative decision', async () => {
  const minor = await minimizeVeriffDecision(variant({ person: { dateOfBirth: '2015-01-01' } }))
  assert(minor?.outcome === 'failed' && !minor.overThreshold && !minor.identityOk)
})

Deno.test('Approved without date of birth carries no age proof', async () => {
  const missing = await minimizeVeriffDecision(variant({ person: {} }))
  assert(missing?.outcome === 'verified' && !missing.overThreshold)
  assert(!shouldDeleteVeriffSession(missing))
})

Deno.test('Each decision of the same attempt has its own idempotency key', async () => {
  const review = await minimizeVeriffDecision(
    variant({ status: 'review', decisionTime: '2024-11-06T07:10:00.000Z' }),
  )
  const final = await minimizeVeriffDecision(approved)
  const again = await minimizeVeriffDecision(approved)
  const otherSession = await minimizeVeriffDecision(
    variant({ id: '12df6045-3846-3e45-946a-14fa6136d78c' }),
  )
  assert(review && final && again && otherSession)
  assert(review.eventId !== final.eventId)
  assert(final.eventId === again.eventId)
  assert(final.eventId !== otherSession.eventId)
})

Deno.test('Only final outcomes delete the provider session', async () => {
  const final = await minimizeVeriffDecision(approved)
  const review = await minimizeVeriffDecision(variant({ status: 'review' }))
  const declined = await minimizeVeriffDecision(variant({ status: 'declined' }))
  const expired = await minimizeVeriffDecision(variant({ status: 'expired' }))
  assert(final && review && declined && expired)
  assert(shouldDeleteVeriffSession(final) && shouldDeleteVeriffSession(expired))
  assert(!shouldDeleteVeriffSession(review) && !shouldDeleteVeriffSession(declined))
})

Deno.test('Session request only sends callback and our session id', () => {
  const request = veriffSessionRequest({
    referenceId,
    callbackUrl: 'https://nightlife-connect-beige.vercel.app/profile/verification?level=age',
  })
  const verification = request.verification as Record<string, unknown>
  assert(verification.vendorData === referenceId)
  assert(!('person' in verification) && !('endUserId' in verification))
})

Deno.test('Only HTTPS Veriff redirect URLs are accepted', () => {
  const session = (url: string) => ({ verification: { id: sessionId, url } })
  assert(parseVeriffSession(session('https://alchemy.veriff.com/v/abc'))?.id === sessionId)
  assert(parseVeriffSession(session('https://magic.veriff.me/v/abc')))
  assert(parseVeriffSession(session('http://alchemy.veriff.com/v/abc')) === null)
  assert(parseVeriffSession(session('https://veriff.com.evil.example/v/abc')) === null)
  assert(parseVeriffSession(session('https://evilveriff.com/v/abc')) === null)
  assert(parseVeriffSession(session('not a url')) === null)
})
