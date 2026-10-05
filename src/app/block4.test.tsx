import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createMockServices } from '@/mocks/mock-services'
import { ok } from '@/shared/lib/result'
import { renderApp } from '@/test/render-app'

const quiet = { settings: { reduceMotion: true } } as const

describe('Paywall follows the flags (Block 4 "done when")', () => {
  it('a tester with payments in test mode gets the checkout', async () => {
    renderApp('/premium', quiet)
    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Pase VIP/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
  })

  it('a normal user sees "Próximamente" and "Avísame" needs commercial consent', async () => {
    renderApp('/premium', { ...quiet, services: { roles: ['user'] } })
    expect(await screen.findByText('Próximamente')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Avísame' })).toBeDisabled()
  })

  it('premium off hides every paid offer', async () => {
    renderApp('/premium', { ...quiet, services: { flags: { premium_enabled: 'off' } } })
    expect(await screen.findByText('Todo gratis por ahora')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pase VIP/ })).not.toBeInTheDocument()
  })

  it('audience "none" with a hidden paywall shows nothing to buy, even to testers', async () => {
    renderApp('/premium', {
      ...quiet,
      services: { flags: { payments_audience: 'none', paywall_visibility: 'hidden' } },
    })
    expect(await screen.findByText('Todo gratis por ahora')).toBeInTheDocument()
  })

  it('the checkout is unreachable when the user cannot buy', async () => {
    const { router } = renderApp('/premium/checkout/vip_monthly', {
      ...quiet,
      services: { roles: ['user'] },
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/premium'))
  })
})

describe('Test purchase → entitlements → cancel and withdraw', () => {
  it('explicitly simulates the VIP pass and manages it from "Mi suscripción"', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/premium', quiet)
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('IVA (21 %)')).toBeInTheDocument()
    expect(screen.getByText(/Derecho de desistimiento de 14 días/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Suscribirme y pagar' }))

    await user.click(await screen.findByRole('button', { name: /Simular compra/ }))
    expect(await screen.findByText('Compra simulada')).toBeInTheDocument()

    await router.navigate('/premium/subscription')
    await waitFor(() => expect(router.state.location.pathname).toBe('/premium/subscription'))
    expect(await screen.findByText('Activa')).toBeInTheDocument()
    expect(await screen.findByText('Likes ilimitados')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar suscripción' }))
    expect(await screen.findByText('Cancelada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivar renovación' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Desistir y pedir reembolso' }))
    expect(await screen.findByText('Desistida')).toBeInTheDocument()
    expect(screen.getByText(/reembolsada/)).toBeInTheDocument()
    expect(screen.queryByText('Likes ilimitados')).not.toBeInTheDocument()
  })

  it('redeems a promo code and rejects an invalid one', async () => {
    const user = userEvent.setup()
    renderApp('/premium/redeem', quiet)
    const field = await screen.findByLabelText('Código')
    await user.type(field, 'ZZZZ-ZZZZ-ZZZZ')
    await user.click(screen.getByRole('button', { name: 'Canjear' }))
    expect(await screen.findByText('Ese código no es válido.')).toBeInTheDocument()

    await user.clear(field)
    await user.type(field, 'nite-test-0001')
    await user.click(screen.getByRole('button', { name: 'Canjear' }))
    expect(await screen.findByText('¡Listo! Tienes Pase VIP durante 7 días.')).toBeInTheDocument()
  })
})

describe('Admin (role + MFA, flags, test tools)', () => {
  async function enterAdmin(path = '/admin') {
    const user = userEvent.setup()
    const utils = renderApp(path, quiet)
    const code = await screen.findByLabelText('Código de 6 dígitos')
    await user.type(code, '000000')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('Código incorrecto.')).toBeInTheDocument()
    await user.clear(code)
    await user.type(code, '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await screen.findByRole('navigation', { name: 'Secciones del admin' })
    return { user, ...utils }
  }

  it('is closed to users without the admin role', async () => {
    const { router } = renderApp('/admin', { ...quiet, services: { roles: ['user'] } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
  })

  it('needs the second factor and then shows the dashboard', async () => {
    await enterAdmin()
    expect(await screen.findByText('Reportes pendientes')).toBeInTheDocument()
  })

  it('switching a flag changes the paywall live and is audited', async () => {
    const { user, router } = await enterAdmin('/admin/flags')
    expect(await screen.findByText('Checkout')).toBeInTheDocument()
    const premium = screen.getByRole('radiogroup', { name: 'premium_enabled' })
    await user.click(within(premium).getByRole('radio', { name: 'off' }))
    expect(await screen.findByText('Oculto')).toBeInTheDocument()

    await router.navigate('/admin/s/audit')
    expect(await screen.findByText('premium_enabled: on → off')).toBeInTheDocument()

    await router.navigate('/premium')
    expect(await screen.findByText('Todo gratis por ahora')).toBeInTheDocument()
  })

  it('moderation decisions need an explanation', async () => {
    const { user } = await enterAdmin('/admin/s/reports')
    const card = (await screen.findByText('Usuario #2048')).closest('div.glass') as HTMLElement
    const suspend = within(card).getByRole('button', { name: 'Suspender' })
    expect(suspend).toBeDisabled()
    await user.type(within(card).getByLabelText('Nota / motivo'), 'Perfil falso confirmado')
    await user.click(suspend)
    expect(await within(card).findByText('Suspendido')).toBeInTheDocument()
  })

  it('simulated suspension sends the account to the suspension screen', async () => {
    const { user, router } = await enterAdmin('/admin/test-tools')
    const card = (await screen.findByText('Simular suspensión')).closest('div.glass') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Ejecutar' }))
    await user.click(within(card).getByRole('button', { name: 'Sí, ejecutar' }))
    expect(await screen.findByText('Simular suspensión: ok')).toBeInTheDocument()
    await router.navigate('/profile')
    expect(await screen.findByRole('heading', { name: 'Cuenta suspendida' })).toBeInTheDocument()
  })
})

describe('Public legal website (no login)', () => {
  const anonymous = { ...quiet, services: { state: { onboarded: false } } } as const

  it('lists the documents and opens one without an account', async () => {
    const user = userEvent.setup()
    renderApp('/legal', anonymous)
    expect(await screen.findByRole('heading', { name: 'Información legal' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Lista de terceros' }))
    expect(
      await screen.findByRole('heading', { name: 'Lista pública de terceros' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vercel' })).toBeInTheDocument()
  })

  it('Premium terms stay unpublished while the public cannot pay', async () => {
    renderApp('/legal/premium', {
      ...anonymous,
      services: { ...anonymous.services, roles: ['user'] },
    })
    expect(await screen.findByText('Documento no disponible')).toBeInTheDocument()
  })

  it('accepts a DSA notice of illegal content and returns a reference', async () => {
    const user = userEvent.setup()
    renderApp('/legal/illegal-content', anonymous)
    await user.type(
      await screen.findByLabelText('Dónde está el contenido'),
      'https://evil.example/events/fixture',
    )
    await user.click(screen.getByRole('radio', { name: 'Estafa o fraude' }))
    await user.type(
      screen.getByLabelText('Explica por qué es ilegal'),
      'Venden entradas falsas para un evento que no existe.',
    )
    await user.type(screen.getByLabelText('Tu email'), 'persona@example.com')
    const submit = screen.getByRole('button', { name: 'Enviar aviso' })
    expect(submit).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    expect(submit).toBeDisabled()
    expect(screen.getByText('Introduce un enlace HTTPS de Nightlife Connect.')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Dónde está el contenido'))
    await user.type(
      screen.getByLabelText('Dónde está el contenido'),
      'https://nightlife-connect-beige.vercel.app/events/fixture',
    )
    await user.click(submit)
    expect(await screen.findByText(/Tu referencia es DSA-/)).toBeInTheDocument()
  })

  it('shows a failed DSA submission and keeps the entered details for retry', async () => {
    const user = userEvent.setup()
    const moderation = createMockServices({ latencyMs: 0, realtime: false }).moderation
    renderApp('/legal/illegal-content', {
      ...anonymous,
      serviceOverrides: {
        moderation: {
          ...moderation,
          submitIllegalContentNotice: vi.fn().mockRejectedValue(new Error('network failed')),
        },
      },
    })
    const url = 'https://nightlife-connect-beige.vercel.app/events/fixture'
    await user.type(await screen.findByLabelText('Dónde está el contenido'), url)
    await user.click(screen.getByRole('radio', { name: 'Estafa o fraude' }))
    await user.type(
      screen.getByLabelText('Explica por qué es ilegal'),
      'Venden entradas falsas para un evento que no existe.',
    )
    await user.type(screen.getByLabelText('Tu email'), 'persona@example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Enviar aviso' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido registrar el aviso')
    expect(screen.getByLabelText('Dónde está el contenido')).toHaveValue(url)
    expect(screen.getByRole('button', { name: 'Enviar aviso' })).toBeEnabled()
    expect(screen.queryByText('Aviso recibido')).not.toBeInTheDocument()
  })
})

describe('Privacy & data, moderation, SOS', () => {
  it('exports my data as JSON through the platform layer', async () => {
    const user = userEvent.setup()
    const downloadJson = vi.fn(() => Promise.resolve(ok(undefined)))
    renderApp('/profile/privacy', {
      ...quiet,
      platform: { files: { downloadJson, downloadBlob: () => Promise.resolve(ok(undefined)) } },
    })
    await user.click(await screen.findByRole('button', { name: 'Descargar mis datos' }))
    expect(await screen.findByText('Descarga lista.')).toBeInTheDocument()
    const [filename, data] = downloadJson.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ]
    expect(filename).toMatch(/^nightlife-connect-.*\.json$/)
    expect(data).toHaveProperty('profile')
    expect(data).toHaveProperty('consents')
  })

  it('deleting the account needs the OTP and ends at the welcome screen', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/profile/privacy', quiet)
    await user.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }))
    const otp = await screen.findByLabelText('Código de confirmación')
    await user.type(otp, '111111')
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }))
    expect(await screen.findByText('Código incorrecto.')).toBeInTheDocument()
    await user.clear(otp)
    await user.type(otp, '123456')
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'))
  })

  it('a moderation decision can be appealed once', async () => {
    const user = userEvent.setup()
    renderApp('/profile/moderation', quiet)
    await user.click(await screen.findByRole('button', { name: 'Recurrir' }))
    await user.type(
      screen.getByLabelText('Por qué no estás de acuerdo'),
      'No insistí, fue un malentendido.',
    )
    await user.click(screen.getByRole('button', { name: 'Enviar apelación' }))
    expect(await screen.findByText('Apelación en revisión')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recurrir' })).not.toBeInTheDocument()
  })

  it('SOS saves trusted contacts and links to 112', async () => {
    const user = userEvent.setup()
    renderApp('/profile/sos', quiet)
    expect(await screen.findByRole('link', { name: 'Llamar al 112' })).toHaveAttribute(
      'href',
      'tel:112',
    )
    await user.type(await screen.findByLabelText('Nombre'), 'Marta')
    await user.type(screen.getByLabelText('Teléfono'), '+34 600 000 000')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Guardado')).toBeInTheDocument()
  })
})

describe('Venue panel', () => {
  it('shows free aggregated totals and requests a sponsorship while self-service is off', async () => {
    const user = userEvent.setup()
    renderApp('/venue', quiet)
    await user.click(await screen.findByRole('link', { name: /Bar Cobalto/ }))
    expect(await screen.findByText('Check-ins esta semana')).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'Gráfico de barras de afluencia por hora' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Destacado Plus/ }))
    await user.click(screen.getByRole('button', { name: 'Solicitar patrocinio' }))
    expect(await screen.findByText('Solicitado')).toBeInTheDocument()
  })
})

describe('Paid direct message', () => {
  const verifiedAge = {
    age: { state: 'verified', verifiedAt: '2026-10-02T21:00:00Z' },
    photo: { state: 'not_started' },
    identity: { state: 'not_started' },
  } as const

  it('is hidden while paid_dm_enabled is off', async () => {
    renderApp('/people/p-1', { ...quiet, services: { state: { verification: verifiedAge } } })
    await screen.findByRole('button', { name: 'Reportar' })
    expect(screen.queryByRole('button', { name: 'Mensaje directo' })).not.toBeInTheDocument()
  })

  it('without credits it leads to the paywall', async () => {
    const user = userEvent.setup()
    renderApp('/people/p-1', {
      ...quiet,
      services: { flags: { paid_dm_enabled: 'on' }, state: { verification: verifiedAge } },
    })
    await user.click(await screen.findByRole('button', { name: 'Mensaje directo' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Te quedan 0 mensajes directos.')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Conseguir mensajes' })).toHaveAttribute(
      'href',
      '/premium',
    )
  })
})
