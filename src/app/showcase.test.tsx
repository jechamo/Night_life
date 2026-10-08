import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ok } from '@/shared/lib/result'
import { renderApp } from '@/test/render-app'

const settings = { reduceMotion: true }
const camera = {
  pickPhoto: () => Promise.resolve(ok(new File(['x'], 'local.jpg', { type: 'image/jpeg' }))),
  openLiveStream: () => Promise.reject(new Error('not used')),
  canDetectQr: () => false,
  detectQr: () => Promise.resolve(null),
}
const on = {
  services: { flags: { venue_showcase_enabled: 'on' } },
  settings,
  platform: { camera },
} as const

async function passMfa(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456')
  await user.click(screen.getByRole('button', { name: 'Verificar' }))
  await screen.findByRole('navigation', { name: 'Secciones del admin' })
}

describe('roadmap R4: venue showcase', () => {
  it('flag off: venue panel, place sheet, admin and guides stay exactly as before', async () => {
    const panel = renderApp('/venue/v-cobalto', { settings })
    expect(await screen.findByRole('heading', { name: 'Bar Cobalto' })).toBeInTheDocument()
    expect(screen.queryByText('Fotos')).toBeNull()
    expect(screen.queryByText('Resultados')).toBeNull()
    expect(screen.queryByText('En directo')).toBeNull()
    panel.unmount()

    const place = renderApp('/discover?place=v-cobalto', { settings })
    const sheet = await screen.findByRole('dialog', { name: 'Bar Cobalto' })
    expect(within(sheet).queryByRole('heading', { name: 'Lo dice el local' })).toBeNull()
    place.unmount()

    const user = userEvent.setup()
    renderApp('/admin', { settings })
    await passMfa(user)
    expect(screen.queryByRole('link', { name: /Fotos de locales/ })).toBeNull()
  })

  it('a manager uploads a photo; it stays hidden until an admin approves it', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/venue/v-cobalto', on)
    expect(await screen.findByText('0 de 3 fotos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Añadir foto' }))
    expect(await screen.findByText('Pendiente de revisión')).toBeInTheDocument()
    expect(screen.getByText('1 de 3 fotos')).toBeInTheDocument()

    // Not visible to people yet.
    await router.navigate('/discover?place=v-cobalto')
    const sheet = await screen.findByRole('dialog', { name: 'Bar Cobalto' })
    expect(within(sheet).queryByRole('img', { name: 'Foto 1 de Bar Cobalto' })).toBeNull()

    await router.navigate('/admin/venue-photos')
    await passMfa(user)
    const card = await screen.findByRole('region', { name: 'Foto de Bar Cobalto' })
    await user.click(within(card).getByRole('button', { name: 'Aprobar' }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Foto de Bar Cobalto' })).toBeNull(),
    )

    await router.navigate('/discover?place=v-cobalto')
    const after = await screen.findByRole('dialog', { name: 'Bar Cobalto' })
    expect(
      await within(after).findByRole('img', { name: 'Foto 1 de Bar Cobalto' }),
    ).toBeInTheDocument()
    expect(within(after).getByText('Lo publica el propio local.')).toBeInTheDocument()
  })

  it('rejections need a reason, which the venue sees', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/venue/v-cobalto', on)
    await user.click(await screen.findByRole('button', { name: 'Añadir foto' }))
    await screen.findByText('Pendiente de revisión')
    await router.navigate('/admin/venue-photos')
    await passMfa(user)
    const card = await screen.findByRole('region', { name: 'Foto de Bar Cobalto' })
    const reject = within(card).getByRole('button', { name: 'Rechazar' })
    expect(reject).toBeDisabled()
    await user.type(within(card).getByLabelText('Motivo (lo verá el local)'), 'Sale una persona')
    await user.click(reject)
    await router.navigate('/venue/v-cobalto')
    expect(await screen.findByText('Rechazada')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Sale una persona')).toBeInTheDocument()
    // Rejected photos do not use a slot.
    expect(screen.getByText('0 de 3 fotos')).toBeInTheDocument()
  })

  it('free venues can have 3 photos', async () => {
    const user = userEvent.setup()
    renderApp('/venue/v-cobalto', on)
    const add = await screen.findByRole('button', { name: 'Añadir foto' })
    for (const n of [1, 2, 3]) {
      await user.click(add)
      expect(await screen.findByText(`${n} de 3 fotos`)).toBeInTheDocument()
    }
    expect(add).toBeDisabled()
    expect(
      screen.getByText('Con un patrocinio o Estadísticas Pro puedes tener hasta 10 fotos.'),
    ).toBeInTheDocument()
  })

  it('door status, offers and details show on the place sheet as «Lo dice el local»', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/venue/v-cobalto', on)
    const door = await screen.findByRole('radiogroup', { name: 'Puerta ahora' })
    await user.click(within(door).getByRole('radio', { name: 'Cola larga' }))
    expect(await screen.findAllByText('Cola larga')).not.toHaveLength(0)

    await user.click(screen.getByRole('radio', { name: 'Dress code: elegante' }))
    await user.click(screen.getByRole('radio', { name: '21+' }))
    await user.type(screen.getByLabelText('Precio de entrada (€)'), '0')
    await user.type(screen.getByLabelText('Precio de una copa (€)'), '9,50')
    await user.click(screen.getByText('Tiene terraza'))
    await user.click(screen.getByRole('button', { name: 'Guardar ficha' }))
    expect(await screen.findByText('Ficha guardada.')).toBeInTheDocument()

    await router.navigate('/discover?place=v-cobalto')
    const sheet = await screen.findByRole('dialog', { name: 'Bar Cobalto' })
    expect(
      await within(sheet).findByRole('heading', { name: 'Lo dice el local' }),
    ).toBeInTheDocument()
    expect(within(sheet).getByText('Cola larga')).toBeInTheDocument()
    expect(within(sheet).getByText('Dress code: elegante')).toBeInTheDocument()
    expect(within(sheet).getByText('Desde 21 años')).toBeInTheDocument()
    expect(within(sheet).getByText('Entrada gratis')).toBeInTheDocument()
    expect(within(sheet).getByText('Copa: 9,50 €')).toBeInTheDocument()
    expect(within(sheet).getByText('Terraza')).toBeInTheDocument()
  })

  it('invalid prices are not saved', async () => {
    const user = userEvent.setup()
    renderApp('/venue/v-cobalto', on)
    await user.type(await screen.findByLabelText('Precio de una copa (€)'), '9.999')
    expect(screen.getByText('Precio no válido.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar ficha' })).toBeDisabled()
  })

  it('the results report is aggregated; the night-by-night detail needs Pro', async () => {
    renderApp('/venue/v-cobalto', on)
    expect(await screen.findByText('Vistas de la ficha')).toBeInTheDocument()
    expect(screen.getByText('De «Voy» a check-in')).toBeInTheDocument()
    expect(screen.getByText('Sin patrocinios ni Flash en los últimos 90 días.')).toBeInTheDocument()
    expect(screen.getByText(/Con Estadísticas Pro ves la evolución por noche/)).toBeInTheDocument()
  })

  it('shows «menos de 5» below the threshold and the Pro detail when included', async () => {
    const period = (views: number) => ({
      from: '2026-09-09',
      to: '2026-10-08',
      views,
      going: 3,
      checkIns: 12,
      conversion: null,
    })
    const { services } = renderApp('/venue/v-cobalto', on)
    services.venuePanel.report = () =>
      Promise.resolve({
        pro: true,
        summary: period(0),
        previous: period(40),
        daily: [{ night: '2026-10-03', views: 20, checkIns: 8 }],
        sponsorships: [],
        flashes: [
          {
            title: '2x1 hasta la 1',
            startsAt: '2026-10-03T22:00:00Z',
            endsAt: '2026-10-03T23:00:00Z',
            checkIns: 9,
            weekBefore: 0,
          },
        ],
      })
    expect(await screen.findByText('Evolución por noche (Estadísticas Pro)')).toBeInTheDocument()
    expect(screen.getAllByText('Menos de 5').length).toBeGreaterThan(0)
    expect(screen.getByText(/2x1 hasta la 1/)).toBeInTheDocument()
    expect(screen.getByText(/durante la alerta y 3 h después: 9/)).toBeInTheDocument()
  })

  it('the guides mention the showcase only with the flag on', async () => {
    const off = renderApp('/guia/locales', { services: { state: { onboarded: false } }, settings })
    expect(await screen.findByRole('heading', { name: 'Guía para locales', level: 1 }))
    expect(screen.queryByText(/Fotos: gratis hasta 3/)).toBeNull()
    off.unmount()
    renderApp('/guia/locales', {
      ...on,
      services: { ...on.services, state: { onboarded: false } },
    })
    expect(await screen.findByText(/Fotos: gratis hasta 3/)).toBeVisible()
    expect(screen.getByText(/Resultados: vistas de tu ficha/)).toBeVisible()
  })
})
