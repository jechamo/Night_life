import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakePlatform } from '@/platform/testing'
import { createPlatform } from './create-platform'

afterEach(() => {
  delete document.documentElement.dataset.runtime
})

describe('createPlatform (Block 11)', () => {
  it('builds the web adapters on the web without loading the native entry', async () => {
    const loadNative = vi.fn()
    const platform = await createPlatform({ appUrl: undefined, runtime: 'web', loadNative })
    expect(platform.runtime).toBe('web')
    expect(loadNative).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.runtime).toBeUndefined()
  })

  it('uses the native factory inside the Capacitor shell', async () => {
    const native = createFakePlatform({ runtime: 'native' })
    const createNativePlatform = vi.fn(() => native)
    const platform = await createPlatform({
      appUrl: 'https://app.example',
      runtime: 'native',
      loadNative: () => Promise.resolve({ createNativePlatform }),
    })
    expect(platform).toBe(native)
    expect(createNativePlatform).toHaveBeenCalledWith({ appUrl: 'https://app.example' })
    expect(document.documentElement.dataset.runtime).toBe('native')
  })

  it('never falls back to web adapters when the native shell lacks its public URL', async () => {
    const loadNative = vi.fn()
    await expect(
      createPlatform({ appUrl: undefined, runtime: 'native', loadNative }),
    ).rejects.toThrow('VITE_APP_URL')
    expect(loadNative).not.toHaveBeenCalled()
  })
})
