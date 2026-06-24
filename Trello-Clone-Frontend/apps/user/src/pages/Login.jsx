import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth, useToast, Button, Input, space } from '@trello/ui';
import { AuthShell } from '../components/AuthShell';

export function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const validate = () => {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (!password) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await login(email, password);
      const to = location.state?.from?.pathname ?? '/';
      navigate(to, { replace: true });
    } catch {
      toast.error('Invalid email or password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Log in to continue"
      subtitle="Welcome back. Pick up where you left off."
      footer={<>No account? <Link to="/register" style={{ color: '#fff', fontWeight: 600 }}>Sign up</Link></>}
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        <Input
          label="Email" type="email" placeholder="you@example.com" autoComplete="email"
          value={email} error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password" type="password" placeholder="Enter your password" autoComplete="current-password"
          value={password} error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="lg" loading={busy} fullWidth>Log in</Button>
        <Link to="/forgot-password" style={{ color: '#fff', fontSize: 13, textAlign: 'center', opacity: 0.9 }}>
          Forgot password?
        </Link>
      </form>
    </AuthShell>
  );
}
