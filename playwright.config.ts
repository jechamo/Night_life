import { defineConfig, devices } from '@playwright/test'

/**
 * Browser regression suite (roadmap 2026-10, block 0). It drives the real SPA on the
 * simulated backend (src/mocks): the Supabase variables are blanked so a local
 * .env.local can never point these tests at the shared project. A dedicated port and a
 * fresh server per run mean an open `npm run preview` (real backend) is never reused,
 * and e2e/support.ts aborts any request that leaves the local app.
 * PW_CHROMIUM_PATH lets sandboxes reuse a preinstalled Chromium.
 */
export const E2E_PORT = 4399
const PORT = E2E_PORT
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/welcome`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
})
