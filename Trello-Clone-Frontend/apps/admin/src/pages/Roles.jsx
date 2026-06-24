import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge, Button, Modal, EmptyState,
  usePermission, useToast, color, space, font, radius,
} from '@trello/ui';
import { ShieldCheck, Lock, AlertTriangle, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { Table } from '../components/Table';
import { Alert } from '../components/ui';
import { RowsSkeleton } from '../components/PageSkeleton';

export function RolesPage() {
  const { hasRole } = usePermission();
  const isSuper = hasRole('super_admin');
  const [detailId, setDetailId] = useState(null);

  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => (await api.get('/admin/roles')).data,
  });

  const rows = Array.isArray(roles.data) ? roles.data : (roles.data?.data ?? []);

  const columns = [
    {
      key: 'name', header: 'Role', render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <span style={{
            width: 30, height: 30, borderRadius: radius.large, flexShrink: 0,
            background: 'rgba(24,104,219,0.12)', color: color.blue,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}><ShieldCheck size={16} /></span>
          <div>
            <div style={{ fontWeight: 600, color: color.text }}>{r.name ?? r.key}</div>
            {r.description && <div style={{ color: color.textMuted, fontSize: 12 }}>{r.description}</div>}
          </div>
        </div>
      ),
    },
    { key: 'key', header: 'Key', render: (r) => <code style={{ fontFamily: font.mono, fontSize: 12, color: color.textMuted }}>{r.key}</code> },
    { key: 'isSystem', header: 'Type', align: 'center', render: (r) => (
      r.isSystem
        ? <Badge kind="primary"><Lock size={11} /> System</Badge>
        : <Badge>Custom</Badge>
    ) },
    { key: 'permissionCount', header: 'Permissions', align: 'center', render: (r) => <Badge>{r.permissionCount ?? 0}</Badge> },
    { key: 'userCount', header: 'Users', align: 'center', render: (r) => <Badge>{r.userCount ?? 0}</Badge> },
    {
      key: 'chev', header: '', width: 40, align: 'right',
      render: () => <span style={{ color: color.mediumGray, display: 'inline-flex' }}><ChevronRight size={18} /></span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can do across the platform"
        breadcrumb={['Admin', 'Roles']}
      />

      <ClickableTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={roles.isLoading}
        error={roles.isError ? 'Failed to load roles. The endpoint may not be available yet.' : null}
        empty="No roles defined"
        emptyDescription="Roles will appear here once the RBAC system is configured."
        emptyIcon={<ShieldCheck size={36} />}
        onRowClick={(r) => setDetailId(r.id)}
      />

      <RoleDetailModal
        roleId={detailId}
        canEdit={isSuper}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

// Table wrapper that makes rows clickable. Reuses base Table for empty/loading/error.
function ClickableTable({ onRowClick, columns, rows, rowKey, ...rest }) {
  const wrapped = columns.map((c) => ({
    ...c,
    render: (row) => (
      <span style={{ cursor: 'pointer', display: 'block' }} onClick={() => onRowClick?.(row)}>
        {c.render ? c.render(row) : row[c.key]}
      </span>
    ),
  }));
  return <Table columns={wrapped} rows={rows} rowKey={rowKey} {...rest} />;
}

function RoleDetailModal({ roleId, canEdit, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState(() => new Set());

  const detail = useQuery({
    queryKey: ['admin', 'role', roleId],
    enabled: !!roleId,
    queryFn: async () => (await api.get(`/admin/roles/${roleId}`)).data,
  });

  const perms = useQuery({
    queryKey: ['admin', 'permissions'],
    enabled: !!roleId,
    queryFn: async () => (await api.get('/admin/permissions')).data,
  });

  const role = detail.data?.role ?? detail.data;
  const isSystem = role?.isSystem;
  const editable = canEdit && !isSystem;

  useEffect(() => {
    if (detail.data) setSelected(new Set(detail.data.permissions ?? []));
  }, [detail.data]);

  const groups = useMemo(() => (Array.isArray(perms.data) ? perms.data : (perms.data?.data ?? [])), [perms.data]);

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/roles/${roleId}/permissions`, { permissionKeys: [...selected] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      qc.invalidateQueries({ queryKey: ['admin', 'role', roleId] });
      toast.success('Permissions updated.');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to update permissions.'),
  });

  const toggle = (key) => {
    if (!editable) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const loading = detail.isLoading || perms.isLoading;
  const error = detail.isError;

  return (
    <Modal
      open={!!roleId}
      onClose={onClose}
      title={role ? (role.name ?? role.key) : 'Role'}
      size="lg"
      footer={editable ? (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>Save permissions</Button>
        </>
      ) : <Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {loading && (
        <div style={{ padding: `${space.sm} 0` }}><RowsSkeleton rows={6} /></div>
      )}
      {error && !loading && (
        <EmptyState icon={<AlertTriangle size={36} />} title="Could not load role" description="The role endpoint may not be available yet." />
      )}
      {!loading && !error && role && (
        <div style={{ fontFamily: font.text }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.base, flexWrap: 'wrap' }}>
            <code style={{ fontFamily: font.mono, fontSize: 12, color: color.textMuted }}>{role.key}</code>
            {isSystem && <Badge kind="primary"><Lock size={11} /> System role</Badge>}
          </div>
          {!editable && (
            <Alert kind="info" style={{ marginBottom: space.base }}>
              {isSystem ? 'System roles are read-only and cannot be modified.' : 'You do not have permission to edit roles.'}
            </Alert>
          )}

          {groups.length === 0 ? (
            <EmptyState icon={<ShieldCheck size={36} />} title="No permissions" description="No permissions are defined." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
              {groups.map((g) => (
                <div key={g.resource}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: color.text, marginBottom: space.sm, textTransform: 'capitalize' }}>
                    {g.resource}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: space.sm }}>
                    {(g.items ?? []).map((p) => {
                      const on = selected.has(p.key);
                      return (
                        <label
                          key={p.key}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: space.sm,
                            padding: '8px 10px', borderRadius: radius.base,
                            border: `1px solid ${on ? color.blue : color.border}`,
                            background: on ? color.primaryBadgeBg : color.surface,
                            cursor: editable ? 'pointer' : 'default', opacity: editable ? 1 : 0.85,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!editable}
                            onChange={() => toggle(p.key)}
                            style={{ marginTop: 2, accentColor: color.blue }}
                          />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: color.text }}>{p.action}</span>
                            {p.description && <span style={{ display: 'block', fontSize: 12, color: color.textMuted }}>{p.description}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
