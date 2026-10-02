import type { PermissionStatus } from './types'

/** Thin wrapper over the Permissions API; browsers that lack it report `prompt`. */
export async function queryPermission(name: PermissionName): Promise<PermissionStatus> {
  if (!('permissions' in navigator)) return 'prompt'
  try {
    const status = await navigator.permissions.query({ name })
    return status.state
  } catch {
    // Some browsers throw for names they do not know (e.g. camera in Firefox).
    return 'prompt'
  }
}
