import { describe, expect, it } from 'vitest'
import {
  isInviteCode,
  isTaxId,
  normalizeInviteCode,
  normalizeTaxId,
  venuePartnerStateSchema,
} from './partners'

describe('roadmap R3: partner model', () => {
  it('accepts Spanish CIF, NIF and NIE like the database check', () => {
    for (const ok of ['B12345678', 'b-1234567-8', '12345678Z', 'X1234567L', 'A1234567J'])
      expect(isTaxId(ok)).toBe(true)
    for (const bad of ['', '1234', 'I12345678', 'B1234567', 'ZZ1234567'])
      expect(isTaxId(bad)).toBe(false)
    expect(normalizeTaxId(' b-12.345.678 ')).toBe('B12345678')
  })

  it('normalises invitation codes typed in any form', () => {
    expect(normalizeInviteCode('abcd1234ef09')).toBe('ABCD-1234-EF09')
    expect(normalizeInviteCode(' abcd-1234-ef09 ')).toBe('ABCD-1234-EF09')
    expect(isInviteCode('abcd 1234 ef09')).toBe(true)
    expect(isInviteCode('ABCD-1234')).toBe(false)
    expect(isInviteCode('GHIJ-1234-EF09')).toBe(false)
  })

  it('drops unknown advantages instead of failing', () => {
    const state = venuePartnerStateSchema.parse({
      role: 'owner',
      account: { legalName: 'Noches SL' },
      contract: null,
      benefits: [
        { key: 'sponsor_top', source: 'contract', from: '2026-10-01', until: '2027-01-01' },
        { key: 'future_perk', source: 'contract', from: null, until: null },
        { key: 'pro_stats', source: 'barter', from: null, until: null },
      ],
      termsCurrent: '1.0',
      termsAccepted: true,
    })
    expect(state.benefits).toEqual([
      { key: 'sponsor_top', source: 'contract', from: '2026-10-01', until: '2027-01-01' },
    ])
  })
})
