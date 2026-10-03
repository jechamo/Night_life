// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest'
import {
  deleteVeriffSession,
  hmacHex,
  minimizeVeriffDecision,
  parseVeriffSession,
  shouldDeleteVeriffSession,
  verifyVeriffSignature,
  veriffSessionRequest,
  yearsSince,
} from '../supabase/functions/_shared/veriff.ts'

afterEach(() => vi.unstubAllGlobals())

test.each([200, 403])('Cleanup reports HTTP %i instead of hiding failure', async (status) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })))
  expect(
    await deleteVeriffSession({
      baseUrl: 'https://api-saas.veriff.com',
      apiKey: 'test',
      secret: 'test',
      sessionId: 'test',
    }),
  ).toBe(status)
})

test('Cleanup network failure remains pending without reading provider data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  expect(
    await deleteVeriffSession({
      baseUrl: 'https://api-saas.veriff.com',
      apiKey: 'test',
      secret: 'test',
      sessionId: 'test',
    }),
  ).toBe(0)
})

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
const variant = (patch: Record<string, unknown>) => ({
  ...approved,
  verification: { ...approved.verification, ...patch },
})

test('Veriff HMAC rejects a tampered body', async () => {
  const body = JSON.stringify(approved)
  const signature = await hmacHex(secret, body)
  await expect(verifyVeriffSignature(body, signature, secret)).resolves.toBe(true)
  await expect(verifyVeriffSignature(`${body} `, signature, secret)).resolves.toBe(false)
})

test('Veriff decisions keep only booleans and identifiers', async () => {
  const result = await minimizeVeriffDecision(approved)
  expect(result).toMatchObject({
    providerSessionId: sessionId,
    referenceId,
    outcome: 'verified',
    overThreshold: true,
    identityOk: true,
  })
  expect(result?.eventId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  expect(result && 'dateOfBirth' in result).toBe(false)
  expect(yearsSince('2010-01-01', Date.parse('2026-01-01T00:00:00Z'))).toBe(16)
})

test('An approved document of a minor is a negative decision', async () => {
  const minor = await minimizeVeriffDecision(variant({ person: { dateOfBirth: '2015-01-01' } }))
  expect(minor).toMatchObject({ outcome: 'failed', overThreshold: false, identityOk: false })
})

test('Invalid calendar dates never provide age proof', async () => {
  for (const dateOfBirth of ['2000-02-31', '2000-13-01', '2000-00-01', '2000-01-00']) {
    expect(yearsSince(dateOfBirth)).toBeNull()
    const result = await minimizeVeriffDecision(variant({ person: { dateOfBirth } }))
    expect(result?.overThreshold).toBe(false)
    expect(result && shouldDeleteVeriffSession(result)).toBe(false)
  }
  expect(yearsSince('2000-02-29', Date.parse('2026-03-01T00:00:00Z'))).toBe(26)
})

test('Review and approval of the same attempt are distinct events', async () => {
  const review = await minimizeVeriffDecision(
    variant({ status: 'review', decisionTime: '2024-11-06T07:10:00.000Z' }),
  )
  const final = await minimizeVeriffDecision(approved)
  const again = await minimizeVeriffDecision(approved)
  expect(review?.eventId).not.toBe(final?.eventId)
  expect(final?.eventId).toBe(again?.eventId)
})

test('Only final outcomes delete the Veriff session', async () => {
  const decide = async (patch: Record<string, unknown>) => {
    const event = await minimizeVeriffDecision(variant(patch))
    if (!event) throw new Error('unparsed')
    return shouldDeleteVeriffSession(event)
  }
  expect(await decide({})).toBe(true)
  expect(await decide({ status: 'expired' })).toBe(true)
  expect(await decide({ status: 'review' })).toBe(false)
  expect(await decide({ status: 'declined' })).toBe(false)
  expect(await decide({ person: {} })).toBe(false)
})

test('Provider evidence is deleted only for a persisted final decision of that level', async () => {
  const identity = await minimizeVeriffDecision(variant({ person: {} }))
  if (!identity) throw new Error('unparsed')
  expect(shouldDeleteVeriffSession(identity, 'verified')).toBe(true)
  expect(shouldDeleteVeriffSession(identity, 'manual_review')).toBe(false)
  expect(shouldDeleteVeriffSession(identity, 'failed')).toBe(false)
  const expired = await minimizeVeriffDecision(variant({ status: 'expired' }))
  if (!expired) throw new Error('unparsed')
  expect(shouldDeleteVeriffSession(expired, 'expired')).toBe(true)
  expect(shouldDeleteVeriffSession(expired, 'verified')).toBe(false)
})

test('Only HTTPS Veriff redirect URLs reach the browser', () => {
  const session = (url: string) => ({ verification: { id: sessionId, url } })
  expect(parseVeriffSession(session('https://alchemy.veriff.com/v/abc'))?.id).toBe(sessionId)
  expect(parseVeriffSession(session('https://magic.veriff.me/v/abc'))).not.toBeNull()
  expect(parseVeriffSession(session('http://alchemy.veriff.com/v/abc'))).toBeNull()
  expect(parseVeriffSession(session('https://veriff.com.evil.example/v'))).toBeNull()
  expect(parseVeriffSession(session('https://evilveriff.com/v'))).toBeNull()
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
