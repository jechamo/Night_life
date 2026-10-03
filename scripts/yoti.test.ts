// @vitest-environment node
import { expect, test } from 'vitest'
import {
  ageSessionRequest,
  minimizeAgeNotification,
  notificationMessage,
  verifyAgeNotification,
} from '../supabase/functions/_shared/yoti.ts'

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

test('signed Yoti events reject tampering, bad signatures and foreign keys', async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const exported = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))
  const pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...exported))}\n-----END PUBLIC KEY-----`
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'RSA-PSS', saltLength: 222 },
      pair.privateKey,
      new TextEncoder().encode(notificationMessage(sample)),
    ),
  )
  const signed = { ...sample, signature: btoa(String.fromCharCode(...signature)) }
  expect(await verifyAgeNotification(signed, pem)).toBe(true)
  expect(await verifyAgeNotification({ ...signed, age: 18 }, pem)).toBe(false)
  expect(await verifyAgeNotification({ ...signed, sequence_number: 500 }, pem)).toBe(true)
  expect(await verifyAgeNotification({ ...signed, signature: 'invalid' }, pem)).toBe(false)
  expect(await verifyAgeNotification(signed)).toBe(false)
})

test('only minimal OVER results survive; unknown, underage or non-live results fail closed', () => {
  const result = minimizeAgeNotification({ ...sample, selfie: 'sensitive', document: 'sensitive' })
  expect(result).toEqual({
    eventId: id,
    providerSessionId: id,
    referenceId: id,
    method: 'facial_estimation',
    threshold: 21,
    outcome: 'verified',
    occurredAt: new Date(sample.timestamp * 1000).toISOString(),
  })
  for (const changes of [
    { method: 'UNKNOWN' },
    { state: 'NEW_STATE' },
    { age: 17 },
    { check_type: 'NONE' },
    { timestamp: Number.MAX_SAFE_INTEGER },
    { reference_id: 'another user' },
  ]) {
    expect(minimizeAgeNotification({ ...sample, ...changes })).toBeNull()
  }
  expect(minimizeAgeNotification({ ...sample, state: 'FAIL' })?.outcome).toBe('manual_review')
})

test('reverification permits only document proof at 18 with passive liveness', () => {
  const request = ageSessionRequest({
    referenceId: id,
    threshold: 21,
    method: 'document',
    callbackUrl: 'https://nightlife.example/verification',
    webhookUrl: 'https://backend.example/webhook',
  })
  expect(request.type).toBe('OVER')
  expect(request.doc_scan).toMatchObject({ threshold: 18, level: 'PASSIVE', allowed: true })
  expect(request.age_estimation).toMatchObject({ allowed: false })
  expect(request.digital_id).toMatchObject({ allowed: false })
  expect(request).not.toHaveProperty('user_id')
  expect(request).not.toHaveProperty('birthdate')
})
