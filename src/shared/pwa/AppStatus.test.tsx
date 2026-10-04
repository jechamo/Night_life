import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render-app'
import { createFakePlatform } from '@/platform/testing'

describe('PWA status', () => {
  it('offers an explicit update while preserving the screen', async () => {
    const user = userEvent.setup()
    const applyUpdate = vi.fn()
    const state = { online: true, updateAvailable: true }
    renderApp('/profile/settings', {
      platform: {
        appUpdates: { ...createFakePlatform().appUpdates, getSnapshot: () => state, applyUpdate },
      },
    })
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.getByText(/Termina lo que estés escribiendo/)).toHaveAttribute('role', 'status')
    expect(applyUpdate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Actualizar ahora' }))
    expect(applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not offer a reload without connectivity', async () => {
    const state = { online: false, updateAvailable: true }
    renderApp('/profile/settings', {
      platform: { appUpdates: { ...createFakePlatform().appUpdates, getSnapshot: () => state } },
    })
    expect(screen.getByText('Sin conexión. Los datos no se pueden actualizar.')).toHaveAttribute(
      'role',
      'status',
    )
    expect(screen.queryByRole('button', { name: 'Actualizar ahora' })).not.toBeInTheDocument()
    await screen.findByRole('heading', { name: 'Ajustes' })
  })
})
