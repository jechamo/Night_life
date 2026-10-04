import { eraseProfilePhotos } from './photo-erasure.ts'

const assert = (ok: boolean) => {
  if (!ok) throw new Error('assertion_failed')
}
Deno.test('erases nested legacy photos and flat photos without removing folder names', async () => {
  const paths = new Set(['uid/flat.png', 'uid/legacy/sub/photo.png'])
  const removed: string[] = []
  await eraseProfilePhotos(
    {
      list(prefix) {
        const entries = new Map<string, { name: string; id: string | null }>()
        for (const path of paths) {
          if (!path.startsWith(`${prefix}/`)) continue
          const part = path.slice(prefix.length + 1)
          const name = part.split('/')[0]
          entries.set(name, { name, id: part.includes('/') ? null : path })
        }
        return Promise.resolve({ data: [...entries.values()], error: null })
      },
      remove(names) {
        names.forEach((name) => {
          assert(paths.delete(name))
          removed.push(name)
        })
        return Promise.resolve({ error: null })
      },
    },
    'uid',
  )
  assert(paths.size === 0 && removed.length === 2)
})
Deno.test('stops when Storage claims deletion but never makes progress', async () => {
  let calls = 0
  try {
    await eraseProfilePhotos(
      {
        list() {
          calls++
          return Promise.resolve({ data: [{ name: 'photo.png', id: 'id' }], error: null })
        },
        remove() {
          return Promise.resolve({ error: null })
        },
      },
      'uid',
    )
    throw new Error('expected_failure')
  } catch (error) {
    assert(error instanceof Error && error.message === 'storage_no_progress')
  }
  assert(calls === 2)
})
Deno.test('bounds legacy traversal and rejects path escape', async () => {
  for (const name of ['..', '../escape', '']) {
    try {
      await eraseProfilePhotos(
        {
          list: () => Promise.resolve({ data: [{ name, id: null }], error: null }),
          remove: () => Promise.resolve({ error: null }),
        },
        'uid',
      )
      throw new Error('expected_failure')
    } catch (error) {
      assert(error instanceof Error && error.message === 'storage_invalid_path')
    }
  }
  let calls = 0
  try {
    await eraseProfilePhotos(
      {
        list: () => {
          calls++
          return Promise.resolve({ data: [{ name: 'folder', id: null }], error: null })
        },
        remove: () => Promise.resolve({ error: null }),
      },
      'uid',
    )
    throw new Error('expected_failure')
  } catch (error) {
    assert(error instanceof Error && error.message === 'storage_work_limit')
  }
  assert(calls <= 21)
})
