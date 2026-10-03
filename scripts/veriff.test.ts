// @vitest-environment node
import { expect, test } from 'vitest'
import {
  hmacHex,
  minimizeVeriffDecision,
  verifyVeriffSignature,
  veriffSessionRequest,
  yearsSince,
} from '../supabase/functions/_shared/veriff.ts'

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
    person: { firstName: 'never stored', dateOfBirth: '1967-03-30', idNumber: 'x' },
    document: { number: 'never stored' },
  },
}

test('Veriff HMAC rejects a tampered body', async () => {
  const body = JSON.stringify(approved)
  const signature = await hmacHex(secret, body)
  await expect(verifyVeriffSignature(body, signature, secret)).resolves.toBe(true)
  await expect(verifyVeriffSignature(`${body} `, signature, secret)).resolves.toBe(false)
})

test('Veriff decisions keep only booleans and identifiers', () => {
  const result = minimizeVeriffDecision(approved)
  expect(result).toMatchObject({
    eventId: attemptId,
    providerSessionId: sessionId,
    referenceId,
    outcome: 'verified',
    overThreshold: true,
    identityOk: true,
  })
  expect(result && 'dateOfBirth' in result).toBe(false)
  expect(yearsSince('2010-01-01', Date.parse('2026-01-01T00:00:00Z'))).toBe(16)
  expect(
    minimizeVeriffDecision({
      ...approved,
      verification: { ...approved.verification, person: { dateOfBirth: '2010-01-01' } },
    })?.overThreshold,
  ).toBe(false)
})

test('Veriff session request never includes personal fields', () => {
  expect(
    veriffSessionRequest({
      referenceId,
      callbackUrl: 'https://nightlife-connect-beige.vercel.app/profile/verification',
    }),
  ).toEqual({
    verification: {
      callback: 'https://nightlife-connect-beige.vercel.app/profile/verification',
      vendorData: referenceId,
    },
  })
})
