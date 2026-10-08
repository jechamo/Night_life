import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

const settings = { reduceMotion: true }
const on = { services: { flags: { venue_partners_enabled: 'on' } }, settings } as const

async function enterAdmin(path: string, options = on) {
  const user = userEvent.setup()
  const utils = renderApp(path, options)
  await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456')
  await user.click(screen.getByRole('button', { name: 'Verificar' }))
  await screen.findByRole('navigation', { name: 'Secciones del admin' })
  return { user, ...utils }
}

describe('roadmap R3: partners and contracts', () => {
  it('flag off: venue panel, venue page and claim stay exactly as before', async () => {
    renderApp('/venue', { settings })
    expect(await screen.findByText('Bar Cobalto')).toBeInTheDocument()
    expect(screen.queryByText('Tengo un código de invitación')).toBeNull()
    expect(screen.queryByText(/Condiciones para Locales/)).toBeNull()
  })

  it('flag off: the venue detail has no plan or team section', async () => {
    renderApp('/venue/v-cobalto', { settings })
    expect(await screen.findByRole('heading', { name: 'Bar Cobalto' })).toBeInTheDocument()
    expect(screen.queryByText('Plan y ventajas')).toBeNull()
    expect(screen.queryByText('Equipo')).toBeNull()
  })

  it('flag off: invitation links explain they are not available', async () => {
    renderApp('/invitacion/ABCD-1234-ABCD', {
      services: { state: { onboarded: false } },
      settings,
    })
    expect(
      await screen.findByText('Las invitaciones de locales todavía no están disponibles.'),
    ).toBeInTheDocument()
  })

  it('admin creates a company, a Top + Pro contract and an invitation; the venue redeems it', async () => {
    const { user, router } = await enterAdmin('/admin/partners')
    await user.click(await screen.findByRole('button', { name: 'Nueva empresa' }))
    await user.type(screen.getByLabelText('Razón social'), 'Noches Aurora SL')
    await user.type(screen.getByLabelText('CIF/NIF'), 'B12345678')
    await user.type(screen.getByLabelText('Persona de contacto'), 'Marta Gil')
    await user.type(screen.getByLabelText('Email de facturación'), 'facturas@aurora.test')
    await user.click(screen.getByRole('button', { name: 'Guardar empresa' }))
    const card = await screen.findByRole('region', { name: 'Noches Aurora SL' })

    await user.type(within(card).getByLabelText('Buscar un local para vincular'), 'Aurora')
    await user.click(await within(card).findByRole('button', { name: 'Vincular' }))
    expect(await within(card).findByText('Sala Aurora · Madrid')).toBeInTheDocument()

    await user.type(within(card).getByLabelText('Referencia del contrato'), 'NL-2026-001')
    await user.click(within(card).getByRole('radio', { name: 'Top' }))
    await user.click(within(card).getByText('Incluye Estadísticas Pro'))
    await user.type(within(card).getByLabelText('Fin'), '2027-12-31')
    await user.click(within(card).getByRole('button', { name: 'Crear contrato (borrador)' }))
    await user.click(await within(card).findByRole('button', { name: 'Activar' }))
    expect(await within(card).findByText('Activo')).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Invitar al titular' }))
    const code = (await within(card).findByText(/^Código: /)).textContent.replace('Código: ', '')
    expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/)

    // The same simulated person redeems it from the venue panel.
    await router.navigate('/venue/invitacion')
    await user.type(await screen.findByLabelText('Código de invitación'), code)
    await user.click(screen.getByRole('button', { name: 'Comprobar código' }))
    expect(await screen.findByText('Empresa: Noches Aurora SL')).toBeInTheDocument()
    const redeem = screen.getByRole('button', { name: 'Aceptar y unirme' })
    expect(redeem).toBeDisabled()
    await user.click(screen.getByText(/He leído y acepto las Condiciones para Locales/))
    await user.click(redeem)
    await waitFor(() => expect(router.state.location.pathname).toBe('/venue/v-aurora'))
    expect(await screen.findByText(/Contrato NL-2026-001/)).toBeInTheDocument()
    expect(screen.getByText(/^Top · incluido en tu contrato/)).toBeInTheDocument()
    expect(screen.getByText(/^Estadísticas Pro · incluido en tu contrato/)).toBeInTheDocument()
    expect(screen.getByText(/Has aceptado las Condiciones para Locales/)).toBeInTheDocument()

    // Used invitations cannot be redeemed again.
    await router.navigate('/venue/invitacion')
    await user.type(await screen.findByLabelText('Código de invitación'), code)
    await user.click(screen.getByRole('button', { name: 'Comprobar código' }))
    expect(
      await screen.findByText('El código no es válido, ha caducado o ya se ha usado.'),
    ).toBeInTheDocument()
  })

  it('owners see the team and invite a manager', async () => {
    const user = userEvent.setup()
    renderApp('/venue/v-cobalto', on)
    expect(await screen.findByText('Plan y ventajas')).toBeInTheDocument()
    expect(await screen.findByText('Equipo')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Invitar encargado' }))
    expect(await screen.findByText(/^Código: /)).toBeInTheDocument()
    expect(await screen.findByText(/^Encargado · caduca el/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Anular' }))
    await waitFor(() => expect(screen.queryByText(/^Encargado · caduca el/)).toBeNull())
  })

  it('with the flag on, claiming needs the venue terms', async () => {
    const user = userEvent.setup()
    renderApp('/venue', on)
    await user.type(await screen.findByLabelText('Busca tu local'), 'Aurora')
    await user.click(await screen.findByRole('radio', { name: 'Sala Aurora' }))
    await user.type(
      screen.getByLabelText('Cómo acreditas que lo gestionas'),
      'Soy la gerente, CIF B12345678',
    )
    const submit = screen.getByRole('button', { name: 'Enviar solicitud' })
    expect(submit).toBeDisabled()
    await user.click(screen.getByText(/He leído y acepto las Condiciones para Locales/))
    await user.click(submit)
    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument()
  })

  it('an invitation link opened without an account is kept for after sign-up', async () => {
    const { platform } = renderApp('/invitacion/abcd-1234-abcd', {
      ...on,
      services: { ...on.services, state: { onboarded: false } },
    })
    expect(await screen.findByText('Código de invitación: ABCD-1234-ABCD')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/onboarding',
    )
    await waitFor(async () =>
      expect(await platform.preferences.get('pending_venue_invite')).toContain('ABCD-1234-ABCD'),
    )
  })

  it('the venue guide mentions invitations and teams only with the flag on', async () => {
    const off = renderApp('/guia/locales', { services: { state: { onboarded: false } }, settings })
    expect(await screen.findByRole('heading', { name: 'Guía para locales', level: 1 }))
    expect(screen.queryByText(/te enviamos una invitación/)).toBeNull()
    off.unmount()
    renderApp('/guia/locales', { ...on, services: { ...on.services, state: { onboarded: false } } })
    expect(await screen.findByText(/te enviamos una invitación/)).toBeVisible()
  })
})
