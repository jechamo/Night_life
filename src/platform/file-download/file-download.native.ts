import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { err, ok } from '@/shared/lib/result'
import { isCancellation } from '../native-errors'
import type { FileDownloadService } from './file-download'

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result.split(',')[1] ?? '')
        : reject(new Error('read_failed'))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(blob)
  })
}

/** Keeps generated names inside the cache directory: no separators, no `..`, no dotfiles. */
export const safeName = (filename: string) =>
  filename
    .replace(/[^\w.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'file'

/**
 * GDPR export and signed PDFs: written to the private cache, handed to the system
 * share sheet (save to Files, send…) and deleted right after (NATIVE.md).
 */
export function createNativeFileDownload(): FileDownloadService {
  const downloadBlob: FileDownloadService['downloadBlob'] = async (filename, blob) => {
    const path = `exports/${crypto.randomUUID()}/${safeName(filename)}`
    try {
      const { uri } = await Filesystem.writeFile({
        path,
        data: await toBase64(blob),
        directory: Directory.Cache,
        recursive: true,
      })
      await Share.share({ files: [uri], title: safeName(filename) })
      return ok(undefined)
    } catch (error) {
      return isCancellation(error) ? ok(undefined) : err('failed')
    } finally {
      await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined)
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
