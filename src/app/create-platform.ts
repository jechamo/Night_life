import { createWebPlatform, detectRuntime, type Platform, type PlatformRuntime } from '@/platform'

export interface CreatePlatformOptions {
  appUrl: string | undefined
  runtime?: PlatformRuntime
  /** Injected in tests; production loads the native entry with a dynamic import. */
  loadNative?: () => Promise<{
    createNativePlatform: (options: { appUrl: string }) => Platform
  }>
}

/**
 * The factory is chosen by runtime BEFORE any service exists (NATIVE.md): the
 * Capacitor shell never falls back to web adapters, and the web bundle never
 * loads the native plugins (dynamic import).
 */
export async function createPlatform({
  appUrl,
  runtime = detectRuntime(),
  loadNative = () => import('@/platform/native'),
}: CreatePlatformOptions): Promise<Platform> {
  if (runtime === 'web') return createWebPlatform({ appUrl })
  if (!appUrl) throw new Error('Missing VITE_APP_URL for the native shell')
  document.documentElement.dataset.runtime = 'native'
  const { createNativePlatform } = await loadNative()
  return createNativePlatform({ appUrl })
}
