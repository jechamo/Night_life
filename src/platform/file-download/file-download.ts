import type { Result } from '@/shared/lib/result'

/** Port for saving files: GDPR JSON export and signed PDFs (PRD 6.1, 6.12 G). */
export interface FileDownloadService {
  downloadJson(filename: string, data: unknown): Promise<Result<void, 'failed'>>
  downloadBlob(filename: string, blob: Blob): Promise<Result<void, 'failed'>>
}
