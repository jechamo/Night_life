import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/shared/lib/result'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { renderApp } from '@/test/render-app'
import type { BiometricError } from '@/platform'
import { LOCK_AFTER_MS } from './biometric-lock'

type AuthResult = ReturnType<typeof ok<undefined>> | ReturnType<typeof err<BiometricError>>

function nativeLike({ available = true, results = [ok(undefined)] as AuthResult[] } = {}) {
  let active: (value: boolean) => void = () => undefined
  const authenticate = vi.fn(() => Promise.resolve(results.shift() ?? ok(undefined)))
  return {
    authenticate,
    setActive: (value: boolean) => active(value),
    platform: {
      runtime: 'native' as const,
      biometrics: { isAvailable: () => Promise.resolve(available), authenticate },
      appState: {
        onActiveChange: (handler: (value: boolean) => void) => {
          active = handler
          return () => undefined
        },
        onBackButton: () => () => undefined,
        exit: () => undefined,
      },
    },
  }
}

const lockTitle = 'Nightlife Connect está bloqueada'

describe('biometric lock (Block 11)', () => {
  it('is invisible on the web: no setting and never locked', async () => {
    renderApp('/profile/settings')
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.queryByText('Desbloquear con Face ID o huella')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: lockTitle })).not.toBeInTheDocument()
  })

  it('starts locked, asks once automatically and unlocks', async () => {
    const device = nativeLike()
    renderApp('/profile/settings', { platform: device.platform, settings: { biometricLock: true } })
    expect(screen.getByRole('dialog', { name: lockTitle })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: lockTitle })).not.toBeInTheDocument(),
    )
    expect(device.authenticate).toHaveBeenCalledTimes(1)
    expect(device.authenticate).toHaveBeenCalledWith('Desbloquear Nightlife Connect')
  })

  it('stays locked after a failure until a later explicit unlock succeeds', async () => {
    const device = nativeLike({ results: [err('failed'), ok(undefined)] })
    renderApp('/profile/settings', { platform: device.platform, settings: { biometricLock: true } })
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido desbloquear')
    await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: lockTitle })).not.toBeInTheDocument(),
    )
  })

  it('fails closed without biometrics and only offers signing out', async () => {
    const device = nativeLike({ available: false })
    const { platform } = renderApp('/profile/settings', {
      platform: device.platform,
      settings: { biometricLock: true },
    })
    await platform.preferences.set(PREFERENCE_KEYS.biometricLock, 'on')
    expect(await screen.findByText(/La biometría ya no está disponible/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desbloquear' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: lockTitle })).not.toBeInTheDocument(),
    )
    expect(await platform.preferences.get(PREFERENCE_KEYS.biometricLock)).toBeNull()
  })

  it('re-locks only after 30 seconds in the background', async () => {
    const device = nativeLike()
    renderApp('/profile/settings', { platform: device.platform, settings: { biometricLock: true } })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: lockTitle })).not.toBeInTheDocument(),
    )
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    act(() => device.setActive(false))
    now.mockReturnValue(1_000 + LOCK_AFTER_MS - 1)
    act(() => device.setActive(true))
    expect(screen.queryByRole('dialog', { name: lockTitle })).not.toBeInTheDocument()

    // The re-lock prompts again; keep that prompt open to observe the lock.
    device.authenticate.mockImplementationOnce(() => new Promise<AuthResult>(() => undefined))
    now.mockReturnValue(10_000)
    act(() => device.setActive(false))
    now.mockReturnValue(10_000 + LOCK_AFTER_MS)
    act(() => device.setActive(true))
    expect(await screen.findByRole('dialog', { name: lockTitle })).toBeInTheDocument()
    await waitFor(() => expect(device.authenticate).toHaveBeenCalledTimes(2))
  })

  it('enables from Settings only after confirming biometrics', async () => {
    const device = nativeLike({ results: [err('cancelled'), ok(undefined)] })
    const { platform } = renderApp('/profile/settings', { platform: device.platform })
    const toggle = await screen.findByRole('switch', { name: /Desbloquear con Face ID o huella/ })
    await userEvent.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha activado')
    expect(toggle).not.toBeChecked()
    expect(await platform.preferences.get(PREFERENCE_KEYS.biometricLock)).toBeNull()

    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toBeChecked())
    expect(await platform.preferences.get(PREFERENCE_KEYS.biometricLock)).toBe('on')
  })
})
