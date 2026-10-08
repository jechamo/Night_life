import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

const signedOut = (flag: 'on' | 'off') => ({
  services: { state: { onboarded: false }, flags: { email_login_enabled: flag } },
  settings: { reduceMotion: true },
})

describe('roadmap R1: sign in with an email code', () => {
  it('flag off: login stays the SMS screen with no email option', async () => {
    renderApp('/login', signedOut('off'))
    expect(await screen.findByLabelText('Número de móvil')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Entrar con email/ })).not.toBeInTheDocument()
  })

  it('flag on: email first, SMS one tap away and back', async () => {
    const user = userEvent.setup()
    renderApp('/login', signedOut('on'))
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entrar con SMS' }))
    expect(await screen.findByLabelText('Número de móvil')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entrar con email (sin SMS)' }))
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
  })

  it('signs in the account that owns the verified email', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/login', signedOut('on'))
    await services.onboarding.changeEmail('ana@example.test')
    await user.type(await screen.findByLabelText('Email'), 'Ana@Example.test')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(
      await screen.findByText(/Si ana@example.test es el email verificado de una cuenta/),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'))
  })

  it('an unknown email gets the same answer and never signs in', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/login', signedOut('on'))
    await user.type(await screen.findByLabelText('Email'), 'nobody@example.test')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(
      await screen.findByText(/Si nobody@example.test es el email verificado de una cuenta/),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('El código no es correcto.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('rejects a malformed email before calling the server', async () => {
    const user = userEvent.setup()
    renderApp('/login', signedOut('on'))
    await user.type(await screen.findByLabelText('Email'), 'ana@')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByText('Revisa el email.')).toBeInTheDocument()
  })

  it('settings: the account section appears only with the flag on and saves the email', async () => {
    const user = userEvent.setup()
    const off = renderApp('/profile/settings', {
      services: { flags: { email_login_enabled: 'off' } },
    })
    await screen.findByRole('heading', { name: 'Ajustes' })
    expect(screen.queryByLabelText('Nuevo email')).not.toBeInTheDocument()
    off.unmount()

    renderApp('/profile/settings', { services: { flags: { email_login_enabled: 'on' } } })
    expect(await screen.findByText('Todavía no has añadido un email.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nuevo email'), 'ana@example.test')
    await user.click(screen.getByRole('button', { name: 'Guardar email' }))
    expect(
      await screen.findByText('Te hemos enviado un enlace a ana@example.test para confirmarlo.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('ana@example.test · Verificado')).toBeInTheDocument()
  })
})
