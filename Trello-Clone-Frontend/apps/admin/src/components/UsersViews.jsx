import { useQuery } from '@tanstack/react-query';
import {
  Avatar, Badge, Card, Dropdown, MenuItem, IconButton, Spinner, EmptyState,
  color, space, font, radius,
} from '@trello/ui';
import { MoreHorizontal, AlertTriangle, UserX } from 'lucide-react';
import { api } from '../lib/api';

const ELEVATED = new Set(['super_admin', 'admin']);

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}
const isActive = (u) => u.isActive !== false;
const roleKeyOf = (r) => (typeof r === 'string' ? r : r?.key);

function RolesRow({ roles }) {
  const list = roles ?? [];
  if (list.length === 0) return <span style={{ color: color.mediumGray, fontSize: 13 }}>none</span>;
  return (
    <div style={{ display: 'flex', gap: space.xs, flexWrap: 'wrap' }}>
      {list.map((r, i) => {
        const k = roleKeyOf(r);
        return <Badge key={`${k}-${i}`} kind={ELEVATED.has(k) ? 'primary' : 'default'}>{k}</Badge>;
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- Matrix */

export function UsersMatrix({
  users, loading, isError, search, renderActions,
}) {
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: space.xxl }}><Spinner size={28} /></div>;
  }
  if (isError) {
    return <Card><EmptyState icon={<AlertTriangle size={36} />} title="Something went wrong" description="Failed to load users. The endpoint may not be available yet." /></Card>;
  }
  if (!users.length) {
    return <Card><EmptyState icon={<UserX size={36} />} title="No users found" description={search ? 'Try a different search term.' : 'Users will appear here once they sign up.'} /></Card>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: space.base }}>
      {users.map((u) => (
        <Card key={u.id} hoverable style={{ padding: space.base, display: 'flex', flexDirection: 'column', gap: space.md }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.md }}>
            <Avatar name={u.name} email={u.email} src={u.avatarUrl} size={44} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.email}</div>
              <div style={{ color: color.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
            {renderActions && (
              <Dropdown align="right" width={200} trigger={<IconButton label="Actions"><MoreHorizontal size={18} /></IconButton>}>
                {renderActions(u)}
              </Dropdown>
            )}
          </div>
          <RolesRow roles={u.roles} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Badge kind={isActive(u) ? 'success' : 'error'}>{isActive(u) ? 'Active' : 'Suspended'}</Badge>
            <span style={{ color: color.textMuted, fontSize: 12 }}>Joined {fmtDate(u.createdAt)}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Detail */

function Stat({ label, value }) {
  return (
    <div style={{ background: color.surfaceAlt, borderRadius: radius.large, padding: '10px 12px' }}>
      <div style={{ color: color.textMuted, fontSize: 12 }}>{label}</div>
      <div style={{ color: color.text, fontWeight: 600, fontSize: 14 }}>{value}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, marginBottom: space.sm }}>{title}</div>
      {children}
    </div>
  );
}
function WsList({ items }) {
  if (!items || items.length === 0) return <span style={{ color: color.mediumGray, fontSize: 13 }}>none</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((w) => <div key={w.id} style={{ color: color.text, fontSize: 13 }}>{w.name}</div>)}
    </div>
  );
}

function UserDetailPanel({ userId, renderActions }) {
  const detail = useQuery({
    queryKey: ['admin', 'user', userId],
    enabled: !!userId,
    queryFn: async () => (await api.get(`/admin/users/${userId}`)).data,
  });

  if (!userId) {
    return <EmptyState icon={<UserX size={36} />} title="No user selected" description="Select a user from the list to see their details." />;
  }
  if (detail.isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: space.xxl }}><Spinner size={28} /></div>;
  }
  if (detail.isError || !detail.data) {
    return <EmptyState icon={<AlertTriangle size={36} />} title="Could not load user" description="The user endpoint may not be available yet." />;
  }
  const d = detail.data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg, fontFamily: font.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.base }}>
        <Avatar name={d.name} email={d.email} src={d.avatarUrl} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: color.text }}>{d.name || d.email}</div>
          <div style={{ color: color.textMuted, fontSize: 13 }}>{d.email}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.sm }}>
          <Badge kind={d.isActive ? 'success' : 'error'}>{d.isActive ? 'Active' : 'Suspended'}</Badge>
          {renderActions && (
            <Dropdown align="right" width={200} trigger={<IconButton label="Actions"><MoreHorizontal size={18} /></IconButton>}>
              {renderActions(d)}
            </Dropdown>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.base }}>
        <Stat label="Joined" value={fmtDate(d.createdAt)} />
        <Stat label="Recent activity" value={`${d.activityCount ?? 0} events`} />
      </div>
      <Section title="Roles"><RolesRow roles={d.roles} /></Section>
      <Section title={`Owned workspaces (${d.ownedWorkspaces?.length ?? 0})`}><WsList items={d.ownedWorkspaces} /></Section>
      <Section title={`Member of (${d.memberWorkspaces?.length ?? 0})`}><WsList items={d.memberWorkspaces} /></Section>
    </div>
  );
}

export function UsersDetail({
  users, loading, isError, search, selectedId, onSelect, renderActions,
}) {
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: space.xxl }}><Spinner size={28} /></div>;
  }
  if (isError) {
    return <Card><EmptyState icon={<AlertTriangle size={36} />} title="Something went wrong" description="Failed to load users." /></Card>;
  }
  if (!users.length) {
    return <Card><EmptyState icon={<UserX size={36} />} title="No users found" description={search ? 'Try a different search term.' : 'Users will appear here once they sign up.'} /></Card>;
  }
  return (
    <div className="admin-master-detail" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: space.base, alignItems: 'start' }}>
      <div style={{
        background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
        overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto',
      }}>
        {users.map((u) => {
          const active = u.id === selectedId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none', borderBottom: `1px solid ${color.border}`,
                cursor: 'pointer', background: active ? color.primaryBadgeBg : 'transparent',
                borderLeft: `3px solid ${active ? color.blue : 'transparent'}`,
              }}
            >
              <Avatar name={u.name} email={u.email} src={u.avatarUrl} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: color.text, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.email}</div>
                <div style={{ color: color.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
              </div>
            </button>
          );
        })}
      </div>
      <Card style={{ minHeight: 320 }}>
        <UserDetailPanel userId={selectedId} renderActions={renderActions} />
      </Card>
    </div>
  );
}
