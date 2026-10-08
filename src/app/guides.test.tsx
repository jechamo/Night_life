import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

const anonymous = { services: { state: { onboarded: false } }, settings: { reduceMotion: true } }

describe('roadmap R1: public guides', () => {
  it('the user guide opens without an account and covers every area', async () => {
    const { router } = renderApp('/guia', anonymous)
    expect(
      await screen.findByRole('heading', { name: 'Guía de Nightlife Connect', level: 1 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/guia')
    for (const title of ['Descubre la noche', 'Esta Noche', 'Verificaciones', 'Seguridad'])
      expect(screen.getByRole('heading', { name: title, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Qué es gratis', level: 2 })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '¿Tienes un local? Mira la guía para locales' }),
    ).toHaveAttribute('href', '/guia/locales')
  })

  it('the venue guide opens without an account and links the venue terms', async () => {
    renderApp('/guia/locales', anonymous)
    expect(
      await screen.findByRole('heading', { name: 'Guía para locales', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Patrocinio (30 días)' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Condiciones para locales y organizadores' }),
    ).toHaveAttribute('href', '/legal/venues')
  })

  it('the sign-in tip follows the email sign-in flag', async () => {
    renderApp('/guia', {
      ...anonymous,
      services: { ...anonymous.services, flags: { email_login_enabled: 'on' } },
    })
    expect(
      await screen.findByText(/con un código a tu email verificado \(sin SMS\)/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Pronto también podrás entrar/)).not.toBeInTheDocument()
  })

  it('guides are linked from the legal index, welcome and profile', async () => {
    renderApp('/legal', anonymous)
    expect(await screen.findByRole('link', { name: /Guía de la app/ })).toHaveAttribute(
      'href',
      '/guia',
    )
    const welcome = renderApp('/welcome', anonymous)
    expect(await screen.findByRole('link', { name: 'Cómo funciona' })).toHaveAttribute(
      'href',
      '/guia',
    )
    welcome.unmount()
  })
})
