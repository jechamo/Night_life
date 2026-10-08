import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

const settings = { reduceMotion: true }
const on = { services: { flags: { live_status_enabled: 'on' } }, settings } as const

describe('roadmap R2: «Cómo está ahora»', () => {
  it('flag off: the place sheet stays exactly as before (Vibe Check only)', async () => {
    renderApp('/discover?place=v-aurora', { settings })
    const sheet = await screen.findByRole('dialog', { name: 'Sala Aurora' })
    expect(within(sheet).getByRole('heading', { name: 'Vibe Check' })).toBeInTheDocument()
    expect(within(sheet).queryByRole('heading', { name: 'Cómo está ahora' })).toBeNull()
  })

  it('flag on: shows anonymous totals, the venue music and the usual crowd', async () => {
    renderApp('/discover?place=v-aurora', on)
    const sheet = await screen.findByRole('dialog', { name: 'Sala Aurora' })
    const section = (await within(sheet).findByRole('heading', { name: 'Cómo está ahora' }))
      .parentElement!.parentElement!
    expect(await within(section).findByText('A tope · 60 %')).toBeInTheDocument()
    expect(within(section).getByText('Poca cola · 71 %')).toBeInTheDocument()
    expect(within(section).getByText('El local dice: Reguetón · Comercial')).toBeInTheDocument()
    expect(within(section).getByText('La gente dice: Reguetón (63 %)')).toBeInTheDocument()
    expect(within(section).getByText('Normalmente a esta hora: A tope')).toBeInTheDocument()
    expect(within(section).getByText('Haz check-in aquí para responder.')).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Vibe Check' })).toBeInTheDocument()
  })

  it('after a check-in the person answers with one tap', async () => {
    const user = userEvent.setup()
    renderApp('/discover?place=v-lantern', on)
    const sheet = await screen.findByRole('dialog', { name: 'The Old Lantern' })
    await user.click(within(sheet).getByRole('button', { name: 'Estoy Aquí' }))
    await user.click(
      await within(sheet).findByRole('button', { name: 'Simular que estoy aquí (pruebas)' }),
    )
    const crowd = await within(sheet).findByRole('group', { name: 'Tu respuesta: Gente' })
    await user.click(within(crowd).getByRole('button', { name: 'Lleno' }))
    expect(await within(crowd).findByRole('button', { name: 'Lleno', pressed: true })).toBeVisible()
    // One vote is below the minimum: totals stay hidden.
    expect(within(sheet).getAllByText('Aún pocos votos').length).toBeGreaterThan(0)
  })

  it('the venue panel declares music only with the flag on', async () => {
    const off = renderApp('/venue/v-cobalto', { settings })
    expect(await screen.findByRole('heading', { name: 'Bar Cobalto' })).toBeInTheDocument()
    expect(screen.queryByText('Música y ambiente')).toBeNull()
    off.unmount()

    const user = userEvent.setup()
    renderApp('/venue/v-cobalto', on)
    expect(await screen.findByText('Música y ambiente')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Techno' }))
    await user.click(screen.getByRole('button', { name: 'House' }))
    // Indie was already declared: a 4th style is not allowed.
    expect(screen.getByRole('button', { name: 'Rock' })).toBeDisabled()
    await user.type(screen.getByLabelText('Line-up de esta noche'), 'DJ Uno')
    await user.click(screen.getByRole('button', { name: 'Guardar música' }))
    expect(await screen.findByText('Guardado.')).toBeInTheDocument()
    expect(screen.getByText('El local dice: Indie · Techno · House')).toBeInTheDocument()
    expect(screen.getByText('Esta noche: DJ Uno')).toBeInTheDocument()
  })

  it('guides mention the feature only when it is on', async () => {
    const off = renderApp('/guia', { services: { state: { onboarded: false } }, settings })
    expect(await screen.findByRole('heading', { name: 'Guía de Nightlife Connect', level: 1 }))
    expect(screen.queryByText(/^Cómo está ahora:/)).toBeNull()
    off.unmount()
    renderApp('/guia/locales', {
      services: { state: { onboarded: false }, flags: { live_status_enabled: 'on' } },
      settings,
    })
    expect(await screen.findByText(/^Música y ambiente: declara hasta 3 estilos/)).toBeVisible()
  })
})
