import {
  hmacHex,
  minimizeVeriffDecision,
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

Deno.test('HMAC matches Veriff hex digest and rejects tampering', async () => {
  const body = JSON.stringify(approved)
  const signature = await hmacHex(secret, body)
  assert(await verifyVeriffSignature(body, signature, secret))
  assert(!(await verifyVeriffSignature(body, signature, 'other-secret')))
  assert(!(await verifyVeriffSignature(` ${body}`, signature, secret)))
  assert(timingSafeEqual(signature, signature))
  assert(!timingSafeEqual(signature, signature.replace(/.$/, '0')))
})

Deno.test('Decision is minimized: no name, document, selfie or date of birth', () => {
  const result = minimizeVeriffDecision(approved)
  assert(result?.outcome === 'verified' && result.overThreshold && result.identityOk)
  assert(result.providerSessionId === sessionId && result.referenceId === referenceId)
  assert(result.eventId === attemptId)
  assert(!('person' in result) && !('document' in result) && !('dateOfBirth' in result))
  assert(
    minimizeVeriffDecision({
      ...approved,
      verification: { ...approved.verification, status: 'declined' },
    })?.outcome === 'failed',
  )
  assert(
    minimizeVeriffDecision({
      ...approved,
      verification: { ...approved.verification, status: 'resubmission_requested' },
    })?.outcome === 'inconclusive',
  )
  assert(minimizeVeriffDecision({ verification: { id: sessionId, status: 'approved' } }) === null)
  assert(yearsSince('1967-03-30', Date.parse('2024-11-06T00:00:00Z')) === 57)
  assert(
    minimizeVeriffDecision({
      ...approved,
      verification: {
        ...approved.verification,
        person: { dateOfBirth: '2015-01-01' },
      },
    })?.overThreshold === false,
  )
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
