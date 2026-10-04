import { z } from 'zod'
import type { EntitlementService } from '@/shared/entitlements/entitlement-service'
import {
  ENTITLEMENT_KEYS,
  ENTITLEMENT_SOURCES,
  type Entitlement,
  type EntitlementKey,
  type EntitlementSource,
} from '@/shared/entitlements/entitlements'
import type { FlagSource } from '@/shared/flags/flag-service'
import { ROLES, type Role } from '@/shared/session/roles'
import type { SessionService } from '@/shared/session/session-service'
import { currentUserId, type Db } from './client'
import { must } from './errors'

/** Flags are public rows of `app_settings`; the flag service validates and fails closed. */
export function createFlagSource(db: Db): FlagSource {
  return {
    async load() {
      const rows = must(await db.from('app_settings').select('key, value').eq('kind', 'flag'))
      return Object.fromEntries(rows.map((r) => [r.key, r.value]))
    },
  }
}

export function createSessionService(db: Db): SessionService {
  return {
    async getRoles() {
      const uid = await currentUserId(db)
      if (!uid) return []
      must(await db.rpc('account_activity'))
      const rows = must(await db.from('user_roles').select('role').eq('user_id', uid))
      return rows
        .map((r) => r.role)
        .filter((r): r is Role => (ROLES as readonly string[]).includes(r))
    },
    async signOut() {
      const { error } = await db.auth.signOut({ scope: 'local' })
      if (error) throw new Error('sign_out_failed')
    },
    onChange(listener) {
      const { data } = db.auth.onAuthStateChange((event) => {
        if (
          event === 'SIGNED_IN' ||
          event === 'SIGNED_OUT' ||
          event === 'USER_UPDATED' ||
          event === 'MFA_CHALLENGE_VERIFIED'
        ) {
          // Deferred: supabase-js forbids awaiting other auth calls inside this callback.
          setTimeout(listener, 0)
        }
      })
      return () => data.subscription.unsubscribe()
    },
  }
}

const isKey = (k: string): k is EntitlementKey =>
  (ENTITLEMENT_KEYS as readonly string[]).includes(k)
const isSource = (s: string): s is EntitlementSource =>
  (ENTITLEMENT_SOURCES as readonly string[]).includes(s)

/** RLS returns only the caller's rows; only the server can write them (PRD 6.15 A08). */
export function createEntitlementService(db: Db): EntitlementService {
  return {
    async getMine() {
      const uid = await currentUserId(db)
      if (!uid) return []
      const rows = z
        .array(
          z.object({
            key: z.string(),
            source: z.string(),
            status: z.string(),
            starts_at: z.string(),
            ends_at: z.string().nullable(),
          }),
        )
        .parse(must(await db.rpc('my_entitlements')))
      return rows.flatMap((r): Entitlement[] =>
        isKey(r.key) && isSource(r.source)
          ? [
              {
                key: r.key,
                source: r.source,
                status:
                  r.status === 'active' ? 'active' : r.status === 'revoked' ? 'revoked' : 'expired',
                startsAt: r.starts_at,
                endsAt: r.ends_at,
              },
            ]
          : [],
      )
    },
  }
}
