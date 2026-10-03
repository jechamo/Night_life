import {
  ageSessionRequest,
  minimizeAgeNotification,
  notificationMessage,
  verifyAgeNotification,
} from './yoti.ts'

function assert(value: unknown, message = 'assertion failed'): asserts value {
  if (!value) throw new Error(message)
}

const id = '00000000-0000-4000-8000-000000000001'
const sample = {
  id,
  session_key: id,
  reference_id: id,
  method: 'AGE_ESTIMATION',
  age: 21,
  state: 'COMPLETE',
  timestamp: Math.floor(Date.now() / 1000),
  check_type: 'PASSIVE',
  sequence_number: 1,
}

Deno.test(
  'Yoti signature: authentic payload, tampering, unsigned sequence, malformed signature',
  async () => {
    const key = await crypto.subtle.generateKey(
      {
        name: 'RSA-PSS',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )
    const exported = new Uint8Array(await crypto.subtle.exportKey('spki', key.publicKey))
    const pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...exported))}\n-----END PUBLIC KEY-----`
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        { name: 'RSA-PSS', saltLength: 222 },
        key.privateKey,
        new TextEncoder().encode(notificationMessage(sample)),
      ),
    )
    const signed = { ...sample, signature: btoa(String.fromCharCode(...signature)) }
    assert(await verifyAgeNotification(signed, pem))
    assert(!(await verifyAgeNotification({ ...signed, state: 'FAIL' }, pem)))
    assert(await verifyAgeNotification({ ...signed, sequence_number: 999 }, pem))
    assert(!(await verifyAgeNotification({ ...signed, signature: 'invalid' }, pem)))
    assert(!(await verifyAgeNotification(signed))) // Our fixture must not verify against Yoti's key.
  },
)

Deno.test(
  'Yoti result: minimize fields, reject unknown methods/states and missing liveness',
  () => {
    const result = minimizeAgeNotification({
      ...sample,
      document: 'never persisted',
      selfie: 'never persisted',
    })
    assert(result?.outcome === 'verified' && result.method === 'facial_estimation')
    assert(!('document' in result) && !('selfie' in result) && !('age' in result))
    assert(minimizeAgeNotification({ ...sample, method: 'UNKNOWN' }) === null)
    assert(minimizeAgeNotification({ ...sample, state: 'NEW_PROVIDER_STATE' }) === null)
    assert(minimizeAgeNotification({ ...sample, check_type: 'NONE' }) === null)
    assert(minimizeAgeNotification({ ...sample, timestamp: Number.MAX_SAFE_INTEGER }) === null)
    assert(minimizeAgeNotification({ ...sample, reference_id: 'another account' }) === null)
    assert(minimizeAgeNotification({ ...sample, age: 17 }) === null)
    assert(minimizeAgeNotification({ ...sample, state: 'FAIL' })?.outcome === 'manual_review')
  },
)

Deno.test(
  'Session uses OVER, document threshold 18, passive liveness and only a random reference',
  () => {
    const request = ageSessionRequest({
      referenceId: id,
      threshold: 21,
      method: 'document',
      callbackUrl: 'https://nightlife.example/verification',
      webhookUrl: 'https://backend.example/webhook',
    })
    assert(request.type === 'OVER')
    assert((request.doc_scan as Record<string, unknown>).threshold === 18)
    assert((request.age_estimation as Record<string, unknown>).allowed === false)
    assert((request.digital_id as Record<string, unknown>).allowed === false)
    assert(!('birthdate' in request) && !('user_id' in request))
  },
)
