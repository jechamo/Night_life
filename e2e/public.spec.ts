import { expect, t, test, watchErrors } from './support'

// Sin sesión: la web pública y legal debe funcionar siempre (PRD 5.1).
test.describe('Web pública sin login', () => {
  test('índice legal → documento → contacto y vuelta a la app', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/legal')
    await expect(page.getByRole('heading', { name: t('publicWeb.title'), level: 1 })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Términos y Condiciones' }).click()
    await expect(page).toHaveURL(/\/legal\/terms$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('/legal/contact')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('link', { name: t('publicWeb.openApp') }).click()
    await expect(page).toHaveURL(/\/welcome$/)
    errors.expectNone()
  })

  test('formulario de contenido ilegal y página de borrado de cuenta', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/legal/illegal-content')
    await expect(page.getByRole('heading', { name: t('publicWeb.illegal.title') })).toBeVisible()
    await expect(page.getByLabel(t('publicWeb.illegal.url'))).toBeVisible()
    await page.goto('/legal/delete-account')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    errors.expectNone()
  })

  test('bienvenida en inglés y página inexistente', async ({ page }) => {
    await page.goto('/welcome')
    await page.getByRole('radio', { name: 'EN' }).click()
    await expect(page.getByRole('link', { name: 'I already have an account' })).toBeVisible()
    await page.getByRole('radio', { name: 'ES' }).click()
    await expect(page.getByRole('link', { name: t('onboarding.login.cta') })).toBeVisible()

    await page.goto('/no-existe')
    await expect(page.getByText(t('errors.notFound.title'))).toBeVisible()
  })
})
