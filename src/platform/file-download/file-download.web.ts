import { err, ok } from '@/shared/lib/result'
import type { FileDownloadService } from './file-download'

export function createWebFileDownload(): FileDownloadService {
  const downloadBlob: FileDownloadService['downloadBlob'] = (filename, blob) => {
    try {
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      anchor.rel = 'noopener'
      anchor.click()
      // Revoke on the next tick so the download has started.
      setTimeout(() => URL.revokeObjectURL(href), 0)
      return Promise.resolve(ok(undefined))
    } catch {
      return Promise.resolve(err('failed'))
    }
  }
  return {
    downloadBlob,
    downloadJson: (filename, data) =>
      downloadBlob(
        filename,
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      ),
  }
}
