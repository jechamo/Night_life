import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { ok } from '@/shared/lib/result'
import { renderApp } from '@/test/render-app'

const fresh = {
  services: { state: { onboarded: false } },
  settings: { reduceMotion: true },
  platform: {
    camera: {
      pickPhoto: () => Promise.resolve(ok(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))),
      openLiveStream: () => Promise.reject(new Error('not used')),
    },
  },
}

async function passBirthdate(date: string) {
  const input = await screen.findByLabelText('Fecha de nacimiento')
  fireEvent.change(input, { target: { value: date } })
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
}

describe('onboarding (Block 2 "done when")', () => {
  it('can be completed end to end and nothing is ever pre-ticked', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/', fresh)

    // Not onboarded → welcome → skip to the flow.
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'))
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'))
    await passBirthdate('1995-06-15')

    // Signature screen: three unticked boxes, sign disabled until all are ticked.
    const sign = await screen.findByRole('button', { name: 'Firmo y acepto' })
    await screen.findAllByRole('button', { name: /^Leer/ })
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    boxes.forEach((box) => expect(box).not.toBeChecked())
    expect(sign).toBeDisabled()
    for (const box of boxes) await user.click(box)
    await user.click(sign)

    // Phone + OTP (+ optional email skipped).
    await user.type(await screen.findByLabelText('Número de móvil'), '612345678')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await user.click(await screen.findByRole('button', { name: 'Saltar' }))

    // Consents: all OFF; orientation needs a signature; no location → city.
    await screen.findByText('Tu privacidad, tus reglas')
    screen.getAllByRole('switch').forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'))
    await user.click(screen.getByRole('switch', { name: /Orientación y preferencias/ }))
    const sheet = await screen.findByRole('dialog')
    const signConsent = within(sheet).getByRole('button', { name: 'Firmo y consiento' })
    expect(within(sheet).getByRole('checkbox')).not.toBeChecked()
    expect(signConsent).toBeDisabled()
    await user.click(within(sheet).getByRole('checkbox'))
    await user.click(signConsent)
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /Orientación y preferencias/ })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    )
    await user.selectOptions(screen.getByLabelText('Ciudad para explorar'), 'Madrid')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Profile: 2 photos, name, gender.
    await user.click(await screen.findByRole('button', { name: 'Añadir foto' }))
    await user.click(await screen.findByRole('button', { name: 'Añadir foto' }))
    await user.type(screen.getByLabelText('Nombre'), 'Alex')
    await user.click(screen.getByRole('radio', { name: 'Otro' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Preferences (only because orientation was consented).
    await user.click(await screen.findByRole('button', { name: 'Mujeres' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    // Theme → into the app.
    await user.click(await screen.findByRole('button', { name: 'Entrar en la noche' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'))
  }, 20_000)

  it('under 18: shows a neutral stop screen and creates nothing', async () => {
    renderApp('/onboarding', fresh)
    await passBirthdate('2012-03-03')
    expect(await screen.findByText('No podemos crear tu cuenta')).toBeInTheDocument()
  })

  it('"No acepto" stops the flow without creating an account', async () => {
    const user = userEvent.setup()
    renderApp('/onboarding', fresh)
    await passBirthdate('1990-01-01')
    await user.click(await screen.findByRole('button', { name: 'No acepto' }))
    expect(await screen.findByText('Sin aceptar no podemos continuar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revisar los documentos' }))
    expect(await screen.findByRole('button', { name: 'Firmo y acepto' })).toBeDisabled()
  })

  it('blocks the banned phone with a generic message', async () => {
    const user = userEvent.setup()
    renderApp('/onboarding', fresh)
    await passBirthdate('1990-01-01')
    for (const box of await screen.findAllByRole('checkbox')) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Firmo y acepto' }))
    await user.type(await screen.findByLabelText('Número de móvil'), '600000000')
    await user.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(
      await screen.findByText('No podemos completar el alta con este número.'),
    ).toBeInTheDocument()
  })
})

describe('"Verifica tu edad" gate', () => {
  it('blocks flirting until the age is verified in the sandbox', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/tonight', {
      settings: { reduceMotion: true },
      services: { flags: { verification_provider: 'simulator' } },
    })

    await user.click(await screen.findByRole('button', { name: 'Ver perfiles' }))
    const gate = await screen.findByRole('dialog', { name: 'Verifica tu edad' })
    await user.click(within(gate).getByRole('button', { name: 'Verificar ahora' }))

    await user.click(await screen.findByRole('button', { name: 'Continuar la verificación' }))
    await user.click(await screen.findByRole('button', { name: 'Aprobado' }))
    expect(await screen.findByText('¡Verificación completada!')).toBeInTheDocument()

    await router.navigate('/tonight')
    await user.click((await screen.findAllByRole('button', { name: 'Ver perfiles' }))[0]!)
    await waitFor(() => expect(router.state.location.pathname).toBe('/tonight/swipe'))
    expect(await screen.findByRole('button', { name: 'Me gusta' })).toBeInTheDocument()
  })
})

describe('language on the welcome screen', () => {
  it('lets you pick ES/EN before signing up and remembers it', async () => {
    const user = userEvent.setup()
    const { platform } = renderApp('/welcome', fresh)
    await user.click(await screen.findByRole('radio', { name: 'EN' }))
    expect(await screen.findByText('See where the vibe is, right now')).toBeInTheDocument()
    await expect(platform.preferences.get(PREFERENCE_KEYS.language)).resolves.toBe('en')
    // Back to Spanish so the shared i18n instance doesn't leak into other tests.
    await user.click(screen.getByRole('radio', { name: 'ES' }))
    expect(await screen.findByText('Mira dónde hay ambiente, ahora')).toBeInTheDocument()
  })
})
