import type { Result } from '@/shared/lib/result'

export interface DataRequestRow {
  id: string
  kind: 'export' | 'delete' | 'rectify' | 'object'
  createdAt: string
  /** Legal deadline: one month (PRD 6.12 G). */
  dueAt: string
  status: 'open' | 'done'
}

/** Port for GDPR rights (PRD 6.12 G). Deletion needs OTP re-authentication (PRD 6.15 A07). */
export interface PrivacyService {
  exportMyData(): Promise<Record<string, unknown>>
  requests(): Promise<DataRequestRow[]>
  requestDeletionCode(): Promise<void>
  deleteAccount(otp: string): Promise<Result<void, 'wrong_code'>>
  logoutEverywhere(): Promise<void>
}
