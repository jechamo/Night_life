/** Roles stored in `user_roles` (PRD 3.2) and checked server-side by RLS. */
export const ROLES = ['user', 'tester', 'venue_manager', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const hasRole = (roles: readonly Role[], role: Role): boolean => roles.includes(role)
