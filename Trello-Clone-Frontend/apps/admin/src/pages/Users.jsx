import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, Badge, Modal, Select, Avatar, Dropdown, MenuItem, IconButton,
  usePermission, useToast, useConfirm, setAccessToken, color, space, font,
} from '@trello/ui';
import {
  MoreHorizontal, ShieldCheck, Ban, CheckCircle2, UserX, Eye, KeyRound, Trash2, LogIn,
} from 'lucide-react';
import { api, SYSTEM_ROLES } from '../lib/api';
import { PageHeader, SearchInput } from '../components/Layout';
import { Table, Pagination } from '../components/Table';
import { ViewSwitcher } from '../components/ViewSwitcher';
import { Alert, CopyField } from '../components/ui';
import { useViewMode } from '../lib/useViewMode';
import { usePagination } from '../lib/usePagination';
import { useDebounced } from '../lib/useDebounced';
import { UsersMatrix, UsersDetail } from '../components/UsersViews';
import { RowsSkeleton } from '../components/PageSkeleton';

const ELEVATED = new Set(['super_admin', 'admin']);

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

export function UsersPage() {
  const qc = useQueryClient();
  const { can } = usePermission();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const { page, setPage, pageSize, setPageSize, reset } = usePagination('users');
  const [view, setView] = useViewMode('users');
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleKey, setRoleKey] = useState('admin');
  const [tenantId, setTenantId] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [pwResult, setPwResult] = useState(null);

  const onSearchChange = (e) => { setSearchInput(e.target.value); reset(); };

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', search, page, pageSize],
    queryFn: async () => {
      const res = await api.get('/admin/users', {
        params: { search: search || undefined, page, pageSize },
      });
      return Array.isArray(res.data) ? { data: res.data, total: res.data.length } : res.data;
    },
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];

  // Workspace list for the role-scope picker.
  const workspaces = useQuery({
    queryKey: ['admin', 'workspaces', 'picker'],
    enabled: !!roleTarget,
    queryFn: async () => {
      const res = await api.get('/admin/workspaces', { params: { pageSize: 200 } });
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
  });

  // Auto-select first item for detail view.
  useEffect(() => {
    if (view === 'detail' && !selectedId && rows.length) setSelectedId(rows[0].id);
  }, [view, selectedId, rows]);

  const suspend = useMutation({
    mutationFn: ({ id, suspend: s }) => api.post(`/admin/users/${id}/suspend`, { suspend: s }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'user'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(vars.suspend ? 'User suspended.' : 'User reinstated.');
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Action failed.'),
  });

  const onSuspendClick = async (u, doSuspend) => {
    const ok = await confirm({
      title: doSuspend ? 'Suspend user' : 'Reinstate user',
      message: doSuspend
        ? `Suspend ${u.email}? They lose access immediately.`
        : `Reinstate ${u.email}? Access will be restored.`,
      confirmText: doSuspend ? 'Suspend' : 'Reinstate',
      danger: doSuspend,
    });
    if (ok) suspend.mutate({ id: u.id, suspend: doSuspend });
  };

  const assignRole = useMutation({
    mutationFn: (vars) => api.post('/admin/roles/assign', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'user'] });
      toast.success('Role assigned.');
      setRoleTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Action failed.'),
  });

  const detail = useQuery({
    queryKey: ['admin', 'user', detailId],
    enabled: !!detailId,
    queryFn: async () => (await api.get(`/admin/users/${detailId}`)).data,
  });

  const resetPw = useMutation({
    mutationFn: (id) => api.post(`/admin/users/${id}/reset-password`, {}),
    onSuccess: (res, id) => {
      const u = rows.find((x) => x.id === id);
      setPwResult({ email: u?.email ?? id, password: res.data?.password });
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Reset failed.'),
  });

  const onResetClick = async (u) => {
    const ok = await confirm({
      title: 'Reset password',
      message: `Generate a new password for ${u.email}? They will be signed out everywhere.`,
      confirmText: 'Reset password',
      danger: true,
    });
    if (ok) resetPw.mutate(u.id);
  };

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('User deleted.');
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Delete failed.'),
  });

  const onDeleteClick = async (u) => {
    const ok = await confirm({
      title: 'Delete user',
      message: `Permanently delete ${u.email}? This cannot be undone.`,
      confirmText: 'Delete permanently',
      danger: true,
    });
    if (ok) del.mutate(u.id);
  };

  const impersonate = useMutation({
    mutationFn: (id) => api.post(`/admin/users/${id}/impersonate`),
    onSuccess: (res) => {
      const token = res.data?.accessToken;
      if (token) {
        setAccessToken(token);
        toast.success(`Impersonating ${res.data?.user?.email ?? 'user'}. Opening user app…`);
        window.open('/', '_blank', 'noopener');
      } else {
        toast.success('Impersonation token issued.');
      }
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Impersonation failed.'),
  });

  const onImpersonateClick = async (u) => {
    const ok = await confirm({
      title: 'Impersonate user',
      message: `Sign in as ${u.email}? This action is audited.`,
      confirmText: 'Impersonate',
      danger: true,
    });
    if (ok) impersonate.mutate(u.id);
  };

  const canSuspend = can('users.suspend');
  const canAssign = can('roles.assign');
  const canReset = can('users.reset_password');
  const canDelete = can('users.delete');
  const canImpersonate = can('users.impersonate');

  const isActive = (u) => u.isActive !== false;

  // Shared action menu — used by table, matrix, and detail views.
  const renderActions = (u) => (
    <>
      <MenuItem icon={<Eye size={16} />} onClick={() => setDetailId(u.id)}>View details</MenuItem>
      {canAssign && (
        <MenuItem icon={<ShieldCheck size={16} />} onClick={() => { setRoleTarget(u); setRoleKey('admin'); setTenantId(''); }}>
          Assign role
        </MenuItem>
      )}
      {canReset && <MenuItem icon={<KeyRound size={16} />} onClick={() => onResetClick(u)}>Reset password</MenuItem>}
      {canImpersonate && <MenuItem icon={<LogIn size={16} />} onClick={() => onImpersonateClick(u)}>Impersonate</MenuItem>}
      {canSuspend && (
        isActive(u)
          ? <MenuItem icon={<Ban size={16} />} danger onClick={() => onSuspendClick(u, true)}>Suspend user</MenuItem>
          : <MenuItem icon={<CheckCircle2 size={16} />} onClick={() => onSuspendClick(u, false)}>Reinstate user</MenuItem>
      )}
      {canDelete && <MenuItem icon={<Trash2 size={16} />} danger onClick={() => onDeleteClick(u)}>Delete user</MenuItem>}
    </>
  );

  const columns = [
    {
      key: 'email', header: 'User', render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
          <Avatar name={u.name} email={u.email} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: color.text }}>{u.name || u.email}</div>
            {u.name && <div style={{ color: color.textMuted, fontSize: 12 }}>{u.email}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'roles', header: 'Roles', render: (u) => (
        <div style={{ display: 'flex', gap: space.xs, flexWrap: 'wrap' }}>
          {(u.roles ?? []).length === 0
            ? <span style={{ color: color.mediumGray, fontSize: 13 }}>none</span>
            : u.roles.map((r) => (
              <Badge key={r} kind={ELEVATED.has(r) ? 'primary' : 'default'}>{r}</Badge>
            ))}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', render: (u) => (
        <Badge kind={isActive(u) ? 'success' : 'error'}>{isActive(u) ? 'Active' : 'Suspended'}</Badge>
      ),
    },
    { key: 'createdAt', header: 'Joined', render: (u) => <span style={{ color: color.textMuted }}>{fmtDate(u.createdAt)}</span> },
    {
      key: 'actions', header: '', width: 64, align: 'right', render: (u) => (
        <Dropdown align="right" width={200} trigger={<IconButton label="Actions"><MoreHorizontal size={18} /></IconButton>}>
          {renderActions(u)}
        </Dropdown>
      ),
    },
  ];

  const total = data?.total ?? 0;
  const wsOptions = workspaces.data ?? [];

  return (
    <div>
      <PageHeader title="Users" subtitle={total ? `${total.toLocaleString()} total` : 'Manage accounts and roles'} breadcrumb={['Admin', 'Users']} />

      <div style={{ marginBottom: space.base, display: 'flex', gap: space.base, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <SearchInput value={searchInput} onChange={onSearchChange} placeholder="Search by email or name…" />
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {view === 'list' && (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          loading={isLoading}
          fetching={isFetching}
          onRetry={refetch}
          error={isError ? 'Failed to load users. The endpoint may not be available yet.' : null}
          empty="No users found"
          emptyDescription={search ? 'Try a different search term.' : 'Users will appear here once they sign up.'}
          emptyIcon={<UserX size={36} />}
        />
      )}

      {view === 'matrix' && (
        <UsersMatrix users={rows} loading={isLoading} isError={isError} search={search} renderActions={renderActions} />
      )}

      {view === 'detail' && (
        <UsersDetail
          users={rows} loading={isLoading} isError={isError} search={search}
          selectedId={selectedId} onSelect={setSelectedId} renderActions={renderActions}
        />
      )}

      {view !== 'detail' && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      )}

      {/* Assign role */}
      <Modal
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        title="Assign role"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleTarget(null)}>Cancel</Button>
            <Button
              loading={assignRole.isPending}
              onClick={() => roleTarget && assignRole.mutate({
                userId: roleTarget.id, roleKey, tenantId: tenantId || undefined,
              })}
            >
              Assign role
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <p style={{ fontFamily: font.text, color: color.textMuted, margin: 0, fontSize: 14 }}>
            Assign a role to <strong style={{ color: color.text }}>{roleTarget?.email}</strong>.
          </p>
          <Select label="Role" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select
            label="Scope"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            <option value="">— Global (system role) —</option>
            {wsOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <span style={{ fontFamily: font.text, fontSize: 12, color: color.textMuted, marginTop: -8 }}>
            {workspaces.isLoading ? 'Loading workspaces…' : 'Choose a workspace to scope the role, or keep it global.'}
          </span>
          {ELEVATED.has(roleKey) && (
            <Alert kind="warning" title="Elevated privileges">
              This grants administrative access across the platform. Assign with care.
            </Alert>
          )}
        </div>
      </Modal>

      {/* User detail */}
      <Modal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title="User details"
        size="lg"
        footer={<Button variant="secondary" onClick={() => setDetailId(null)}>Close</Button>}
      >
        {detail.isLoading && (
          <div style={{ padding: `${space.sm} 0` }}><RowsSkeleton rows={5} /></div>
        )}
        {detail.isError && (
          <Alert kind="danger" title="Could not load user">The user endpoint may not be available yet.</Alert>
        )}
        {detail.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg, fontFamily: font.text }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: space.base }}>
              <Avatar name={detail.data.name} email={detail.data.email} src={detail.data.avatarUrl} size={48} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: color.text }}>{detail.data.name || detail.data.email}</div>
                <div style={{ color: color.textMuted, fontSize: 13 }}>{detail.data.email}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Badge kind={detail.data.isActive ? 'success' : 'error'}>{detail.data.isActive ? 'Active' : 'Suspended'}</Badge>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space.base }}>
              <Stat label="Joined" value={fmtDate(detail.data.createdAt)} />
              <Stat label="Recent activity" value={`${detail.data.activityCount ?? 0} events`} />
            </div>

            <Section title="Roles">
              {(detail.data.roles ?? []).length === 0
                ? <span style={{ color: color.mediumGray, fontSize: 13 }}>none</span>
                : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.xs }}>
                    {detail.data.roles.map((r, i) => (
                      <Badge key={`${r.key}-${i}`} kind={ELEVATED.has(r.key) ? 'primary' : 'default'}>
                        {r.key}{r.tenantId ? ` @ ${r.tenantId.slice(0, 8)}` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
            </Section>

            <Section title={`Owned workspaces (${detail.data.ownedWorkspaces?.length ?? 0})`}>
              <WsList items={detail.data.ownedWorkspaces} />
            </Section>
            <Section title={`Member of (${detail.data.memberWorkspaces?.length ?? 0})`}>
              <WsList items={detail.data.memberWorkspaces} />
            </Section>
          </div>
        )}
      </Modal>

      {/* New password result */}
      <Modal
        open={!!pwResult}
        onClose={() => setPwResult(null)}
        title="New password"
        footer={<Button onClick={() => setPwResult(null)}>Done</Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <p style={{ fontFamily: font.text, color: color.textMuted, margin: 0, fontSize: 14 }}>
            A new password was set for <strong style={{ color: color.text }}>{pwResult?.email}</strong>.
          </p>
          <CopyField value={pwResult?.password ?? ''} />
          <Alert kind="warning" title="Shown only once">
            Copy this password now. It cannot be retrieved again after you close this dialog.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: color.surfaceAlt, borderRadius: 6, padding: '10px 12px' }}>
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
      {items.map((w) => (
        <div key={w.id} style={{ color: color.text, fontSize: 13 }}>{w.name}</div>
      ))}
    </div>
  );
}
