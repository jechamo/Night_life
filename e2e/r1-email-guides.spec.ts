import { expect, MOCK_OTP, signedIn, t, test, watchErrors } from './support'

// Roadmap R1: public guides and email sign-in (simulated backend, no real email sent).
test.describe('Guías públicas', () => {
  test('guía de la app y de locales sin cuenta, enlazadas desde bienvenida y legal', async ({
    page,
  }) => {
    const errors = watchErrors(page)
    await page.goto('/welcome')
    await page.getByRole('link', { name: t('guide.nav.howItWorks') }).click()
    await expect(page).toHaveURL(/\/guia$/)
    await expect(page.getByRole('heading', { name: t('guide.user.title'), level: 1 })).toBeVisible()
    await page.getByRole('link', { name: t('guide.links.otherUser') }).click()
    await expect(page).toHaveURL(/\/guia\/locales$/)
    await expect(
      page.getByRole('heading', { name: t('guide.venues.title'), level: 1 }),
    ).toBeVisible()
    await page.getByRole('link', { name: t('guide.links.terms') }).click()
    await expect(page).toHaveURL(/\/legal\/venues$/)

    await page.goto('/legal')
    await page
      .getByRole('main')
      .getByRole('link', { name: new RegExp(t('guide.nav.venues')) })
      .click()
    await expect(page).toHaveURL(/\/guia\/locales$/)
    errors.expectNone()
  })
})

test.describe('Entrar con email (flag)', () => {
  test.beforeEach(async ({ page }) => signedIn(page))

  test('con el flag apagado el login sigue siendo solo SMS', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('button', { name: t('profileMenu.signOut') }).click()
    await page.getByRole('link', { name: t('onboarding.login.cta') }).click()
    await expect(page.getByLabel(t('onboarding.phone.number'))).toBeVisible()
    await expect(page.getByRole('button', { name: t('onboarding.login.useEmail') })).toHaveCount(0)
  })

  test('admin lo activa, el usuario añade su email y vuelve a entrar sin SMS', async ({ page }) => {
    const errors = watchErrors(page)
    // 1. Admin (segundo factor simulado) enciende email_login_enabled.
    await page.goto('/admin')
    await page.getByRole('textbox', { name: t('admin.mfa.code') }).fill(MOCK_OTP)
    await page.getByRole('button', { name: t('admin.mfa.verify') }).click()
    await page.getByRole('link', { name: t('admin.nav.flags') }).click()
    await page
      .getByRole('radiogroup', { name: 'email_login_enabled' })
      .getByRole('radio', { name: 'on' })
      .click()
    await expect(
      page
        .getByRole('radiogroup', { name: 'email_login_enabled' })
        .getByRole('radio', { name: 'on' }),
    ).toBeChecked()

    // 2. Ajustes › Cuenta: añadir el email (navegación dentro de la app, sin recargar).
    await page.getByRole('link', { name: t('admin.exit') }).click()
    await page.getByRole('link', { name: new RegExp(t('settings.title')) }).click()
    await page.getByLabel(t('settings.account.newEmail')).fill('ana@example.test')
    await page.getByRole('button', { name: t('settings.account.save') }).click()
    await expect(
      page.getByText(t('settings.account.sent', { email: 'ana@example.test' })),
    ).toBeVisible()

    // 3. Cerrar sesión y entrar con código por email.
    await page.getByRole('link', { name: t('common.back') }).click()
    await page.getByRole('button', { name: t('profileMenu.signOut') }).click()
    await page.getByRole('link', { name: t('onboarding.login.cta') }).click()
    await page.getByLabel(t('onboarding.login.emailLabel')).fill('ana@example.test')
    await page.getByRole('button', { name: t('onboarding.login.emailSend') }).click()
    await page.getByLabel(t('onboarding.phone.codeLabel')).fill(MOCK_OTP)
    await page.getByRole('button', { name: t('onboarding.phone.verify') }).click()
    await expect(page).toHaveURL(/\/home$/)
    errors.expectNone()
  })
})
