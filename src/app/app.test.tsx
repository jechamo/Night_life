import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { renderApp } from '@/test/render-app'

describe('app shell', () => {
  it('redirects to Discover and marks the active tab', async () => {
    const { router } = renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'))
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Descubre' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    )
  })

  it('shows a friendly not-found screen', async () => {
    renderApp('/nope')
    expect(await screen.findByText('Aquí no hay fiesta')).toBeInTheDocument()
  })
})

describe('themes (Block 1 "done when")', () => {
  it('switching theme updates the document and persists the choice', async () => {
    const user = userEvent.setup()
    const { platform } = renderApp('/profile/themes')
    expect(document.documentElement.dataset.theme).toBe('neon-noir')

    await user.click(await screen.findByRole('button', { name: /Velvet/ }))

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('velvet'))
    expect(screen.getByRole('button', { name: /Velvet/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(platform.preferences.get(PREFERENCE_KEYS.theme)).resolves.toBe('velvet')
  })

  it('the Mono theme forces reduced motion', async () => {
    renderApp('/discover', { settings: { themeId: 'mono' } })
    await screen.findByRole('navigation')
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })
})

describe('reduce motion setting', () => {
  it('toggling it switches the whole app to fades and persists', async () => {
    const user = userEvent.setup()
    const { platform } = renderApp('/profile/settings')
    await screen.findByRole('navigation')
    expect(document.documentElement.dataset.motion).toBe('full')

    await user.click(await screen.findByRole('switch', { name: /Reducir movimiento/ }))

    expect(document.documentElement.dataset.motion).toBe('reduced')
    await expect(platform.preferences.get(PREFERENCE_KEYS.reduceMotion)).resolves.toBe('true')
  })
})

describe('test tools gate', () => {
  it('shows the component kit while test tools are on', async () => {
    renderApp('/dev/kit')
    expect(await screen.findByRole('heading', { name: 'Kit de componentes' })).toBeInTheDocument()
  })

  it('redirects away when test_tools_enabled is off', async () => {
    const { router } = renderApp('/dev/kit', { services: { flags: { test_tools_enabled: 'off' } } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
    expect(screen.queryByText('Kit de componentes')).not.toBeInTheDocument()
  })
})
