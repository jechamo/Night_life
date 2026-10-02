import type { PlatformRuntime } from './types'

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
}

/** Capacitor injects `window.Capacitor` in the native shell (Annex B). */
export function detectRuntime(): PlatformRuntime {
  const capacitor = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
  return capacitor?.isNativePlatform?.() ? 'native' : 'web'
}
