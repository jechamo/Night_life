import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

const verified = {
  services: {
    state: {
      verification: {
        age: { state: 'verified', verifiedAt: '2026-10-02T21:00:00Z' },
        photo: { state: 'not_started' },
        identity: { state: 'not_started' },
      },
    },
  },
  settings: { reduceMotion: true },
} as const

describe('Descubre (Block 3)', () => {
  it('shows live pins and opens the place sheet with "Quién hay"', async () => {
    const user = userEvent.setup()
    renderApp('/discover', { settings: { reduceMotion: true } })
    const pin = await screen.findByRole('button', { name: /^Sala Aurora, Discoteca, 142 personas/ })
    await user.click(pin)
    const sheet = await screen.findByRole('dialog', { name: 'Sala Aurora' })
    expect(within(sheet).getByText('Quién hay')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Esta Noche Voy' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Estoy Aquí' })).toBeInTheDocument()
  })

  it('applies the privacy threshold below 5 people', async () => {
    renderApp('/discover?place=v-sotano', { settings: { reduceMotion: true } })
    const sheet = await screen.findByRole('dialog', { name: 'El Sótano' })
    expect(within(sheet).getByText('<5')).toBeInTheDocument()
    expect(
      within(sheet).getByText('Por privacidad, con menos de 5 personas no mostramos más datos.'),
    ).toBeInTheDocument()
  })

  it('test tools can simulate a check-in when the user is far away', async () => {
    const user = userEvent.setup()
    renderApp('/discover?place=v-lantern', { settings: { reduceMotion: true } })
    const sheet = await screen.findByRole('dialog', { name: 'The Old Lantern' })
    await user.click(within(sheet).getByRole('button', { name: 'Estoy Aquí' }))
    await user.click(
      await within(sheet).findByRole('button', { name: 'Simular que estoy aquí (pruebas)' }),
    )
    expect(await within(sheet).findByRole('button', { name: 'Salir de aquí' })).toBeInTheDocument()
  })
})

describe('Swipe, match and chat (Block 3 "done when")', () => {
  it('a like on someone who liked you opens the match screen and leads to the chat', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/tonight/swipe/v-aurora', verified)
    expect(await screen.findByRole('article', { name: 'Lucía, 26' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Me gusta' }))
    const match = await screen.findByRole('dialog', { name: '¡Es un match!' })
    const icebreaker = within(match).getByRole('button', { name: /¿Rosalía también/ })
    const text = icebreaker.textContent ?? ''
    await user.click(icebreaker)
    // The written message is sent from the match screen: the conversation exists already.
    await user.click(within(match).getByRole('button', { name: 'Enviar mensaje' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/m-p-1'))
    expect(await screen.findByText(text)).toBeInTheDocument()
    const input = await screen.findByLabelText('Escribe un mensaje')
    expect((input as HTMLTextAreaElement).value).toBe('')
    await router.navigate('/chats')
    // Listed under "Conversaciones" with the message as its last line.
    expect(await screen.findByText(`Tú: ${text}`)).toBeInTheDocument()
  })

  it('a double tap on "Me gusta" creates only one match', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/tonight/swipe/v-aurora', verified)
    const like = await screen.findByRole('button', { name: 'Me gusta' })
    await Promise.all([user.click(like), user.click(like)])
    const match = await screen.findByRole('dialog', { name: '¡Es un match!' })
    await user.click(within(match).getByRole('button', { name: 'Seguir mirando' }))
    await router.navigate('/chats')
    expect(await screen.findByText('Nuevos matches')).toBeInTheDocument()
    expect(screen.getAllByText('Lucía')).toHaveLength(1)
  })

  it('stops at 5 free likes a day', async () => {
    const user = userEvent.setup()
    renderApp('/tonight/swipe', verified)
    for (let i = 0; i < 5; i++) {
      await user.click(await screen.findByRole('button', { name: 'Me gusta' }))
      const keepLooking = screen.queryAllByRole('button', { name: 'Seguir mirando' })[0]
      if (keepLooking) await user.click(keepLooking)
    }
    await user.click(await screen.findByRole('button', { name: 'Me gusta' }))
    expect(await screen.findByText('Has usado tus likes de hoy')).toBeInTheDocument()
  })

  it('profiles stay locked without age verification', async () => {
    renderApp('/tonight/swipe/v-aurora', { settings: { reduceMotion: true } })
    expect(await screen.findByRole('link', { name: 'Verificar ahora' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Me gusta' })).not.toBeInTheDocument()
  })
})

describe('Crear evento', () => {
  it('publishes a user event as "No confirmado" and shows it on the map', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/events/new', verified)
    await user.type(await screen.findByLabelText('Nombre del evento'), 'Jam session')
    await user.selectOptions(screen.getByLabelText('Lugar público'), 'v-candil')
    const publish = screen.getByRole('button', { name: 'Publicar evento' })
    expect(publish).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(publish)
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'))
    const sheet = await screen.findByRole('dialog', { name: 'Jam session' })
    expect(within(sheet).getAllByText('No confirmado').length).toBeGreaterThan(0)
  })
})
