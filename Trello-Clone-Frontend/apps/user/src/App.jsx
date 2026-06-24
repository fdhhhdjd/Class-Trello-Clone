import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useTheme, Spinner, color } from '@trello/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Workspaces } from './pages/Workspaces';
import { WorkspaceBoards } from './pages/WorkspaceBoards';
import { BoardView } from './pages/BoardView';
import { CalendarView } from './pages/CalendarView';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { InviteAccept } from './pages/InviteAccept';
import { PublicProfile } from './pages/PublicProfile';
import { NotFound } from './pages/NotFound';
import { NavBar } from './components/NavBar';
import { GlobalShortcuts } from './components/GlobalShortcuts';

function PageTransition({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="trello-page-enter" style={{ height: '100%' }}>
      {children}
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spinner size={28} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function Shell({ children }) {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <NavBar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}

// Load persisted theme from backend settings on login and apply it.
function ThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const { data } = useQuery({
    queryKey: ['me', 'settings'],
    queryFn: async () => (await api.get('/me/settings')).data ?? {},
    enabled: !!user,
  });
  useEffect(() => {
    const t = data?.theme;
    if (t === 'light' || t === 'dark' || t === 'system') setTheme(t);
  }, [data, setTheme]);
  return null;
}

export function App() {
  const { user } = useAuth();
  return (
    <>
      {user && <ThemeSync />}
      {user && <GlobalShortcuts />}
      <div style={{ minHeight: '100dvh', background: color.surfaceAlt }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<ProtectedRoute><Shell><Workspaces /></Shell></ProtectedRoute>} />
          <Route path="/w/:workspaceId" element={<ProtectedRoute><Shell><WorkspaceBoards /></Shell></ProtectedRoute>} />
          <Route path="/b/:boardId" element={<ProtectedRoute><Shell><BoardView /></Shell></ProtectedRoute>} />
          <Route path="/b/:boardId/calendar" element={<ProtectedRoute><Shell><CalendarView /></Shell></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Shell><Dashboard /></Shell></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Shell><Profile /></Shell></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Shell><Settings /></Shell></ProtectedRoute>} />
          <Route path="/invite/:token" element={<ProtectedRoute><InviteAccept /></ProtectedRoute>} />
          <Route path="/u/:id" element={<ProtectedRoute><Shell><PublicProfile /></Shell></ProtectedRoute>} />
          <Route path="*" element={<ProtectedRoute><Shell><NotFound /></Shell></ProtectedRoute>} />
        </Routes>
      </div>
    </>
  );
}
