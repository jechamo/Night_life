import { z } from 'zod'

/**
 * Public build-time configuration. Only PUBLIC values may appear here (PRD 3.2):
 * secrets live in Supabase Secrets and are used from Edge Functions only. The
 * Supabase URL and publishable key are public by design (RLS protects the data).
 */
const EnvSchema = z.object({
  VITE_APP_URL: z.union([z.url({ protocol: /^https?$/ }), z.literal('')]).optional(),
  VITE_SUPABASE_URL: z.union([z.url({ protocol: /^https$/ }), z.literal('')]).optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
})

const parsed = EnvSchema.safeParse(import.meta.env)
const data = parsed.success ? parsed.data : {}

export const env = {
  appUrl: data.VITE_APP_URL || undefined,
  supabase:
    data.VITE_SUPABASE_URL && data.VITE_SUPABASE_PUBLISHABLE_KEY
      ? { url: data.VITE_SUPABASE_URL, publishableKey: data.VITE_SUPABASE_PUBLISHABLE_KEY }
      : null,
} as const
