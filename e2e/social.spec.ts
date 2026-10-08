import { expect, test } from '@playwright/test'
import { signedIn, t, watchErrors } from './support'

test.describe('Ligar y hablar (edad verificada)', () => {
  test.beforeEach(async ({ page }) => signedIn(page, { ageVerified: true }))

  test('check-in simulado y voto del Vibe Check', async ({ page, context }) => {
    // Lejos del local: la app explica la distancia y ofrece la simulación de pruebas.
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 40.0, longitude: -3.0 })
    const errors = watchErrors(page)
    await page.goto('/places/v-aurora')
    const actions = page.getByRole('region', { name: t('places.actions') })
    await actions.getByRole('button', { name: t('places.checkIn.cta') }).click()
    await expect(page.getByRole('alert')).toContainText(t('places.checkIn.errors.too_far'))
    await page.getByRole('button', { name: t('places.checkIn.simulate') }).click()
    await expect(page.getByText(t('places.checkIn.done', { place: 'Sala Aurora' }))).toBeVisible()

    const vibe = page.getByRole('region', { name: t('places.vibe.title') })
    const fire = vibe.getByRole('button', { name: t('places.vibe.options.fire') })
    await expect(fire).toBeEnabled()
    await fire.click()
    await expect(fire).toHaveAttribute('aria-pressed', 'true')
    errors.expectNone()
  })

  test('swipe: like con match, seguir mirando y paso', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/tonight/swipe')
    const deck = page.getByRole('group', { name: t('matching.deckHint') })
    const firstName = await deck.getByRole('article').first().getAttribute('aria-label')
    await page.getByRole('button', { name: t('matching.like'), exact: true }).click()
    // En el simulador el primer perfil devuelve el like: pantalla de match en tiempo real.
    const match = page.getByRole('dialog')
    await expect(match).toBeVisible()
    await match.getByRole('button', { name: t('matching.match.keepLooking') }).click()
    await expect(match).toBeHidden()
    await expect(deck.getByRole('article').first()).not.toHaveAttribute('aria-label', firstName!)
    const second = await deck.getByRole('article').first().getAttribute('aria-label')
    await page.getByRole('button', { name: t('matching.pass'), exact: true }).click()
    await expect(deck.getByRole('article').first()).not.toHaveAttribute('aria-label', second!)
    errors.expectNone()
  })

  test('chat: enviar un mensaje a un match', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/chats')
    await page.getByRole('link', { name: /Marta/ }).first().click()
    await expect(page).toHaveURL(/\/chats\/m-p-2$/)
    const input = page.getByRole('textbox', { name: t('chats.placeholder') })
    await input.fill('¿Nos vemos en la barra?')
    await page.getByRole('button', { name: t('chats.send'), exact: true }).click()
    await expect(page.getByText('¿Nos vemos en la barra?')).toBeVisible()
    await expect(input).toHaveValue('')
    errors.expectNone()
  })
})
