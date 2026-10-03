import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SecureStorageService } from '@/platform/secure-storage/secure-storage'
import type { Database } from './database.types'

export type Db = SupabaseClient<Database>

/**
 * Single Supabase client. The session lives in the platform's secure storage
 * (PRD 3.3.4): localStorage on the web, Keychain/Keystore in the native apps.
 */
export function createSupabaseClient(
  config: { url: string; publishableKey: string },
  storage: SecureStorageService,
): Db {
  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      storage: {
        getItem: (key) => storage.getItem(key),
        setItem: (key, value) => storage.setItem(key, value),
        removeItem: (key) => storage.removeItem(key),
      },
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
}

/** Current user id or null (never throws: no session ⇒ anonymous). */
export async function currentUserId(db: Db): Promise<string | null> {
  const { data } = await db.auth.getSession()
  return data.session?.user.id ?? null
}

/** True once `complete_onboarding` has run for the signed-in user. */
export async function isOnboarded(db: Db): Promise<boolean> {
  const { data: auth, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw new Error('session_unavailable')
  const uid = auth.session?.user.id
  if (!uid) return false
  const { data, error } = await db
    .from('profiles')
    .select('onboarded_at')
    .eq('id', uid)
    .maybeSingle()
  if (error) throw new Error('profile_unavailable')
  return Boolean(data?.onboarded_at)
}

/** Calls an Edge Function; supabase-js types its error loosely, so normalise it here. */
export async function invokeFunction<T>(
  db: Db,
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; failed: boolean }> {
  const result = await db.functions.invoke<T>(name, { body })
  const failed = Boolean(result.error as unknown)
  return { data: failed ? null : result.data, failed }
}
