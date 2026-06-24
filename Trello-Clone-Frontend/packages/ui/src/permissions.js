import { useAuth } from './auth';

// FE permission gate — UX only. Backend re-checks every mutation (RBAC.md).
export function usePermission() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perms = user?.permissions ?? [];
  const isSuper = roles.includes('super_admin');

  const can = (permission) => isSuper || perms.includes(permission);
  return {
    can,
    canAny: (...p) => p.some(can),
    canAll: (...p) => p.every(can),
    hasRole: (role) => roles.includes(role),
  };
}
