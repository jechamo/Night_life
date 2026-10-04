import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { initI18n } from '@/i18n'

// jsdom lacks matchMedia; Motion's useReducedMotion needs it. Tests can override it.
const isDom = typeof window !== 'undefined'
// Route components load asynchronously; cold imports can overlap in CI workers.
configure({ asyncUtilTimeout: 3000 })

if (isDom && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })
}

// jsdom lacks ResizeObserver; Radix Slider measures its thumbs with it.
if (isDom && typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

beforeAll(async () => {
  if (isDom) await initI18n('es')
})

afterEach(() => {
  if (!isDom) return
  cleanup()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-motion')
})
