import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

const settings = { reduceMotion: true }
const verifiedAge = {
  age: { state: 'verified', verifiedAt: '2026-10-02T21:00:00Z' },
  photo: { state: 'not_started' },
  identity: { state: 'not_started' },
} as const
const flags = { venue_bookings_enabled: 'on' } as const
const on = { services: { flags, state: { verification: verifiedAge } }, settings } as const

async function sheetOf(name: string) {
  return screen.findByRole('dialog', { name })
}

describe('roadmap R5: reservations and guest lists', () => {
  it('flag off: place sheet, profile and venue panel stay exactly as before', async () => {
    const place = renderApp('/discover?place=v-aurora', { settings })
    const sheet = await sheetOf('Sala Aurora')
    expect(
      within(sheet).queryByRole('heading', { name: 'Reservas y lista de invitados' }),
    ).toBeNull()
    place.unmount()
    const profile = renderApp('/profile', { settings })
    expect(await screen.findByText('Panel de locales')).toBeInTheDocument()
    expect(screen.queryByText('Mis reservas')).toBeNull()
    profile.unmount()
    const { router } = renderApp('/reservas', { settings })
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
  })

  it('a verified person requests a table; without verified age it asks to verify', async () => {
    const unverified = renderApp('/discover?place=v-aurora', { services: { flags }, settings })
    const first = await sheetOf('Sala Aurora')
    expect(
      await within(first).findByText(
        'Para reservar o apuntarte a una lista necesitas la edad verificada.',
      ),
    ).toBeInTheDocument()
    unverified.unmount()

    const user = userEvent.setup()
    renderApp('/discover?place=v-aurora', on)
    const sheet = await sheetOf('Sala Aurora')
    await within(sheet).findByRole('heading', { name: 'Reservas y lista de invitados' })
    const party = within(sheet).getByLabelText('Personas')
    await user.clear(party)
    await user.type(party, '4')
    await user.click(within(sheet).getByRole('radio', { name: 'Mesa con botella' }))
    await user.click(within(sheet).getByRole('button', { name: 'Solicitar reserva' }))
    expect(
      await within(sheet).findByText(
        'Solicitud enviada. Verás la respuesta del local en Mis reservas.',
      ),
    ).toBeInTheDocument()
    expect(await within(sheet).findByText(/Tu reserva: .* · 4 personas · Pendiente/)).toBeVisible()
    // A second request for the same night is refused.
    await user.click(within(sheet).getByRole('button', { name: 'Solicitar reserva' }))
    expect(
      await within(sheet).findByText('Ya tienes una reserva en este local esa noche.'),
    ).toBeInTheDocument()
  })

  it('joining the guest list gives a QR and a code in «Mis reservas»', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/discover?place=v-aurora', on)
    const sheet = await sheetOf('Sala Aurora')
    expect(
      await within(sheet).findByText('Lista de invitados: Entrada gratis antes de la 1:30'),
    ).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Apuntarme' }))
    expect(
      await within(sheet).findByText('Estás en la lista. Tu QR está en Mis reservas.'),
    ).toBeInTheDocument()

    await router.navigate('/reservas')
    expect(
      await screen.findByRole('img', { name: 'Código QR de tu entrada en Sala Aurora' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Código: NL-[0-9A-F]{5}-[0-9A-F]{5}$/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salir de la lista' }))
    expect(await screen.findByText('Cancelada')).toBeInTheDocument()
  })

  it('the venue turns bookings on, answers a request, opens a list and checks codes at the door', async () => {
    const user = userEvent.setup()
    renderApp('/venue/v-cobalto', on)
    expect(
      await screen.findByText('Activa «Abrir listas de invitados» para crear una.'),
    ).toBeInTheDocument()
    await user.click(screen.getByText('Aceptar solicitudes de reserva'))
    await user.click(screen.getByText('Abrir listas de invitados'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Guardado.')).toBeInTheDocument()

    // Simulated request: name, party and kind only.
    expect(await screen.findByText('Lucía · 4 personas · Mesa')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(await screen.findByText('Aceptada')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Título'), 'Gratis antes de la 1:30')
    await user.click(screen.getByRole('button', { name: 'Abrir lista' }))
    expect(await screen.findByText(/2 de 50 apuntados · 0 han entrado/)).toBeInTheDocument()

    const code = screen.getByLabelText('Código de la entrada')
    await user.type(code, 'nl-00000-00000')
    await user.click(screen.getByRole('button', { name: 'Validar' }))
    expect(
      await screen.findByText('Código no válido para la lista de esta noche.'),
    ).toBeInTheDocument()
    await user.clear(code)
    await user.type(code, 'NL-A1B2C-3D4E5')
    await user.click(screen.getByRole('button', { name: 'Validar' }))
    expect(await screen.findByText('Lucía puede entrar.')).toBeInTheDocument()
    expect(await screen.findByText(/2 de 50 apuntados · 1 han entrado/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Validar' }))
    expect(await screen.findByText(/Lucía: esta entrada ya se usó a las/)).toBeInTheDocument()
    // This device cannot scan in tests: the code is typed.
    expect(
      screen.getByText('Este dispositivo no puede escanear: teclea el código.'),
    ).toBeInTheDocument()
  })

  it('the guides mention bookings only with the flag on', async () => {
    const off = renderApp('/guia', { services: { state: { onboarded: false } }, settings })
    expect(await screen.findByRole('heading', { name: 'Guía de Nightlife Connect', level: 1 }))
    expect(screen.queryByText(/Reservas y lista de invitados:/)).toBeNull()
    off.unmount()
    renderApp('/guia', { services: { flags, state: { onboarded: false } }, settings })
    expect(await screen.findByText(/Reservas y lista de invitados:/)).toBeVisible()
  })
})
