import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/shared/lib/result'
import { renderApp } from '@/test/render-app'

const fresh = { services: { state: { onboarded: false } }, settings: { reduceMotion: true } }

async function enterPhone() {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Número de móvil'), '612345678')
  await user.click(screen.getByRole('button', { name: 'Enviar código' }))
  await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456')
  return user
}

describe('account entry and sign out', () => {
  it.each(['/welcome', '/login', '/onboarding'])(
    'redirects a finished account from %s',
    async (path) => {
      const { router } = renderApp(path)
      await waitFor(() => expect(router.state.location.pathname).toBe('/discover'))
    },
  )

  it('keeps a suspended account restricted', async () => {
    const { router, services, queryClient } = renderApp('/profile')
    await screen.findByRole('heading', { name: 'Cuenta' })
    vi.spyOn(services.moderation, 'accountStatus').mockResolvedValue('suspended')
    await act(async () => {
      await queryClient.invalidateQueries()
      await router.navigate('/login')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/suspended'))
  })

  it('signs in a completed account after verifying its code', async () => {
    const { services, router } = renderApp('/login', fresh)
    const user = await enterPhone()
    vi.spyOn(services.onboarding, 'getStatus').mockResolvedValue('completed')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'))
  })

  it('offers a choice for an incomplete account and signs out before changing numbers', async () => {
    const { services, router, queryClient } = renderApp('/login', fresh)
    const signOut = vi.spyOn(services.session, 'signOut')
    const user = await enterPhone()
    const verify = vi.spyOn(services.onboarding, 'verifyOtp').mockImplementation(async () => {
      await queryClient.resetQueries()
      return ok(undefined)
    })
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await screen.findByRole('heading', { name: 'Este número no tiene una cuenta terminada' })
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('button', { name: 'Completar el alta' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Usar otro número' }))
    expect(await screen.findByLabelText('Número de móvil')).toBeVisible()
    expect(signOut).toHaveBeenCalledOnce()
    expect(verify).toHaveBeenCalledOnce()
  })

  it('only opens signup after choosing to complete it', async () => {
    const { router } = renderApp('/login', fresh)
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await user.click(await screen.findByRole('button', { name: 'Completar el alta' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'))
    expect(await screen.findByLabelText('Fecha de nacimiento')).toBeVisible()
  })

  it('retries a failed status lookup without consuming the OTP again', async () => {
    const { services, router } = renderApp('/login', fresh)
    const user = await enterPhone()
    const status = vi
      .spyOn(services.onboarding, 'getStatus')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('completed')
    const verify = vi.spyOn(services.onboarding, 'verifyOtp')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('No hay conexión. Inténtalo de nuevo.')).toBeVisible()
    expect(screen.queryByText('Este número no tiene una cuenta terminada')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'))
    expect(status).toHaveBeenCalled()
    expect(verify).toHaveBeenCalledOnce()
  })

  it('shows and executes sign out in the Account section without redirecting back', async () => {
    const { router } = renderApp('/profile')
    const user = userEvent.setup()
    const heading = await screen.findByRole('heading', { name: 'Cuenta' })
    const section = heading.closest('section')!
    await user.click(within(section).getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'))
    expect(await screen.findByRole('link', { name: 'Ya tengo cuenta' })).toBeVisible()
  })

  it('preserves the login form when the status query fails and lets it recover', async () => {
    const { services, queryClient, router } = renderApp('/login', fresh)
    await screen.findByRole('heading', { name: 'Entrar' })
    const status = vi
      .spyOn(services.onboarding, 'getStatus')
      .mockRejectedValue(new Error('offline'))
    await act(() => queryClient.invalidateQueries())
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument()
    status.mockResolvedValue('pending')
    await userEvent.setup().click(retry)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('hides mock OTP hints and reset on real services even with test tools enabled', async () => {
    const { services, router, queryClient } = renderApp('/profile')
    await screen.findByRole('heading', { name: 'Cuenta' })
    const { testOtpCode: _unused, ...realLike } = services.onboarding
    void _unused
    Object.assign(services, { onboarding: realLike })
    await act(() => router.navigate('/profile/settings'))
    await act(() => router.navigate('/profile'))
    expect(screen.queryByRole('button', { name: /Reiniciar onboarding/ })).not.toBeInTheDocument()
    await services.session.signOut()
    await act(async () => {
      queryClient.clear()
      await router.navigate('/login')
    })
    const user = await enterPhone()
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
  })
})
