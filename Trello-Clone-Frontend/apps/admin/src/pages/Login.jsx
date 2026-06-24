import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, Button, Input, useToast, color, space, font, radius } from '@trello/ui';
import { Shield } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (!password) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Login failed. Check your credentials.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(1200px 600px at 50% -10%, #14346b 0%, #091E42 60%)',
      fontFamily: font.text, padding: space.lg, boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: space.lg, gap: space.sm }}>
          <span style={{
            width: 48, height: 48, borderRadius: radius.large,
            background: color.blue, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 8px 24px rgba(24,104,219,0.4)',
          }}>
            <Shield size={26} />
          </span>
          <span style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>
            Trello Admin
          </span>
        </div>

        <div style={{
          background: color.surface, borderRadius: radius.large, padding: space.xl,
          boxShadow: 'rgba(9, 30, 66, 0.31) 0px 12px 32px 0px',
        }}>
          <h1 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: color.text, marginTop: 0, marginBottom: 4 }}>
            Sign in
          </h1>
          <p style={{ color: color.textMuted, fontSize: 14, marginTop: 0, marginBottom: space.lg }}>
            Restricted to system administrators.
          </p>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }} noValidate>
            <Input
              label="Email" type="email" placeholder="you@company.com" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoFocus
            />
            <Input
              label="Password" type="password" placeholder="••••••••" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password}
            />
            <Button type="submit" fullWidth loading={busy} disabled={busy} style={{ marginTop: space.xs }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: space.lg }}>
          Protected area. All actions are audited.
        </p>
      </div>
    </div>
  );
}
