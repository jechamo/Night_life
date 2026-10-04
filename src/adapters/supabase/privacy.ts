import type { ModerationService } from '@/features/moderation/services/moderation-service'
import type { PrivacyService } from '@/features/privacy/services/privacy-service'
import { err, ok } from '@/shared/lib/result'
import { currentUserId, invokeFunction, type Db } from './client'
import { must } from './errors'

/**
 * GDPR rights (PRD 6.12 G). Export reads every table the user owns through RLS.
 * Deletion needs a fresh OTP (re-authentication, PRD 6.15 A07) and then runs on the
 * server (`delete-account`), which cancels subscriptions and erases the account.
 */
export function createPrivacyService(db: Db): PrivacyService {
  const phone = async () => (await db.auth.getUser()).data.user?.phone ?? null
  return {
    async exportMyData() {
      const uid = await currentUserId(db)
      if (!uid) throw new Error('unauthorized')
      const data = must(await db.rpc('export_my_data'))
      const { data: auth, error } = await db.auth.getUser()
      if (error || !auth.user) throw new Error('export_failed')
      return {
        ...(data as Record<string, unknown>),
        account: { id: uid, phone: auth.user.phone ?? null, email: auth.user.email ?? null },
      }
    },
    async requestRight(kind) {
      must(await db.rpc('request_data_right', { p_kind: kind }))
    },
    async requests() {
      const uid = await currentUserId(db)
      if (!uid) return []
      const rows = must(
        await db
          .from('data_requests')
          .select('id, kind, created_at, due_at, status')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
      )
      return rows.map((r) => ({
        id: r.id,
        kind:
          r.kind === 'delete' ||
          r.kind === 'rectify' ||
          r.kind === 'object' ||
          r.kind === 'restrict'
            ? r.kind
            : 'export',
        createdAt: r.created_at,
        dueAt: r.due_at,
        status: r.status === 'open' ? 'open' : 'done',
      }))
    },
    async requestDeletionCode() {
      const target = await phone()
      if (!target) throw new Error('unauthorized')
      const { error } = await db.auth.signInWithOtp({
        phone: target,
        options: { shouldCreateUser: false },
      })
      if (error) throw new Error('otp_failed')
    },
    async deleteAccount(otp) {
      const target = await phone()
      if (!target) return err('wrong_code')
      const verified = await db.auth.verifyOtp({ phone: target, token: otp, type: 'sms' })
      if (verified.error) return err('wrong_code')
      const { failed } = await invokeFunction(db, 'delete-account', {})
      if (failed) return err('wrong_code')
      await db.auth.signOut({ scope: 'local' })
      return ok(undefined)
    },
    async logoutEverywhere() {
      await db.auth.signOut({ scope: 'global' })
    },
  }
}

/** Legacy account-status wrapper; Block 9 uses the complete real moderation adapter. */
export function withRealAccountStatus(db: Db, base: ModerationService): ModerationService {
  return {
    ...base,
    async accountStatus() {
      const uid = await currentUserId(db)
      if (!uid) return 'active'
      const { data } = await db
        .from('profiles')
        .select('suspended, banned')
        .eq('id', uid)
        .maybeSingle()
      return data && (data.suspended || data.banned) ? 'suspended' : 'active'
    },
  }
}
