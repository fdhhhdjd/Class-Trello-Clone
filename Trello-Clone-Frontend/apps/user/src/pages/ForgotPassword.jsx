import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast, Button, Input, space } from '@trello/ui';
import { api } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

export function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      toast.error('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new password."
      footer={<Link to="/login" style={{ color: '#fff', fontWeight: 600 }}>Back to log in</Link>}
    >
      {sent ? (
        <p style={{ color: '#fff', fontSize: 15, lineHeight: 1.5 }}>
          If an account exists for <b>{email}</b>, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <Input
            label="Email" type="email" placeholder="you@example.com" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" size="lg" loading={busy} fullWidth>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
