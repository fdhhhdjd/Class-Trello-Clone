import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Skeleton, Avatar, Badge, color, space, font, radius } from '@trello/ui';
import {
  Users, UserCheck, UserX, KanbanSquare, LayoutDashboard, Database, ArrowUpRight,
  Layers, MessageSquare, Paperclip, TrendingUp, Crown,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';

function fmtNum(v) {
  if (v === undefined || v === null) return '—';
  return typeof v === 'number' ? v.toLocaleString() : v;
}

function fmtBytes(bytes) {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / 1024 ** i;
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const TINTS = {
  blue: { bg: 'rgba(24,104,219,0.12)', fg: color.blue },
  green: { bg: color.successBg, fg: color.success },
  red: { bg: color.errorBg, fg: color.danger },
  purple: { bg: 'rgba(168,85,247,0.14)', fg: color.purple },
  cyan: { bg: 'rgba(6,182,212,0.14)', fg: color.cyan },
  gray: { bg: color.surfaceAlt, fg: color.textMuted },
};

function StatCard({ label, value, Icon, tint = 'blue', loading, onClick, delta }) {
  const t = TINTS[tint] ?? TINTS.blue;
  return (
    <Card hoverable onClick={onClick} style={{ padding: space.lg, cursor: onClick ? 'pointer' : 'default', position: 'relative' }}>
      {onClick && <span style={{ position: 'absolute', top: space.md, right: space.md, color: color.mediumGray }}><ArrowUpRight size={16} /></span>}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.base }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: color.textMuted, fontSize: 13, fontWeight: 500 }}>{label}</div>
          <div style={{ fontFamily: font.display, fontSize: 30, fontWeight: 700, color: color.text, marginTop: space.sm, lineHeight: 1.1 }}>
            {loading ? <Skeleton width={72} height={30} /> : value}
          </div>
          {delta != null && !loading && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 12, fontWeight: 600, color: color.success }}>
              <TrendingUp size={13} /> +{fmtNum(delta)} (7d)
            </div>
          )}
        </div>
        <span style={{ width: 42, height: 42, borderRadius: radius.large, flexShrink: 0, background: t.bg, color: t.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={22} /></span>
      </div>
    </Card>
  );
}

function SegmentBar({ segments }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', background: color.surfaceAlt }}>
        {segments.map((s) => <div key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color, transition: 'width .3s' }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.base, marginTop: space.md }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: color.textMuted }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: color.text, fontWeight: 600 }}>{fmtNum(s.value)}</span><span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: space.sm, height: 150, paddingTop: space.sm }}>
      {items.map((it, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: color.text }}>{fmtNum(it.value)}</span>
          <div style={{ width: '100%', maxWidth: 48, height: `${Math.max(4, (it.value / max) * 100)}%`, background: it.color ?? color.blue, borderRadius: `${radius.base} ${radius.base} 0 0`, transition: 'height .3s', minHeight: 4 }} />
          <span style={{ fontSize: 11, color: color.textMuted, textAlign: 'center' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children, action }) {
  return (
    <Card style={{ padding: space.lg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.base }}>
        <h2 style={{ fontFamily: font.display, fontSize: 15, fontWeight: 700, color: color.text, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

const ROLE_COLORS = { super_admin: color.danger, admin: color.purple, support: color.cyan, user: color.blue };

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get('/admin/stats')).data,
    refetchInterval: 30000,
  });

  const cards = [
    { label: 'Total users', value: fmtNum(data?.users?.total), delta: data?.users?.new7d, Icon: Users, tint: 'blue', to: '/users' },
    { label: 'Active users', value: fmtNum(data?.users?.active), Icon: UserCheck, tint: 'green', to: '/users' },
    { label: 'Suspended', value: fmtNum(data?.users?.suspended), Icon: UserX, tint: 'red', to: '/users' },
    { label: 'Workspaces', value: fmtNum(data?.workspaces?.total), Icon: KanbanSquare, tint: 'purple', to: '/workspaces' },
    { label: 'Boards', value: fmtNum(data?.boards?.total), delta: data?.boards?.new7d, Icon: LayoutDashboard, tint: 'cyan', to: '/workspaces' },
    { label: 'Cards', value: fmtNum(data?.cards?.total), delta: data?.cards?.new7d, Icon: Layers, tint: 'blue' },
    { label: 'Comments', value: fmtNum(data?.comments?.total), Icon: MessageSquare, tint: 'green' },
    { label: 'Attachments', value: fmtNum(data?.attachments?.total), Icon: Paperclip, tint: 'purple' },
    { label: 'Storage used', value: fmtBytes(data?.storage?.bytes), Icon: Database, tint: 'gray', to: '/storage' },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="Dashboard" subtitle="System overview at a glance" breadcrumb={['Admin', 'Dashboard']} />

      {isError && (
        <div style={{ background: color.errorBg, border: `1px solid ${color.danger}`, color: color.danger, borderRadius: radius.base, padding: '10px 14px', fontSize: 14, marginBottom: space.base }}>
          Stats endpoint unavailable — showing placeholders.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: space.base, marginBottom: space.lg }}>
        {cards.map((c) => <StatCard key={c.label} {...c} loading={isLoading} onClick={c.to ? () => navigate(c.to) : undefined} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: space.base, marginBottom: space.lg }}>
        <ChartCard title="New sign-ups (last 7 days)">
          {isLoading ? <Skeleton height={150} /> : <MiniBars items={(data?.signupTrend ?? []).map((d) => ({ ...d, color: color.blue }))} />}
        </ChartCard>

        <ChartCard title="Users: active vs suspended">
          {isLoading ? <Skeleton height={64} /> : (
            <SegmentBar segments={[
              { label: 'Active', value: data?.users?.active ?? 0, color: color.success },
              { label: 'Suspended', value: data?.users?.suspended ?? 0, color: color.danger },
            ]} />
          )}
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: space.base }}>
        <ChartCard title="Role distribution">
          {isLoading ? <Skeleton height={64} /> : (
            <SegmentBar segments={(data?.roleDistribution ?? []).map((r) => ({ label: r.role, value: r.count, color: ROLE_COLORS[r.role] ?? color.mediumGray }))} />
          )}
        </ChartCard>

        <ChartCard title="Top workspaces by boards">
          {isLoading ? <Skeleton height={120} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
              {(data?.topWorkspaces ?? []).map((w, i) => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: space.sm, fontSize: 14 }}>
                  <span style={{ width: 20, color: color.textMuted, fontWeight: 700 }}>{i + 1}</span>
                  {i === 0 && <Crown size={14} color={color.purple} />}
                  <span style={{ flex: 1, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                  <Badge>{w.boards} boards</Badge>
                </div>
              ))}
              {(!data?.topWorkspaces || data.topWorkspaces.length === 0) && <span style={{ fontSize: 13, color: color.textMuted }}>No data.</span>}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Recent sign-ups" action={<button onClick={() => navigate('/users')} style={{ border: 'none', background: 'none', color: color.blue, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>View all</button>}>
          {isLoading ? <Skeleton height={120} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
              {(data?.recentSignups ?? []).map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                  <Avatar name={u.name} email={u.email} src={u.avatarUrl} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.email}</div>
                    <div style={{ fontSize: 11, color: color.textMuted }}>{new Date(u.createdAt).toLocaleDateString()}</div>
                  </div>
                  {!u.isActive && <Badge kind="error">suspended</Badge>}
                </div>
              ))}
              {(!data?.recentSignups || data.recentSignups.length === 0) && <span style={{ fontSize: 13, color: color.textMuted }}>No data.</span>}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
