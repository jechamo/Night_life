import { err, ok } from '@/shared/lib/result'
import { createWebDeepLinks } from './deep-links/deep-links.web'
import type { Platform } from './platform'
import { createMemoryPreferences } from './preferences/preferences.memory'

/** Deterministic platform for unit/component tests. Override any service per test. */
export function createFakePlatform(overrides: Partial<Platform> = {}): Platform {
  const preferences = createMemoryPreferences()
  const updateState = { online: true, updateAvailable: false }
  return {
    runtime: 'web',
    appUpdates: {
      getSnapshot: () => updateState,
      subscribe: () => () => undefined,
      start: () => undefined,
      stop: () => undefined,
      applyUpdate: () => undefined,
    },
    appState: {
      onActiveChange: () => () => undefined,
      onBackButton: () => () => undefined,
      exit: () => undefined,
    },
    audio: { playTestSample: () => Promise.resolve(ok(undefined)), stop: () => {} },
    geolocation: {
      checkPermission: () => Promise.resolve('prompt'),
      getCurrentPosition: () => Promise.resolve(err('unsupported')),
    },
    camera: {
      pickPhoto: () => Promise.resolve(err('unsupported')),
      openLiveStream: () => Promise.resolve(err('unsupported')),
      canDetectQr: () => false,
      detectQr: () => Promise.resolve(null),
    },
    haptics: {
      isSupported: false,
      impact: () => undefined,
      notify: () => undefined,
      selection: () => undefined,
    },
    secureStorage: {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    },
    preferences,
    share: { share: () => Promise.resolve(ok('copied')) },
    deviceId: { getDeviceId: () => Promise.resolve('test-device') },
    biometrics: {
      isAvailable: () => Promise.resolve(false),
      authenticate: () => Promise.resolve(err('unavailable')),
    },
    notifications: {
      getPermission: () => Promise.resolve('unsupported'),
      requestPermission: () => Promise.resolve('unsupported'),
    },
    // Pure URL building, safe to reuse from the web adapter.
    deepLinks: createWebDeepLinks('https://app.test'),
    browser: { openExternalFlow: () => Promise.resolve(ok(undefined)) },
    files: {
      downloadJson: () => Promise.resolve(ok(undefined)),
      downloadBlob: () => Promise.resolve(ok(undefined)),
    },
    images: {
      sanitize: (file) => Promise.resolve(ok(file)),
      createPreviewUrl: () => 'blob:test-preview',
      revokePreviewUrl: () => undefined,
    },
    ...overrides,
  }
}
