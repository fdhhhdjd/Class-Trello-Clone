import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, usePermission, useToast, useConfirm, color, space, font, radius,
} from '@trello/ui';
import { HardDrive, KanbanSquare, User, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { Table, Pagination } from '../components/Table';
import { usePagination } from '../lib/usePagination';

function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function Bar({ value, max }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
      <div style={{ flex: 1, height: 8, background: color.surfaceAlt, borderRadius: 999, overflow: 'hidden', minWidth: 80 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color.blue, borderRadius: 999 }} />
      </div>
      <span style={{ color: color.textMuted, fontSize: 13, whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>
        {fmtBytes(value)}
      </span>
    </div>
  );
}

export function StoragePage() {
  const qc = useQueryClient();
  const { hasRole } = usePermission();
  const toast = useToast();
  const confirm = useConfirm();
  const isSuper = hasRole('super_admin');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'storage'],
    queryFn: async () => (await api.get('/admin/storage')).data,
  });

  const wsPg = usePagination('storage.ws', 10);
  const userPg = usePagination('storage.user', 10);

  // Config is optional — quota bar shows only when available.
  const config = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: async () => (await api.get('/admin/config')).data,
    enabled: isSuper,
    retry: false,
  });

  const cleanup = useMutation({
    mutationFn: () => api.post('/admin/storage/cleanup'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'storage'] });
      const n = res.data?.removed ?? 0;
      toast.success(n ? `Removed ${n} orphaned file${n === 1 ? '' : 's'}.` : 'No orphaned files found.');
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Cleanup failed.'),
  });

  const onCleanup = async () => {
    const ok = await confirm({
      title: 'Clean up orphaned files',
      message: 'Scan attachments and permanently delete files with no matching card or missing object. This cannot be undone.',
      confirmText: 'Clean up', danger: true,
    });
    if (ok) cleanup.mutate();
  };

  const totalBytes = data?.totalBytes ?? 0;
  const byWorkspace = data?.byWorkspace ?? [];
  const byUser = data?.byUser ?? [];
  const maxWs = Math.max(1, ...byWorkspace.map((r) => r.bytes));
  const maxUser = Math.max(1, ...byUser.map((r) => r.bytes));

  const wsPage = byWorkspace.slice((wsPg.page - 1) * wsPg.pageSize, wsPg.page * wsPg.pageSize);
  const userPage = byUser.slice((userPg.page - 1) * userPg.pageSize, userPg.page * userPg.pageSize);

  const quotaMb = config.data?.limits?.workspaceQuotaMb;
  const quotaBytes = quotaMb ? quotaMb * 1024 * 1024 : 0;
  const quotaPct = quotaBytes > 0 ? Math.min(100, Math.round((totalBytes / quotaBytes) * 100)) : 0;
  const overQuota = quotaBytes > 0 && totalBytes > quotaBytes;

  const wsColumns = [
    { key: 'name', header: 'Workspace', render: (r) => <span style={{ fontWeight: 600, color: color.text }}>{r.name ?? r.workspaceId}</span> },
    { key: 'bytes', header: 'Usage', render: (r) => <Bar value={r.bytes} max={maxWs} /> },
  ];
  const userColumns = [
    { key: 'email', header: 'User', render: (r) => <span style={{ fontWeight: 600, color: color.text }}>{r.email ?? r.userId}</span> },
    { key: 'bytes', header: 'Usage', render: (r) => <Bar value={r.bytes} max={maxUser} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Storage"
        subtitle="Attachment usage across the platform"
        breadcrumb={['Admin', 'Storage']}
        action={isSuper && (
          <Button variant="secondary" leftIcon={<Trash2 size={16} />} loading={cleanup.isPending} onClick={onCleanup}>
            Clean up orphans
          </Button>
        )}
      />

      <Card style={{ marginBottom: space.lg, padding: space.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.base }}>
          <span style={{
            width: 48, height: 48, borderRadius: radius.large, flexShrink: 0,
            background: 'rgba(24,104,219,0.12)', color: color.blue,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HardDrive size={24} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: color.textMuted, fontSize: 13 }}>Total storage used</div>
            <div style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: color.text }}>
              {isLoading ? '—' : fmtBytes(totalBytes)}
              {quotaBytes > 0 && (
                <span style={{ fontSize: 14, fontWeight: 500, color: color.textMuted }}> {' / '}{fmtBytes(quotaBytes)}</span>
              )}
            </div>
          </div>
        </div>
        {quotaBytes > 0 && (
          <div style={{ marginTop: space.base }}>
            <div style={{ height: 10, background: color.surfaceAlt, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(2, quotaPct)}%`, height: '100%', borderRadius: 999,
                background: overQuota ? color.danger : quotaPct > 80 ? '#B38600' : color.blue,
                transition: 'width .3s',
              }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: overQuota ? color.danger : color.textMuted }}>
              {quotaPct}% of quota used{overQuota ? ' — over limit' : ''}
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gap: space.lg, gridTemplateColumns: '1fr', marginBottom: space.lg }}>
        <div>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: color.text, display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
            <KanbanSquare size={18} /> By workspace
          </h2>
          <Table
            columns={wsColumns}
            rows={wsPage}
            rowKey={(r) => r.workspaceId}
            loading={isLoading}
            onRetry={refetch}
            error={isError ? 'Failed to load storage usage.' : null}
            empty="No storage usage"
          />
          {byWorkspace.length > 0 && (
            <Pagination page={wsPg.page} pageSize={wsPg.pageSize} total={byWorkspace.length} onPage={wsPg.setPage} onPageSize={wsPg.setPageSize} />
          )}
        </div>
        <div>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: color.text, display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
            <User size={18} /> By user
          </h2>
          <Table
            columns={userColumns}
            rows={userPage}
            rowKey={(r) => r.userId}
            loading={isLoading}
            onRetry={refetch}
            error={isError ? 'Failed to load storage usage.' : null}
            empty="No storage usage"
          />
          {byUser.length > 0 && (
            <Pagination page={userPg.page} pageSize={userPg.pageSize} total={byUser.length} onPage={userPg.setPage} onPageSize={userPg.setPageSize} />
          )}
        </div>
      </div>
    </div>
  );
}
