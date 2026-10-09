import { screen, within } from '@testing-library/react'
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
    // Venue callout at the top and a visual index that jumps to each section.
    expect(screen.getByRole('link', { name: 'Ver la guía para locales' })).toHaveAttribute(
      'href',
      '/guia/locales',
    )
    const contents = screen.getByRole('navigation', { name: 'En esta guía' })
    expect(within(contents).getByRole('link', { name: 'Seguridad' })).toHaveAttribute(
      'href',
      '#guide-safety',
    )
    expect(document.getElementById('guide-safety')).toContainElement(
      screen.getByRole('heading', { name: 'Seguridad', level: 2 }),
    )
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

  it('the guides explain prices, quantities and how to cancel or withdraw', async () => {
    const user = renderApp('/guia', anonymous)
    expect(
      await screen.findByRole('heading', { name: 'Cómo se paga, se cancela y se desiste' }),
    ).toBeInTheDocument()
    // Prices come from the same catalogue as the checkout.
    expect(screen.getByText(/^Pase \(9,99\s€ al mes/)).toBeInTheDocument()
    expect(screen.getByText(/1 Foco, 3 Chispas y 2 Mensajes directos/)).toBeInTheDocument()
    expect(screen.getByText(/Lo que ya has usado no se devuelve/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Condiciones de Premium' })).toHaveAttribute(
      'href',
      '/legal/premium',
    )
    user.unmount()
    renderApp('/guia/locales', anonymous)
    expect(await screen.findByText(/^Destacado \(29,00\s€ por 30 días\)/)).toBeInTheDocument()
    expect(screen.getByText(/Hay 3 plazas por ciudad/)).toBeInTheDocument()
    expect(screen.getByText(/entre empresas no hay desistimiento/)).toBeInTheDocument()
    // Contracts are explained only with the partners flag on.
    expect(screen.queryByText(/acuerdo con Nightlife \(contrato\)/)).toBeNull()
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
    expect(screen.getByRole('link', { name: 'Para locales' })).toHaveAttribute(
      'href',
      '/guia/locales',
    )
    welcome.unmount()
  })
})
