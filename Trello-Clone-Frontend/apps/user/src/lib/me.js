// /me may return either a flat user or { user, roles, permissions }. Normalize.
export function meUser(u) {
  if (!u) return null;
  return u.user ?? u;
}
