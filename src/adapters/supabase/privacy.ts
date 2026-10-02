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
      if (!uid) return {}
      // Explicit queries per table keep the export typed and reviewable.
      const [
        profile,
        verification,
        preferences,
        roles,
        consents,
        entitlements,
        subscriptions,
        invoices,
        contacts,
        requests,
      ] = await Promise.all([
        db.from('profiles').select('*').eq('id', uid),
        db.from('verification_status').select('*').eq('user_id', uid),
        db.from('user_preferences').select('*').eq('user_id', uid),
        db.from('user_roles').select('*').eq('user_id', uid),
        db.from('consent_records').select('*').eq('user_id', uid),
        db.from('entitlements').select('*').eq('user_id', uid),
        db.from('subscriptions').select('*').eq('user_id', uid),
        db.from('invoices').select('*').eq('user_id', uid),
        db.from('emergency_contacts').select('*').eq('user_id', uid),
        db.from('data_requests').select('*').eq('user_id', uid),
      ])
      const entries = Object.entries({
        profiles: profile.data,
        verification_status: verification.data,
        user_preferences: preferences.data,
        user_roles: roles.data,
        consent_records: consents.data,
        entitlements: entitlements.data,
        subscriptions: subscriptions.data,
        invoices: invoices.data,
        emergency_contacts: contacts.data,
        data_requests: requests.data,
      }).map(([table, rows]) => [table, rows ?? []] as const)
      const { data: user } = await db.auth.getUser()
      return {
        exportedAt: new Date().toISOString(),
        account: { id: uid, phone: user.user?.phone ?? null, email: user.user?.email ?? null },
        ...Object.fromEntries(entries),
      }
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
          r.kind === 'delete' || r.kind === 'rectify' || r.kind === 'object' ? r.kind : 'export',
        createdAt: r.created_at,
        dueAt: r.due_at,
        status: r.status === 'open' ? 'open' : 'done',
      }))
    },
    async requestDeletionCode() {
      const target = await phone()
      if (target)
        await db.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: false } })
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

/** Account status is real; reports, decisions and appeals stay simulated until Block 9. */
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
