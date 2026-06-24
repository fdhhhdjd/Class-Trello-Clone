import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Button, Input, useToast, setAccessToken, color, space, font, radius } from '@trello/ui';
import { api } from '../lib/api';

// One-time first-run page: create the very first super_admin. Shown only while
// no super_admin exists (GET /auth/setup-status -> needsSetup).
export function SetupPage() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Valid email required';
    if (password.length < 8) e.password = 'Min 8 characters';
    if (confirm !== password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const setup = useMutation({
    mutationFn: () => api.post('/auth/setup', { name: name.trim(), email: email.trim(), password }),
    onSuccess: (res) => {
      setAccessToken(res.data.accessToken);
      toast.success('Super admin created.');
      window.location.href = '/dashboard';
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Setup failed.'),
  });

  const onSubmit = (e) => { e.preventDefault(); if (validate()) setup.mutate(); };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(1200px 600px at 50% -10%, #14346b 0%, #091E42 60%)',
      fontFamily: font.text, padding: space.lg, boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: space.lg, gap: space.sm }}>
          <span style={{
            width: 52, height: 52, borderRadius: radius.large, background: color.blue,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 8px 24px rgba(24,104,219,0.4)',
          }}><ShieldCheck size={28} /></span>
          <span style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: '#fff' }}>Welcome to Trello Admin</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' }}>
            Create the first super administrator account. This page is shown only once.
          </span>
        </div>
        <div style={{ background: color.surface, borderRadius: radius.large, padding: space.xl, boxShadow: 'rgba(9,30,66,0.31) 0px 12px 32px 0px' }}>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }} noValidate>
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus placeholder="Your name" />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="admin@yourcompany.com" autoComplete="username" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} helper="At least 8 characters" autoComplete="new-password" />
            <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} autoComplete="new-password" />
            <Button type="submit" fullWidth loading={setup.isPending} disabled={setup.isPending} style={{ marginTop: space.xs }}>
              Create super admin
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
