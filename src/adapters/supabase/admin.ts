import type { AdminRow, AdminService } from '@/features/admin/services/admin-service'
import { ROLES, type Role } from '@/shared/session/roles'
import { invokeFunction, type Db } from './client'
import { must } from './errors'

const ROLE_ACTION = /^(grant|revoke)_(tester|venue_manager|admin)$/

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

/**
 * Admin over Supabase (ADR 0009): flags, settings, users/roles, audit, dashboard,
 * test data and TOTP MFA are real (role admin + aal2 checked by every RPC). The
 * queues of Blocks 6-9 (moderation, claims, payments…) remain simulated.
 */
export function createAdminService(db: Db, base: AdminService): AdminService {
  return {
    ...base,
    mode: 'live',

    async dashboard() {
      const [simulated, real] = await Promise.all([base.dashboard(), db.rpc('admin_dashboard')])
      const d = (real.data ?? {}) as Record<string, unknown>
      if (real.error) return simulated
      return {
        ...simulated,
        users: asNumber(d.users),
        ageVerifiedPercent: asNumber(d.ageVerifiedPercent),
        matchesToday: asNumber(d.matchesToday),
      }
    },

    async list(section) {
      if (section === 'audit') {
        const rows = must(
          await db
            .from('admin_audit_log')
            .select('id, action, detail, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        )
        return rows.map((r): AdminRow => ({
          id: String(r.id),
          title: r.action,
          subtitle: r.detail,
          status: 'logged',
          createdAt: r.created_at,
          facts: [],
        }))
      }
      if (section === 'users') {
        const rows = must(await db.rpc('admin_list_users', { p_query: '', p_limit: 100 }))
        return rows.map((u): AdminRow => ({
          id: u.id,
          title: u.name,
          subtitle: u.phone_hint,
          status: 'active',
          createdAt: u.created_at,
          facts: u.is_test ? ['is_test', ...u.roles] : u.roles,
        }))
      }
      return base.list(section)
    },

    async act(section, id, action, note) {
      const match = section === 'users' ? ROLE_ACTION.exec(action) : null
      if (!match) return base.act(section, id, action, note)
      const role = match[2] as Role
      if (!(ROLES as readonly string[]).includes(role)) return
      const { error } = await db.rpc('admin_set_role', {
        p_user: id,
        p_role: role,
        p_granted: match[1] === 'grant',
      })
      if (error) throw error
    },

    async setFlag(key, value) {
      const { error } = await db.rpc('admin_set_flag', { p_key: key, p_value: String(value) })
      if (error) throw error
    },

    async settings() {
      const rows = must(
        await db
          .from('app_settings')
          .select('key, value, min_value, max_value')
          .eq('kind', 'setting')
          .order('key'),
      )
      const known = await base.settings()
      return known.map((s) => {
        const row = rows.find((r) => r.key === s.key)
        return row
          ? {
              key: s.key,
              value: Number(row.value),
              min: row.min_value ?? s.min,
              max: row.max_value ?? s.max,
            }
          : s
      })
    },

    async setSetting(key, value) {
      const { error } = await db.rpc('admin_set_setting', { p_key: key, p_value: value })
      if (error) throw error
    },

    async runTestTool(tool) {
      if (tool === 'purge_test_data') {
        const { data, error } = await db.rpc('purge_test_data')
        return error ? 'disabled' : String(data)
      }
      if (tool === 'generate_test_city') {
        const { data, failed } = await invokeFunction<{ created: number }>(db, 'test-tools', {
          action: 'generate_people',
          count: 12,
        })
        return failed || !data ? 'disabled' : String(data.created)
      }
      return base.runTestTool(tool)
    },

    async mfaStatus() {
      const [{ data: factors }, { data: level }] = await Promise.all([
        db.auth.mfa.listFactors(),
        db.auth.mfa.getAuthenticatorAssuranceLevel(),
      ])
      return {
        enrolled: (factors?.totp.length ?? 0) > 0,
        verified: level?.currentLevel === 'aal2',
      }
    },

    async enrollMfa() {
      const { data: existing } = await db.auth.mfa.listFactors()
      // An abandoned enrolment leaves an unverified factor; clear it before retrying.
      for (const factor of existing?.all ?? []) {
        if (factor.status === 'unverified') await db.auth.mfa.unenroll({ factorId: factor.id })
      }
      const { data, error } = await db.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Nightlife admin',
      })
      if (error) throw error
      return { qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
    },

    async verifyMfa(code) {
      const { data: factors } = await db.auth.mfa.listFactors()
      const factor = factors?.all.find((f) => f.factor_type === 'totp')
      if (!factor) return false
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
      return !error
    },
  }
}
