import { useState, useRef } from 'react';
import axios from 'axios';
import {
  useAuth, Card, Button, Input, Avatar, Badge, useToast,
  color, space, font, radius,
} from '@trello/ui';
import { UploadCloud, ShieldCheck, KeyRound, Mail, User as UserIcon } from 'lucide-react';
import { api, meProfile } from '../lib/api';
import { PageHeader } from '../components/Layout';

function SectionTitle({ children, Icon }) {
  return (
    <h2 style={{ display: 'flex', alignItems: 'center', gap: space.sm, fontFamily: font.display, fontSize: 17, fontWeight: 700, color: color.text, margin: `0 0 ${space.base}` }}>
      {Icon ? <Icon size={18} color={color.blue} /> : null}{children}
    </h2>
  );
}

export function ProfilePage() {
  const { user: rawUser, refresh } = useAuth();
  const user = meProfile(rawUser);
  const toast = useToast();
  const fileRef = useRef(null);

  const [name, setName] = useState(user?.name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwErrors, setPwErrors] = useState({});
  const [changingPw, setChangingPw] = useState(false);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  const saveProfile = async () => {
    if (!name.trim()) { toast.error('Name is required.'); return; }
    setSavingProfile(true);
    try {
      await api.patch('/me', { name: name.trim() });
      await refresh();
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    setUploading(true);
    try {
      const { data } = await api.post('/me/avatar', { filename: file.name, contentType: file.type });
      await axios.put(data.uploadUrl, file, { headers: { 'Content-Type': file.type } });
      await api.patch('/me', { avatarUrl: data.fileUrl });
      await refresh();
      toast.success('Avatar updated.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Avatar upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async () => {
    const e = {};
    if (!currentPassword) e.currentPassword = 'Required.';
    if (!newPassword) e.newPassword = 'Required.';
    else if (newPassword.length < 8) e.newPassword = 'Min 8 characters.';
    if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setPwErrors(e);
    if (Object.keys(e).length) return;

    setChangingPw(true);
    try {
      await api.post('/me/change-password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password changed.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to change password.');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="Profile" subtitle="Manage your account details" breadcrumb={['Admin', 'Profile']} />

      {/* Identity banner */}
      <Card style={{ marginBottom: space.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.lg, flexWrap: 'wrap' }}>
          <Avatar name={user?.name} email={user?.email} src={user?.avatarUrl} size={84} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 800, color: color.text }}>{user?.name || 'Admin'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: color.textMuted, fontSize: 14, marginTop: 2 }}><Mail size={14} /> {user?.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: space.sm }}>
              {roles.length ? roles.map((r) => <Badge key={r} kind="primary">{r}</Badge>) : <Badge>no role</Badge>}
            </div>
          </div>
          <div>
            <Button variant="secondary" loading={uploading} leftIcon={<UploadCloud size={16} />} onClick={() => fileRef.current?.click()}>Upload avatar</Button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: space.lg, alignItems: 'start' }}>
        <Card>
          <SectionTitle Icon={UserIcon}>Details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Input label="Email" value={user?.email ?? ''} disabled helper="Email cannot be changed." />
            <div><Button loading={savingProfile} onClick={saveProfile}>Save changes</Button></div>
          </div>
        </Card>

        <Card>
          <SectionTitle Icon={KeyRound}>Change password</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
            <Input label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={pwErrors.currentPassword} />
            <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={pwErrors.newPassword} helper="At least 8 characters." />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={pwErrors.confirmPassword} />
            <div><Button loading={changingPw} onClick={changePassword}>Update password</Button></div>
          </div>
        </Card>

        <Card>
          <SectionTitle Icon={ShieldCheck}>Roles &amp; access</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
            <div>
              <div style={{ fontSize: 12, color: color.textMuted, marginBottom: 6 }}>System roles</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {roles.length ? roles.map((r) => <Badge key={r} kind="primary">{r}</Badge>) : <span style={{ fontSize: 13, color: color.textMuted }}>None</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: space.lg }}>
              <div>
                <div style={{ fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.text }}>{permissions.length}</div>
                <div style={{ fontSize: 12, color: color.textMuted }}>Permissions granted</div>
              </div>
            </div>
            {permissions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 120, overflow: 'auto' }}>
                {permissions.slice(0, 40).map((p) => (
                  <span key={p} style={{ fontSize: 11, fontFamily: font.mono, color: color.textMuted, background: color.surfaceAlt, borderRadius: radius.base, padding: '2px 6px' }}>{p}</span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
