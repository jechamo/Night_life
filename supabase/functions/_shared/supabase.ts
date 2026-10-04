import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.117.2'

const url = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/** Client acting AS the caller: every query goes through RLS (never trust the body). */
export function userClient(req: Request): SupabaseClient {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Privileged client. The service_role key never leaves Edge Functions (PRD 6.15 A01). */
export function serviceClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function requireUser(
  req: Request,
): Promise<{ db: SupabaseClient; user: User } | null> {
  const db = userClient(req)
  const { data, error } = await db.auth.getUser()
  return error || !data.user ? null : { db, user: data.user }
}
