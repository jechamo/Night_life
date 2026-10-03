import { describe, expect, it } from 'vitest'
import { createFlagService } from './flag-service'
import { INITIAL_FLAG_VALUES, parseFlags, SAFE_FLAG_DEFAULTS } from './flags'

describe('parseFlags', () => {
  it('accepts a valid set', () => {
    expect(parseFlags(INITIAL_FLAG_VALUES)).toEqual(INITIAL_FLAG_VALUES)
  })

  it('falls back closed for non-object input', () => {
    expect(parseFlags(null)).toEqual(SAFE_FLAG_DEFAULTS)
    expect(parseFlags('payments_mode=live')).toEqual(SAFE_FLAG_DEFAULTS)
  })

  it('resets only the invalid flag to its safe default', () => {
    const flags = parseFlags({ ...INITIAL_FLAG_VALUES, payments_mode: 'free-for-all' })
    expect(flags.payments_mode).toBe('disabled')
    expect(flags.payments_audience).toBe('testers')
  })

  it('treats missing flags as closed', () => {
    const flags = parseFlags({ premium_enabled: 'on' })
    expect(flags.premium_enabled).toBe('on')
    expect(flags.test_tools_enabled).toBe('off')
    expect(flags.verification_mode).toBe('live')
    expect(flags.verification_provider).toBe('simulator')
  })
})

describe('flag service', () => {
  it('never throws: a failing source yields safe defaults', async () => {
    const service = createFlagService({ load: () => Promise.reject(new Error('network')) })
    await expect(service.getAll()).resolves.toEqual(SAFE_FLAG_DEFAULTS)
  })
})
