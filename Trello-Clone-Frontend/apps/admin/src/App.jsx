import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth, usePermission, Spinner, color } from '@trello/ui';
import { SYSTEM_ROLES, api } from './lib/api';
import { useThemeSync } from './lib/settings';
import { Layout } from './components/Layout';
import { RequirePermission, NotAuthorized } from './components/RequirePermission';
import { LoginPage } from './pages/Login';
import { SetupPage } from './pages/Setup';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { WorkspacesPage } from './pages/Workspaces';
import { WorkspaceDetailPage } from './pages/WorkspaceDetail';
import { RolesPage } from './pages/Roles';
import { MonitoringPage } from './pages/Monitoring';
import { SystemSettingsPage } from './pages/SystemSettings';
import { LandingPage } from './pages/Landing';
import { BackupPage } from './pages/Backup';
import { StoragePage } from './pages/Storage';
import { AuditPage } from './pages/Audit';
import { ProfilePage } from './pages/Profile';
import { SettingsPage } from './pages/Settings';
import { NotFoundPage } from './pages/NotFound';

export function App() {
  const { user, loading, logout } = useAuth();
  const { hasRole } = usePermission();

  useThemeSync(!!user);

  // First-run check: only when not logged in.
  const setupQ = useQuery({
    queryKey: ['setup-status'],
    queryFn: async () => (await api.get('/auth/setup-status')).data,
    enabled: !loading && !user,
    staleTime: 60_000,
  });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.surfaceAlt }}>
        <Spinner size={32} />
      </div>
    );
  }
  if (!user) {
    if (setupQ.isLoading) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.surfaceAlt }}>
          <Spinner size={32} />
        </div>
      );
    }
    if (setupQ.data?.needsSetup) return <SetupPage />;
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Gate: a system role is required for the admin console.
  const isAdmin = SYSTEM_ROLES.some(hasRole);
  if (!isAdmin) return <NotAuthorized onLogout={logout} />;

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route
          path="/workspaces"
          element={
            <RequirePermission role={['super_admin', 'admin']}>
              <WorkspacesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/workspaces/:id"
          element={
            <RequirePermission role={['super_admin', 'admin']}>
              <WorkspaceDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/roles"
          element={
            <RequirePermission role="super_admin">
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route
          path="/system"
          element={
            <RequirePermission role="super_admin">
              <SystemSettingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/landing"
          element={
            <RequirePermission role="super_admin">
              <LandingPage />
            </RequirePermission>
          }
        />
        <Route
          path="/storage"
          element={
            <RequirePermission permission="storage.view" role={['super_admin', 'admin']}>
              <StoragePage />
            </RequirePermission>
          }
        />
        <Route
          path="/audit"
          element={
            <RequirePermission permission="system.view_audit_log" role={['super_admin', 'admin', 'support']}>
              <AuditPage />
            </RequirePermission>
          }
        />
        <Route
          path="/backup"
          element={
            <RequirePermission role="super_admin">
              <BackupPage />
            </RequirePermission>
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
