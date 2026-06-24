import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth, useToast, Button, Input, space } from '@trello/ui';
import { api } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

export function Register() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await api.post('/auth/register', { email, password, name });
      await login(email, password);
      toast.success('Account created. Welcome!');
      navigate('/', { replace: true });
    } catch {
      toast.error('Could not create account. Email may be taken.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Organize anything, with anyone, anywhere."
      footer={<>Already have an account? <Link to="/login" style={{ color: '#fff', fontWeight: 600 }}>Log in</Link></>}
    >
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        <Input label="Name" placeholder="Jane Doe" autoComplete="name"
          value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" placeholder="you@example.com" autoComplete="email"
          value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" placeholder="At least 8 characters" autoComplete="new-password"
          value={password} error={errors.password} helper={!errors.password ? 'Minimum 8 characters.' : undefined}
          onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" size="lg" loading={busy} fullWidth>Sign up</Button>
      </form>
    </AuthShell>
  );
}
