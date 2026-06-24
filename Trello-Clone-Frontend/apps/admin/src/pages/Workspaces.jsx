import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge, Avatar, IconButton, Dropdown, MenuItem, Button, Modal, Input, Select,
  usePermission, useToast, useConfirm, color, space, font, radius,
} from '@trello/ui';
import { MoreHorizontal, Trash2, FolderX, Pencil, UserCog, Lock, Unlock, Check } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, SearchInput } from '../components/Layout';
import { Table, Pagination } from '../components/Table';
import { ViewSwitcher } from '../components/ViewSwitcher';
import { Alert } from '../components/ui';
import { useViewMode } from '../lib/useViewMode';
import { usePagination } from '../lib/usePagination';
import { useDebounced } from '../lib/useDebounced';
import { WorkspacesMatrix, WorkspacesDetail } from '../components/WorkspacesViews';

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

export function WorkspacesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = usePermission();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const { page, setPage, pageSize, setPageSize, reset } = usePagination('workspaces');
  const [view, setView] = useViewMode('workspaces');
  const [selectedId, setSelectedId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [transferTarget, setTransferTarget] = useState(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['admin', 'workspaces', search, page, pageSize],
    queryFn: async () => {
      const res = await api.get('/admin/workspaces', {
        params: { search: search || undefined, page, pageSize },
      });
      return Array.isArray(res.data) ? { data: res.data, total: res.data.length } : res.data;
    },
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];

  useEffect(() => {
    if (view === 'detail' && !selectedId && rows.length) setSelectedId(rows[0].id);
  }, [view, selectedId, rows]);

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/workspaces/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('Workspace deleted.');
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Delete failed.'),
  });

  const onDeleteClick = async (w) => {
    const ok = await confirm({
      title: 'Delete workspace',
      message: `Permanently delete ${w.name} and all of its boards? This cannot be undone.`,
      confirmText: 'Delete permanently',
      danger: true,
    });
    if (ok) del.mutate(w.id);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
    qc.invalidateQueries({ queryKey: ['admin', 'workspace'] });
  };

  const update = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/admin/workspaces/${id}`, body),
    onSuccess: () => { invalidate(); toast.success('Workspace updated.'); setEditTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Update failed.'),
  });

  const transfer = useMutation({
    mutationFn: ({ id, body }) => api.post(`/admin/workspaces/${id}/transfer-owner`, body),
    onSuccess: () => { invalidate(); toast.success('Owner transferred.'); setTransferTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Transfer failed.'),
  });

  const lock = useMutation({
    mutationFn: ({ id, locked }) => api.post(`/admin/workspaces/${id}/lock`, { locked }),
    onSuccess: (_d, v) => { invalidate(); toast.success(v.locked ? 'Workspace locked.' : 'Workspace unlocked.'); },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Action failed.'),
  });

  const onLockClick = async (w) => {
    const locking = !w.isLocked;
    const ok = await confirm({
      title: locking ? 'Lock workspace' : 'Unlock workspace',
      message: locking ? `Lock ${w.name}? It will be flagged as locked.` : `Unlock ${w.name}?`,
      confirmText: locking ? 'Lock' : 'Unlock',
      danger: locking,
    });
    if (ok) lock.mutate({ id: w.id, locked: locking });
  };

  const openEdit = (w) => {
    setEditTarget(w);
    setEditName(w.name ?? '');
    setEditVisibility(w.visibility ?? 'private');
  };

  const canDelete = can('workspaces.delete');
  const canUpdate = can('workspaces.update');
  const canLock = can('workspaces.lock');

  const renderActions = (w) => (
    <>
      {canUpdate && <MenuItem icon={<Pencil size={16} />} onClick={() => openEdit(w)}>Edit</MenuItem>}
      {canUpdate && <MenuItem icon={<UserCog size={16} />} onClick={() => setTransferTarget(w)}>Transfer owner</MenuItem>}
      {canLock && (
        w.isLocked
          ? <MenuItem icon={<Unlock size={16} />} onClick={() => onLockClick(w)}>Unlock</MenuItem>
          : <MenuItem icon={<Lock size={16} />} onClick={() => onLockClick(w)}>Lock</MenuItem>
      )}
      {canDelete && <MenuItem icon={<Trash2 size={16} />} danger onClick={() => onDeleteClick(w)}>Delete workspace</MenuItem>}
    </>
  );

  const columns = [
    {
      key: 'name', header: 'Workspace', render: (w) => (
        <div
          onClick={() => navigate(`/workspaces/${w.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: space.md, cursor: 'pointer' }}
        >
          <Avatar name={w.name} size={32} style={{ borderRadius: 6 }} />
          <span style={{ fontWeight: 600, color: color.blue }}>{w.name}</span>
          {w.isLocked && (
            <span title="Locked" style={{ display: 'inline-flex', color: color.danger }}><Lock size={14} /></span>
          )}
        </div>
      ),
    },
    { key: 'ownerEmail', header: 'Owner', render: (w) => <span style={{ color: color.textMuted }}>{w.ownerEmail ?? '—'}</span> },
    { key: 'visibility', header: 'Visibility', render: (w) => <Badge>{w.visibility ?? '—'}</Badge> },
    { key: 'memberCount', header: 'Members', align: 'center', render: (w) => <Badge>{w.memberCount ?? 0}</Badge> },
    { key: 'boardCount', header: 'Boards', align: 'center', render: (w) => <Badge kind="primary">{w.boardCount ?? 0}</Badge> },
    { key: 'createdAt', header: 'Created', render: (w) => <span style={{ color: color.textMuted }}>{fmtDate(w.createdAt)}</span> },
    {
      key: 'actions', header: '', width: 64, align: 'right', render: (w) => (
        <Dropdown align="right" width={190} trigger={<IconButton label="Actions"><MoreHorizontal size={18} /></IconButton>}>
          {renderActions(w)}
        </Dropdown>
      ),
    },
  ];

  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader title="Workspaces" subtitle={total ? `${total.toLocaleString()} total` : 'Manage tenant workspaces'} breadcrumb={['Admin', 'Workspaces']} />

      <div style={{ marginBottom: space.base, display: 'flex', gap: space.base, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <SearchInput value={searchInput} onChange={(e) => { setSearchInput(e.target.value); reset(); }} placeholder="Search workspaces…" />
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {view === 'list' && (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(w) => w.id}
          loading={isLoading}
          fetching={isFetching}
          onRetry={refetch}
          error={isError ? 'Failed to load workspaces. The endpoint may not be available yet.' : null}
          empty="No workspaces found"
          emptyDescription={search ? 'Try a different search term.' : 'Workspaces created by users will appear here.'}
          emptyIcon={<FolderX size={36} />}
        />
      )}

      {view === 'matrix' && (
        <WorkspacesMatrix
          workspaces={rows} loading={isLoading} isError={isError} search={search}
          renderActions={renderActions} onOpen={(id) => navigate(`/workspaces/${id}`)}
        />
      )}

      {view === 'detail' && (
        <WorkspacesDetail
          workspaces={rows} loading={isLoading} isError={isError} search={search}
          selectedId={selectedId} onSelect={setSelectedId} renderActions={renderActions}
        />
      )}

      {view !== 'detail' && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      )}

      {/* Edit workspace */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit workspace"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              loading={update.isPending}
              disabled={!editName.trim()}
              onClick={() => editTarget && update.mutate({
                id: editTarget.id,
                body: { name: editName.trim(), visibility: editVisibility },
              })}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Select label="Visibility" value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}>
            <option value="private">private</option>
            <option value="workspace">workspace</option>
            <option value="public">public</option>
          </Select>
        </div>
      </Modal>

      {/* Transfer owner */}
      <TransferOwnerModal
        target={transferTarget}
        onClose={() => setTransferTarget(null)}
        pending={transfer.isPending}
        onSubmit={(newOwnerId) => transferTarget && transfer.mutate({ id: transferTarget.id, body: { newOwnerId } })}
      />
    </div>
  );
}

/* ------------------------------------------------ Transfer owner (member picker) */

function TransferOwnerModal({ target, onClose, pending, onSubmit }) {
  const [selectedId, setSelectedId] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => { setSelectedId(''); setEmail(''); }, [target]);

  const members = useQuery({
    queryKey: ['admin', 'workspace', target?.id, 'members'],
    enabled: !!target,
    queryFn: async () => {
      const res = await api.get(`/admin/workspaces/${target.id}`);
      return res.data?.members ?? [];
    },
  });

  const list = members.data ?? [];
  const hasMembers = list.length > 0;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // If members are available, pick by id; otherwise fall back to email lookup.
  const lookupByEmail = members.isError || (!members.isLoading && !hasMembers);
  const canSubmit = lookupByEmail ? emailValid : !!selectedId;

  const submit = () => {
    if (lookupByEmail) onSubmit(email.trim());
    else onSubmit(selectedId);
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title="Transfer owner"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={pending} disabled={!canSubmit} onClick={submit}>Transfer</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        <p style={{ fontFamily: font.text, color: color.textMuted, margin: 0, fontSize: 14 }}>
          Transfer ownership of <strong style={{ color: color.text }}>{target?.name}</strong> to another member.
        </p>

        {members.isLoading && (
          <span style={{ fontFamily: font.text, fontSize: 13, color: color.textMuted }}>Loading members…</span>
        )}

        {!members.isLoading && !lookupByEmail && (
          <div style={{
            border: `1px solid ${color.border}`, borderRadius: radius.large,
            maxHeight: 280, overflowY: 'auto',
          }}>
            {list.map((m) => {
              const active = m.userId === selectedId;
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => setSelectedId(m.userId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', textAlign: 'left',
                    padding: '10px 12px', border: 'none', borderBottom: `1px solid ${color.border}`,
                    cursor: 'pointer', background: active ? color.primaryBadgeBg : 'transparent',
                  }}
                >
                  <Avatar name={m.name} email={m.email} size={30} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: color.text, fontSize: 13 }}>{m.name || m.email}</div>
                    <div style={{ color: color.textMuted, fontSize: 12 }}>{m.email}</div>
                  </div>
                  <Badge>{m.role}</Badge>
                  {active && <Check size={16} style={{ color: color.blue, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}

        {!members.isLoading && lookupByEmail && (
          <>
            <Alert kind="info">
              No member list is available. Enter the email of the new owner; they must be an existing user.
            </Alert>
            <Input
              label="New owner email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={email && !emailValid ? 'Enter a valid email address.' : undefined}
              helper={!email ? 'The new owner is granted the workspace owner role.' : undefined}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
