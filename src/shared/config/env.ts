import { z } from 'zod'

/**
 * Public build-time configuration. Only PUBLIC values may appear here (PRD 3.2):
 * secrets live in Supabase Secrets and are used from Edge Functions only.
 */
const EnvSchema = z.object({
  VITE_APP_URL: z.union([z.url({ protocol: /^https?$/ }), z.literal('')]).optional(),
})

const parsed = EnvSchema.safeParse(import.meta.env)

export const env = {
  appUrl: parsed.success && parsed.data.VITE_APP_URL ? parsed.data.VITE_APP_URL : undefined,
} as const
