import { expect, MOCK_OTP, signedIn, t, test, watchErrors } from './support'

// Roadmap R3: partners and contracts behind `venue_partners_enabled` (simulated backend).
// Flags live in memory, so after turning it on every step navigates inside the app.
test.describe('Partners y contratos (flag)', () => {
  test.beforeEach(async ({ page }) => signedIn(page))

  test('con el flag apagado el panel de locales no cambia', async ({ page }) => {
    await page.goto('/venue')
    await expect(page.getByRole('link', { name: /Bar Cobalto/ })).toBeVisible()
    await expect(page.getByText(t('venuePanel.partners.haveCode'))).toHaveCount(0)
    await page.getByRole('link', { name: /Bar Cobalto/ }).click()
    await expect(page.getByText(t('venuePanel.partners.sectionPlan'))).toHaveCount(0)
  })

  test('admin crea empresa, contrato Top + Pro e invitación; el local la canjea', async ({
    page,
  }) => {
    const errors = watchErrors(page)
    await page.goto('/admin')
    await page.getByRole('textbox', { name: t('admin.mfa.code') }).fill(MOCK_OTP)
    await page.getByRole('button', { name: t('admin.mfa.verify') }).click()
    await page.getByRole('link', { name: t('admin.nav.flags') }).click()
    const flag = page.getByRole('radiogroup', { name: 'venue_partners_enabled' })
    await flag.getByRole('radio', { name: 'on' }).click()
    await expect(flag.getByRole('radio', { name: 'on' })).toBeChecked()

    await page.getByRole('link', { name: t('admin.nav.partners') }).click()
    await page.getByRole('button', { name: t('admin.partners.new') }).click()
    await page.getByLabel(t('admin.partners.fields.legalName')).fill('Noches Aurora SL')
    await page.getByLabel(t('admin.partners.fields.taxId')).fill('B12345678')
    await page.getByLabel(t('admin.partners.fields.contactName')).fill('Marta Gil')
    await page.getByLabel(t('admin.partners.fields.billingEmail')).fill('facturas@aurora.test')
    await page.getByRole('button', { name: t('admin.partners.save') }).click()
    const card = page.getByRole('region', { name: 'Noches Aurora SL' })
    await card.getByLabel(t('admin.partners.venues.search')).fill('Aurora')
    await card.getByRole('button', { name: t('admin.partners.venues.link') }).click()
    await card.getByLabel(t('admin.partners.contracts.reference')).fill('NL-2026-001')
    await card.getByRole('radio', { name: t('admin.partners.contracts.tiers.top') }).click()
    await card.getByText(t('admin.partners.contracts.pro')).click()
    await card.getByLabel(t('admin.partners.contracts.endsOn')).fill('2027-12-31')
    await card.getByRole('button', { name: t('admin.partners.contracts.create') }).click()
    await card.getByRole('button', { name: t('admin.partners.contracts.activate') }).click()
    await expect(card.getByText(t('admin.partners.contracts.status.active'))).toBeVisible()
    await card.getByRole('button', { name: t('admin.partners.venues.invite') }).click()
    const codeText = await card.getByText(/^Código: /).textContent()
    const code = codeText!.replace('Código: ', '').trim()

    // The simulated person redeems it from the venue panel (in-app navigation).
    await page.getByRole('link', { name: t('admin.exit') }).click()
    await page.getByRole('link', { name: new RegExp(t('venuePanel.title')) }).click()
    await page.getByRole('link', { name: t('venuePanel.partners.haveCode') }).click()
    await page.getByLabel(t('venuePanel.partners.invite.codeLabel')).fill(code)
    await page.getByRole('button', { name: t('venuePanel.partners.invite.check') }).click()
    await expect(
      page.getByText(t('venuePanel.partners.invite.account', { name: 'Noches Aurora SL' })),
    ).toBeVisible()
    await page.getByText(/He leído y acepto las Condiciones para Locales/).click()
    await page.getByRole('button', { name: t('venuePanel.partners.invite.redeem') }).click()
    await expect(page).toHaveURL(/\/venue\/v-aurora$/)
    await expect(page.getByText(/Contrato NL-2026-001/)).toBeVisible()
    await expect(page.getByText(/^Top · incluido en tu contrato/)).toBeVisible()
    await expect(
      page.getByRole('button', { name: t('venuePanel.partners.team.invite') }),
    ).toBeVisible()
    errors.expectNone()
  })
})
