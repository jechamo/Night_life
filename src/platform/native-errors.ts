/**
 * Capacitor plugins reject with an Error whose `message`/`code` vary by platform and
 * plugin version. Ports expose closed error unions, so classify by keywords only
 * (never forward the raw message: it may contain device details).
 */
export function nativeErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const { message, code } = error as { message?: unknown; code?: unknown }
  return `${typeof code === 'string' ? code : ''} ${typeof message === 'string' ? message : ''}`.toLowerCase()
}

export const isCancellation = (error: unknown) => /cancel/.test(nativeErrorText(error))

export const isPermissionDenial = (error: unknown) =>
  /denied|permission|not authori[sz]ed/.test(nativeErrorText(error))
