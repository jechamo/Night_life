interface PhotoBucket {
  list(
    prefix: string,
    options: { limit: number },
  ): Promise<{
    data: { name: string; id?: string | null }[] | null
    error: unknown
  }>
  remove(paths: string[]): Promise<{ error: unknown }>
}

/** Handle legacy folders, with a hard work limit and no-progress detection. */
export async function eraseProfilePhotos(bucket: PhotoBucket, userId: string): Promise<void> {
  let remaining = 100
  async function clear(prefix: string, depth: number): Promise<void> {
    if (depth > 20) throw new Error('storage_work_limit')
    let previous = ''
    for (;;) {
      if (--remaining < 0) throw new Error('storage_work_limit')
      const result = await bucket.list(prefix, { limit: 100 })
      if (result.error || !result.data) throw new Error('storage_failed')
      if (!result.data.length) return
      const signature = JSON.stringify(result.data.map((item) => [item.name, item.id]))
      if (signature === previous) throw new Error('storage_no_progress')
      previous = signature
      const files: string[] = []
      for (const item of result.data) {
        if (!item.name || item.name.includes('/') || item.name === '.' || item.name === '..')
          throw new Error('storage_invalid_path')
        const path = `${prefix}/${item.name}`
        if (item.id) files.push(path)
        else await clear(path, depth + 1)
      }
      if (files.length) {
        const removed = await bucket.remove(files)
        if (removed.error) throw new Error('storage_failed')
      }
    }
  }
  await clear(userId, 0)
}
