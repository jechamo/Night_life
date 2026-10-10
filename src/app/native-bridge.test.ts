import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakePlatform } from '@/platform/testing'
import { connectNativeBridge } from './native-bridge'

afterEach(() => window.history.replaceState(null, ''))

function setup() {
  let openUrl: (url: URL) => void = () => undefined
  let back: () => void = () => undefined
  const exit = vi.fn()
  const stopLinks = vi.fn()
  const stopBack = vi.fn()
  const platform = createFakePlatform({
    deepLinks: {
      buildReturnUrl: () => '',
      onUrlOpen: (handler) => {
        openUrl = handler
        return stopLinks
      },
    },
    appState: {
      onActiveChange: () => () => undefined,
      onBackButton: (handler) => {
        back = handler
        return stopBack
      },
      exit,
    },
  })
  const router = { navigate: vi.fn() }
  const disconnect = connectNativeBridge(platform, router)
  return {
    openUrl: (url: string) => openUrl(new URL(url)),
    back: () => back(),
    exit,
    router,
    disconnect,
    stopLinks,
    stopBack,
  }
}

describe('connectNativeBridge (Block 11)', () => {
  it('routes opened links inside the app', () => {
    const bridge = setup()
    bridge.openUrl('https://app.example/premium/return?status=success')
    expect(bridge.router.navigate).toHaveBeenCalledWith('/premium/return?status=success')
  })

  it('goes back in history and leaves the app on the first screen', () => {
    const bridge = setup()
    window.history.replaceState({ idx: 2 }, '')
    bridge.back()
    expect(bridge.router.navigate).toHaveBeenCalledWith(-1)
    window.history.replaceState({ idx: 0 }, '')
    bridge.back()
    expect(bridge.exit).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes both listeners', () => {
    const bridge = setup()
    bridge.disconnect()
    expect(bridge.stopLinks).toHaveBeenCalled()
    expect(bridge.stopBack).toHaveBeenCalled()
  })
})
