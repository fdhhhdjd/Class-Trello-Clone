import { createApi } from '@trello/ui';

export const api = createApi('/api');

export const SYSTEM_ROLES = ['super_admin', 'admin', 'support'];

// /me returns { user, roles, permissions } (nested) or a flat user. Normalize to
// a flat object so name/email/avatarUrl resolve while roles/permissions persist.
export function meProfile(u) {
  if (!u) return null;
  const base = u.user ?? u;
  return {
    ...base,
    roles: u.roles ?? base.roles ?? [],
    permissions: u.permissions ?? base.permissions ?? [],
  };
}
