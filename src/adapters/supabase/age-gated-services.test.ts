import { expect, test, vi } from 'vitest'
import { UNVERIFIED } from '@/features/verification/model/verification'
import { createMockServices } from '@/mocks/mock-services'
import { withPersistedAgeGate } from './age-gated-services'
import { parseVerificationSnapshot } from './verification'

test('direct preview-service calls recheck the persisted result after revocation or outage', async () => {
  const base = createMockServices()
  const candidates = vi.spyOn(base.matching, 'candidates').mockResolvedValue([])
  const snapshot = vi.fn().mockResolvedValue({
    ...UNVERIFIED,
    age: { state: 'verified', verifiedAt: '2026-10-03T12:00:00Z' },
  })
  const gated = withPersistedAgeGate(base, { ...base.verification, getSnapshot: snapshot })
  await expect(gated.matching.candidates(null)).resolves.toEqual([])
  snapshot.mockResolvedValue(UNVERIFIED)
  await expect(gated.matching.candidates(null)).rejects.toThrow('not_verified')
  snapshot.mockRejectedValue(new Error('offline'))
  await expect(gated.matching.candidates(null)).rejects.toThrow('offline')
  expect(candidates).toHaveBeenCalledTimes(1)
  expect(snapshot).toHaveBeenCalledTimes(3)
})

test('malformed or missing provider states cannot become verified', () => {
  expect(parseVerificationSnapshot(UNVERIFIED)).toEqual(UNVERIFIED)
  for (const age of [
    { state: 'COMPLETE' },
    { state: 'verified' },
    { state: 'verified', verifiedAt: 'invalid' },
  ]) {
    expect(() => parseVerificationSnapshot({ ...UNVERIFIED, age })).toThrow()
  }
})
