import { createSupabaseServices } from '@/adapters/supabase'
import { createMockServices } from '@/mocks/mock-services'
import type { Platform } from '@/platform'
import { env } from '@/shared/config/env'
import type { AppServices } from '@/shared/services/services'

/** Composition root: Supabase when configured (Block 5+), otherwise the full mock. */
export function createAppServices(platform: Platform): AppServices {
  if (import.meta.env.PROD && !env.supabase)
    throw new Error('Missing production backend configuration')
  const simulated = createMockServices({ preferences: platform.preferences })
  return env.supabase ? createSupabaseServices(env.supabase, platform, simulated) : simulated
}
