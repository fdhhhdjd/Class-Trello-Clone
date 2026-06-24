import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, useTheme, usePermission, useToast, color, space, font, radius, shadow,
} from '@trello/ui';
import {
  Sun, Moon, Monitor, SlidersHorizontal, LayoutGrid, Info,
  Users, KanbanSquare, ShieldCheck, HardDrive, ScrollText, Activity, Megaphone, CloudUpload, LayoutDashboard,
} from 'lucide-react';
import { useUpdateSettings } from '../lib/settings';
import { PageHeader } from '../components/Layout';

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark', label: 'Dark', Icon: Moon },
  { key: 'system', label: 'System', Icon: Monitor },
];

// Management shortcuts. `role`/`perm` gate visibility (undefined = always).
const MANAGE = [
  { to: '/dashboard', label: 'Dashboard', desc: 'Overview & stats', Icon: LayoutDashboard },
  { to: '/monitoring', label: 'Monitoring', desc: 'Service health, uptime', Icon: Activity },
  { to: '/users', label: 'Users', desc: 'Accounts, roles, suspend', Icon: Users },
  { to: '/workspaces', label: 'Workspaces', desc: 'All workspaces & boards', Icon: KanbanSquare },
  { to: '/roles', label: 'Roles & Permissions', desc: 'RBAC matrix', Icon: ShieldCheck, role: 'super_admin' },
  { to: '/storage', label: 'Storage', desc: 'MinIO usage & cleanup', Icon: HardDrive, perm: 'storage.view' },
  { to: '/audit', label: 'Audit Log', desc: 'Security & activity trail', Icon: ScrollText, perm: 'system.view_audit_log' },
  { to: '/system', label: 'System Settings', desc: 'Features, limits, SMTP', Icon: SlidersHorizontal, role: 'super_admin' },
  { to: '/landing', label: 'Landing Page', desc: 'Marketing site CMS', Icon: Megaphone, role: 'super_admin' },
  { to: '/backup', label: 'Backup', desc: 'Scheduled Google Drive backup', Icon: CloudUpload, role: 'super_admin' },
];

const TABS = [
  { id: 'appearance', label: 'Appearance', Icon: SlidersHorizontal },
  { id: 'management', label: 'Management', Icon: LayoutGrid },
  { id: 'about', label: 'About', Icon: Info },
];

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const { can, hasRole } = usePermission();
  const updateSettings = useUpdateSettings();
  const [tab, setTab] = useState('appearance');

  const choose = (t) => {
    if (t === theme) return;
    setTheme(t);
    updateSettings.mutate({ theme: t }, {
      onSuccess: () => toast.success('Theme saved.'),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to save theme.'),
    });
  };

  const visible = MANAGE.filter((m) => (!m.role || hasRole(m.role)) && (!m.perm || can(m.perm)));

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="Settings" subtitle="Customize your console and jump to management tools" breadcrumb={['Admin', 'Settings']} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: space.xs, background: color.surfaceAlt, padding: 6, borderRadius: radius.large, marginBottom: space.lg, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: space.sm, padding: '9px 16px',
              border: 'none', borderRadius: radius.base, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: on ? color.surface : 'transparent', color: on ? color.text : color.textMuted,
              boxShadow: on ? shadow.subtle : 'none',
            }}><t.Icon size={16} />{t.label}</button>
          );
        })}
      </div>

      {tab === 'appearance' && (
        <Card>
          <h2 style={{ fontFamily: font.display, fontSize: 17, fontWeight: 700, color: color.text, margin: `0 0 ${space.xs}` }}>Appearance</h2>
          <p style={{ color: color.textMuted, fontSize: 14, margin: `0 0 ${space.base}` }}>Choose how the console looks. System follows your OS preference.</p>
          <div style={{ display: 'flex', gap: space.base, flexWrap: 'wrap' }}>
            {THEME_OPTIONS.map(({ key, label, Icon }) => {
              const selected = theme === key;
              return (
                <button key={key} type="button" onClick={() => choose(key)} aria-pressed={selected} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.sm,
                  width: 120, padding: space.base, cursor: 'pointer',
                  background: selected ? color.primaryBadgeBg : color.surface,
                  border: `2px solid ${selected ? color.blue : color.border}`,
                  borderRadius: radius.large, color: color.text, fontFamily: font.text, fontSize: 14, fontWeight: 600,
                }}>
                  <Icon size={24} color={selected ? color.blue : color.textMuted} />{label}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {tab === 'management' && (
        <div>
          <p style={{ color: color.textMuted, fontSize: 14, margin: `0 0 ${space.base}` }}>Quick access to every admin area you can manage.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: space.base }}>
            {visible.map((m) => (
              <button key={m.to} onClick={() => navigate(m.to)} style={{
                display: 'flex', alignItems: 'center', gap: space.md, textAlign: 'left', cursor: 'pointer',
                background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large, padding: space.base,
                transition: 'border-color .12s, box-shadow .12s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = color.blue; e.currentTarget.style.boxShadow = shadow.subtle; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = color.border; e.currentTarget.style.boxShadow = 'none'; }}>
                <span style={{ width: 40, height: 40, borderRadius: radius.large, flexShrink: 0, background: color.primaryBadgeBg, color: color.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><m.Icon size={20} /></span>
                <span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: color.text }}>{m.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: color.textMuted }}>{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'about' && (
        <Card style={{ maxWidth: 560 }}>
          <h2 style={{ fontFamily: font.display, fontSize: 17, fontWeight: 700, color: color.text, margin: `0 0 ${space.base}` }}>About</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm, fontSize: 14, color: color.text }}>
            <Row label="Console" value="Trello Clone — Admin" />
            <Row label="Environment" value={window.location.host} />
            <Row label="Build" value="v1.2.0" />
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: space.base, padding: '8px 0', borderBottom: `1px solid ${color.border}` }}>
      <span style={{ color: color.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: font.mono, fontSize: 13 }}>{value}</span>
    </div>
  );
}
