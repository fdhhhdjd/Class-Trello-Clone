import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useToast, Button, Input, space } from '@trello/ui';
import { api } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

export function ResetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e = {};
    if (password.length < 8) e.password = 'At least 8 characters.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Password reset. Please log in.');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Reset link is invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you don't use elsewhere."
      footer={<Link to="/login" style={{ color: '#fff', fontWeight: 600 }}>Back to log in</Link>}
    >
      {!token ? (
        <p style={{ color: '#fff', fontSize: 15 }}>This reset link is missing its token. Request a new one.</p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <Input
            label="New password" type="password" placeholder="Enter a new password" autoComplete="new-password"
            value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm password" type="password" placeholder="Re-enter the password" autoComplete="new-password"
            value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" size="lg" loading={busy} fullWidth>Reset password</Button>
        </form>
      )}
    </AuthShell>
  );
}
