import { beforeEach, describe, expect, it, vi } from 'vitest'

// Plugin doubles: each test drives the native bridge responses.
const geo = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
}))
const bio = vi.hoisted(() => ({ checkBiometry: vi.fn(), authenticate: vi.fn() }))
const fs = vi.hoisted(() => ({ writeFile: vi.fn(), deleteFile: vi.fn() }))
const share = vi.hoisted(() => ({ share: vi.fn() }))
const secure = vi.hoisted(() => ({
  setKeyPrefix: vi.fn(() => Promise.resolve()),
  setSynchronize: vi.fn(() => Promise.resolve()),
  setDefaultKeychainAccess: vi.fn(() => Promise.resolve()),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}))
const camera = vi.hoisted(() => ({ takePhoto: vi.fn(), chooseFromGallery: vi.fn() }))
const app = vi.hoisted(() => ({ getLaunchUrl: vi.fn(), addListener: vi.fn() }))
const browser = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn(() => Promise.resolve()) }))

vi.mock('@capacitor/geolocation', () => ({ Geolocation: geo }))
vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  BiometricAuth: bio,
  BiometryErrorType: {
    userCancel: 'userCancel',
    appCancel: 'appCancel',
    systemCancel: 'systemCancel',
    userFallback: 'userFallback',
    biometryNotAvailable: 'biometryNotAvailable',
    biometryNotEnrolled: 'biometryNotEnrolled',
    passcodeNotSet: 'passcodeNotSet',
    noDeviceCredential: 'noDeviceCredential',
  },
}))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fs, Directory: { Cache: 'CACHE' } }))
vi.mock('@capacitor/share', () => ({ Share: share }))
vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: secure,
  KeychainAccess: { afterFirstUnlockThisDeviceOnly: 3 },
}))
vi.mock('@capacitor/camera', () => ({
  Camera: camera,
  CameraDirection: { Front: 'FRONT' },
  MediaTypeSelection: { Photo: 0 },
}))
vi.mock('@capacitor/app', () => ({ App: app }))
vi.mock('@capacitor/browser', () => ({ Browser: browser }))

const { createNativeGeolocation } = await import('./geolocation/geolocation.native')
const { createNativeBiometrics } = await import('./biometrics/biometrics.native')
const { createNativeFileDownload, safeName } = await import('./file-download/file-download.native')
const { createNativeSecureStorage } = await import('./secure-storage/secure-storage.native')
const { createNativeCamera } = await import('./camera/camera.native')
const { createNativeDeepLinks, toAppUrl } = await import('./deep-links/deep-links.native')
const { createNativeInAppBrowser } = await import('./in-app-browser/in-app-browser.native')

beforeEach(() => vi.clearAllMocks())

describe('native geolocation', () => {
  it('asks for permission once and returns a fresh fix', async () => {
    geo.checkPermissions.mockResolvedValue({ location: 'prompt' })
    geo.requestPermissions.mockResolvedValue({ location: 'granted' })
    geo.getCurrentPosition.mockResolvedValue({
      coords: { latitude: 40.4, longitude: -3.7, accuracy: 12 },
    })
    const result = await createNativeGeolocation().getCurrentPosition()
    expect(result).toEqual({ ok: true, value: { latitude: 40.4, longitude: -3.7, accuracy: 12 } })
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(expect.objectContaining({ maximumAge: 0 }))
  })

  it('maps denial, disabled location services and timeouts to the port errors', async () => {
    const service = createNativeGeolocation()
    geo.checkPermissions.mockResolvedValue({ location: 'denied' })
    expect(await service.getCurrentPosition()).toEqual({ ok: false, error: 'permission_denied' })

    geo.checkPermissions.mockRejectedValue(new Error('Location services are not enabled'))
    expect(await service.checkPermission()).toBe('unsupported')
    expect(await service.getCurrentPosition()).toEqual({ ok: false, error: 'unavailable' })

    geo.checkPermissions.mockResolvedValue({ location: 'granted' })
    geo.getCurrentPosition.mockRejectedValue(new Error('Location request timed out'))
    expect(await service.getCurrentPosition()).toEqual({ ok: false, error: 'timeout' })
  })
})

describe('native biometrics', () => {
  it('reports availability and never throws', async () => {
    bio.checkBiometry.mockResolvedValue({ isAvailable: true, deviceIsSecure: true })
    expect(await createNativeBiometrics().isAvailable()).toBe(true)
    // No biometrics enrolled, but the passcode can still unlock.
    bio.checkBiometry.mockResolvedValue({ isAvailable: false, deviceIsSecure: true })
    expect(await createNativeBiometrics().isAvailable()).toBe(true)
    bio.checkBiometry.mockResolvedValue({ isAvailable: false, deviceIsSecure: false })
    expect(await createNativeBiometrics().isAvailable()).toBe(false)
    bio.checkBiometry.mockRejectedValue(new Error('boom'))
    expect(await createNativeBiometrics().isAvailable()).toBe(false)
  })

  it('maps plugin error codes to cancelled / unavailable / failed', async () => {
    const service = createNativeBiometrics()
    bio.authenticate.mockResolvedValue(undefined)
    expect(await service.authenticate('Unlock')).toEqual({ ok: true, value: undefined })
    for (const [code, error] of [
      ['userCancel', 'cancelled'],
      ['biometryNotEnrolled', 'unavailable'],
      ['authenticationFailed', 'failed'],
      ['biometryLockout', 'failed'],
    ]) {
      bio.authenticate.mockRejectedValue(Object.assign(new Error(code), { code }))
      expect(await service.authenticate('Unlock')).toEqual({ ok: false, error })
    }
  })
})

describe('native file download', () => {
  it('shares the file from the private cache and always deletes it', async () => {
    fs.writeFile.mockResolvedValue({ uri: 'file:///cache/export.json' })
    fs.deleteFile.mockResolvedValue(undefined)
    share.share.mockResolvedValue({})
    const result = await createNativeFileDownload().downloadJson('../../export.json', { a: 1 })
    expect(result.ok).toBe(true)
    const path = String((fs.writeFile.mock.calls[0] as [{ path: string }])[0].path)
    expect(path).not.toContain('..')
    expect(share.share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['file:///cache/export.json'] }),
    )
    expect(fs.deleteFile).toHaveBeenCalledWith({ path, directory: 'CACHE' })
  })

  it('never builds a path segment from the file name', () => {
    expect(safeName('..')).toBe('file')
    expect(safeName('../../etc/passwd')).toBe('_._etc_passwd')
    expect(safeName('.hidden')).toBe('hidden')
    expect(safeName('datos-2026.json')).toBe('datos-2026.json')
  })

  it('treats closing the share sheet as done and still cleans up on errors', async () => {
    fs.writeFile.mockResolvedValue({ uri: 'file:///cache/x' })
    fs.deleteFile.mockResolvedValue(undefined)
    share.share.mockRejectedValue(new Error('Share canceled'))
    expect((await createNativeFileDownload().downloadBlob('a.pdf', new Blob(['x']))).ok).toBe(true)
    share.share.mockRejectedValue(new Error('disk full'))
    expect(await createNativeFileDownload().downloadBlob('a.pdf', new Blob(['x']))).toEqual({
      ok: false,
      error: 'failed',
    })
    expect(fs.deleteFile).toHaveBeenCalledTimes(2)
  })
})

describe('native secure storage', () => {
  it('stores on this device only and fails soft', async () => {
    secure.getItem.mockResolvedValue('session')
    const storage = createNativeSecureStorage()
    expect(await storage.getItem('sb')).toBe('session')
    expect(secure.setDefaultKeychainAccess).toHaveBeenCalledWith(3)
    secure.getItem.mockRejectedValue(new Error('keystore'))
    expect(await storage.getItem('sb')).toBeNull()
    secure.setItem.mockRejectedValue(new Error('keystore'))
    await expect(storage.setItem('sb', 'x')).resolves.toBeUndefined()
  })
})

describe('native camera', () => {
  it('maps a cancelled picker and a denied permission', async () => {
    camera.chooseFromGallery.mockRejectedValue(new Error('User cancelled photos app'))
    expect(await createNativeCamera().pickPhoto('gallery')).toEqual({
      ok: false,
      error: 'cancelled',
    })
    camera.takePhoto.mockRejectedValue(new Error('User denied access to camera'))
    expect(await createNativeCamera().pickPhoto('camera')).toEqual({
      ok: false,
      error: 'permission_denied',
    })
    expect(camera.takePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ saveToGallery: false, includeMetadata: false }),
    )
  })
})

describe('native deep links', () => {
  const base = 'https://nightlife.example'

  it('accepts only our HTTPS host and our custom scheme', () => {
    expect(toAppUrl('https://nightlife.example/premium?x=1', base)?.href).toBe(
      'https://nightlife.example/premium?x=1',
    )
    expect(toAppUrl('com.nightlifeconnect.app://premium/return?status=ok', base)?.href).toBe(
      'https://nightlife.example/premium/return?status=ok',
    )
    for (const raw of [
      'https://evil.example/premium',
      'https://nightlife.example.evil.example/',
      'https://user:pass@nightlife.example/',
      'https://nightlife.example:8443/',
      'http://nightlife.example/',
      'javascript:alert(1)',
      'not a url',
    ])
      expect(toAppUrl(raw, base)).toBeNull()
  })

  it('delivers the cold-start link and later links, closing the browser sheet', async () => {
    app.getLaunchUrl.mockResolvedValue({ url: 'com.nightlifeconnect.app://home' })
    let listener: (event: { url: string }) => void = () => undefined
    const remove = vi.fn(() => Promise.resolve())
    app.addListener.mockImplementation((_event: string, fn: typeof listener) => {
      listener = fn
      return Promise.resolve({ remove })
    })
    const handler = vi.fn()
    const stop = createNativeDeepLinks(base).onUrlOpen(handler)
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1))
    listener({ url: 'https://evil.example/home' })
    listener({ url: 'https://nightlife.example/chats' })
    expect(handler).toHaveBeenCalledTimes(2)
    expect((handler.mock.calls[1] as [URL])[0].pathname).toBe('/chats')
    expect(browser.close).toHaveBeenCalledTimes(2)
    stop()
    expect(remove).toHaveBeenCalled()
  })

  it('opens external flows only for allow-listed hosts', async () => {
    browser.open.mockResolvedValue(undefined)
    const external = createNativeInAppBrowser()
    expect(await external.openExternalFlow('https://evil.example/pay')).toEqual({
      ok: false,
      error: 'host_not_allowed',
    })
    expect(browser.open).not.toHaveBeenCalled()
    expect((await external.openExternalFlow('https://checkout.stripe.com/c/pay/x')).ok).toBe(true)
  })
})
