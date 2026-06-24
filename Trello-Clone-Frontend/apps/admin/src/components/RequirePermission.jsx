import { Navigate } from 'react-router-dom';
import { usePermission, useAuth, Spinner, Button, color, space, font, radius } from '@trello/ui';
import { ShieldAlert } from 'lucide-react';

// Route guard — hides UI and redirects. Backend re-checks every mutation (RBAC.md).
export function RequirePermission({
  permission, role, redirect = '/dashboard', children,
}) {
  const { can, hasRole } = usePermission();
  const { loading, user } = useAuth();

  // Wait for auth to resolve before deciding (avoids redirect on deep-link/refresh).
  if (loading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Spinner />
      </div>
    );
  }

  const permOk = !permission
    || (Array.isArray(permission) ? permission.some(can) : can(permission));
  const roleOk = !role
    || (Array.isArray(role) ? role.some(hasRole) : hasRole(role));

  if (!permOk || !roleOk) return <Navigate to={redirect} replace />;
  return <>{children}</>;
}

// Inline gate — renders fallback (or nothing) instead of redirecting.
export function Can({
  permission, fallback = null, children,
}) {
  const { can } = usePermission();
  const ok = Array.isArray(permission) ? permission.some(can) : can(permission);
  return <>{ok ? children : fallback}</>;
}

export function NotAuthorized({ onLogout }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: font.text, background: color.surfaceAlt, padding: space.lg, boxSizing: 'border-box',
    }}>
      <div style={{
        background: color.surface, borderRadius: radius.large, padding: space.xl, maxWidth: 420,
        textAlign: 'center', boxShadow: 'rgba(9,30,66,0.13) 0px 1px 1px 0px',
        border: `1px solid ${color.border}`,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: `0 auto ${space.base}`,
          background: color.errorBg, color: color.danger, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
        }}><ShieldAlert size={28} /></div>
        <h1 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: color.text, margin: `0 0 ${space.sm}` }}>
          Access denied
        </h1>
        <p style={{ color: color.textMuted, margin: `0 0 ${space.lg}`, fontSize: 14 }}>
          This account has no administrator role. Contact a system administrator if you believe this is a mistake.
        </p>
        <Button variant="secondary" onClick={onLogout}>Sign out</Button>
      </div>
    </div>
  );
}
