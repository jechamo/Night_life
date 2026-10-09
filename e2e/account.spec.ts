import { MOCK_OTP, expect, signedIn, t, test, watchErrors } from './support'

test.describe('Cuenta, Premium y ajustes', () => {
  test.beforeEach(async ({ page }) => signedIn(page))

  test('cerrar sesión protege la app y el login pide el código', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/profile')
    await page.getByRole('button', { name: t('profileMenu.signOut') }).click()
    await expect(page).toHaveURL(/\/welcome$/)

    // Sin sesión, las rutas privadas vuelven a la bienvenida.
    await page.goto('/home')
    await expect(page).toHaveURL(/\/welcome$/)

    await page.getByRole('link', { name: t('onboarding.login.cta') }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel(t('onboarding.phone.number')).fill('612345678')
    await page.getByRole('button', { name: t('onboarding.phone.send') }).click()
    await page.getByLabel(t('onboarding.phone.codeLabel')).fill('000000')
    await page.getByRole('button', { name: t('onboarding.phone.verify') }).click()
    await expect(page.getByText(t('onboarding.phone.errors.wrong_code'))).toBeVisible()
    await page.getByLabel(t('onboarding.phone.codeLabel')).fill(MOCK_OTP)
    await page.getByRole('button', { name: t('onboarding.phone.verify') }).click()
    // El simulador trata la cuenta cerrada como alta sin terminar (src/mocks).
    await expect(page.getByText(t('onboarding.login.noAccountTitle'))).toBeVisible()
    errors.expectNone()
  })

  test('Premium: elegir el Pase, confirmar y simular la compra', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/premium')
    await expect(page.getByRole('heading', { name: t('premium.freeTitle') })).toBeVisible()
    // Modo viaje aún no existe: nunca se anuncia como ventaja activa.
    await expect(
      page
        .getByText(t('premium.benefitSoon', { benefit: t('premium.benefits.travel_mode') }))
        .first(),
    ).toBeVisible()
    await page.getByRole('button', { name: /^Pase Sal sin límites/ }).click()
    await page.getByRole('button', { name: t('premium.continue'), exact: true }).click()
    await expect(page).toHaveURL(/\/premium\/checkout\/pass_monthly$/)
    await expect(page.getByRole('link', { name: /Premium/ })).toHaveAttribute(
      'href',
      '/legal/premium',
    )
    // Paying requires the express request to start now (TRLGDCU arts. 103/108).
    const subscribe = page.getByRole('button', { name: t('premium.checkout.subscribe') })
    await expect(subscribe).toBeDisabled()
    await page
      .getByRole('checkbox', { name: t('premium.checkout.immediateStart.subscription') })
      .click()
    await subscribe.click()
    await expect(page).toHaveURL(/\/premium\/test-checkout\/pass_monthly$/)
    await page.getByRole('button', { name: t('premium.testCheckout.pay') }).click()
    await expect(page).toHaveURL(/\/premium\/return/)
    await expect(page.getByText(t('premium.return.simulated'))).toBeVisible()
    errors.expectNone()
  })

  test('temas: el cambio se aplica y se recuerda al recargar', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/profile/themes')
    await page.getByRole('button', { name: new RegExp(`^${t('themes.velvet.name')}`) }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'velvet')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'velvet')
    errors.expectNone()
  })

  test('ajustes: cambiar el idioma a inglés', async ({ page }) => {
    await page.goto('/profile/settings')
    await page.getByRole('radio', { name: t('settings.language.en') }).click()
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  })
})
