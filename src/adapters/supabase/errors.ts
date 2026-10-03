/** Status/code of a supabase-js error without depending on its classes. */
export function errorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status)
    : undefined
}

export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message
    return typeof message === 'string' ? message : ''
  }
  return ''
}

export function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

/** Throws query errors so TanStack Query handles them (screens show generic messages). */
export function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error instanceof Error ? result.error : new Error('db_error')
  if (result.data === null || result.data === undefined) throw new Error('no_data')
  return result.data
}
