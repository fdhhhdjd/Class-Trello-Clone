import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge, Avatar, Button, Card, Modal, Input, Select, EmptyState,
  usePermission, useToast, useConfirm, color, space, font, radius,
} from '@trello/ui';
import {
  ArrowLeft, Pencil, UserCog, Lock, Unlock, Trash2, KanbanSquare, Users, LayoutDashboard, Layers, AlertTriangle, Check,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { Table } from '../components/Table';
import { Alert } from '../components/ui';
import { DetailSkeleton } from '../components/PageSkeleton';

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

function StatTile({ Icon, label, value }) {
  return (
    <Card style={{ padding: space.base }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
        <span style={{
          width: 36, height: 36, borderRadius: radius.large, flexShrink: 0,
          background: 'rgba(24,104,219,0.12)', color: color.blue,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={18} /></span>
        <div>
          <div style={{ color: color.textMuted, fontSize: 12 }}>{label}</div>
          <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: color.text, lineHeight: 1.1 }}>{value}</div>
        </div>
      </div>
    </Card>
  );
}

export function WorkspaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = usePermission();
  const toast = useToast();
  const confirm = useConfirm();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [transferOpen, setTransferOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [transferEmail, setTransferEmail] = useState('');

  const detail = useQuery({
    queryKey: ['admin', 'workspace', id],
    queryFn: async () => (await api.get(`/admin/workspaces/${id}`)).data,
  });

  const ws = detail.data;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'workspace', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
  };

  const update = useMutation({
    mutationFn: (body) => api.patch(`/admin/workspaces/${id}`, body),
    onSuccess: () => { invalidate(); toast.success('Workspace updated.'); setEditOpen(false); },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Update failed.'),
  });
  const transfer = useMutation({
    mutationFn: (body) => api.post(`/admin/workspaces/${id}/transfer-owner`, body),
    onSuccess: () => { invalidate(); toast.success('Owner transferred.'); setTransferOpen(false); },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Transfer failed.'),
  });
  const lock = useMutation({
    mutationFn: (locked) => api.post(`/admin/workspaces/${id}/lock`, { locked }),
    onSuccess: (_d, locked) => { invalidate(); toast.success(locked ? 'Workspace locked.' : 'Workspace unlocked.'); },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Action failed.'),
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/admin/workspaces/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast.success('Workspace deleted.');
      navigate('/workspaces', { replace: true });
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Delete failed.'),
  });

  const onLock = async () => {
    const locking = !ws.isLocked;
    const ok = await confirm({
      title: locking ? 'Lock workspace' : 'Unlock workspace',
      message: locking ? `Lock ${ws.name}?` : `Unlock ${ws.name}?`,
      confirmText: locking ? 'Lock' : 'Unlock', danger: locking,
    });
    if (ok) lock.mutate(locking);
  };
  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete workspace',
      message: `Permanently delete ${ws.name} and all of its boards? This cannot be undone.`,
      confirmText: 'Delete permanently', danger: true,
    });
    if (ok) del.mutate();
  };
  const openEdit = () => {
    setEditName(ws.name ?? '');
    setEditVisibility(ws.visibility ?? 'private');
    setEditOpen(true);
  };

  const canUpdate = can('workspaces.update');
  const canLock = can('workspaces.lock');
  const canDelete = can('workspaces.delete');

  if (detail.isLoading) {
    return (
      <div>
        <BackLink onClick={() => navigate('/workspaces')} />
        <DetailSkeleton />
      </div>
    );
  }
  if (detail.isError || !ws) {
    return (
      <div>
        <BackLink onClick={() => navigate('/workspaces')} />
        <Card><EmptyState icon={<AlertTriangle size={36} />} title="Could not load workspace" description="The workspace may not exist or the endpoint is unavailable." action={<Button variant="secondary" onClick={() => navigate('/workspaces')}>Back to workspaces</Button>} /></Card>
      </div>
    );
  }

  const counts = ws.counts ?? {};
  const boardColumns = [
    { key: 'name', header: 'Board', render: (b) => <span style={{ fontWeight: 600, color: color.text }}>{b.name}</span> },
    { key: 'listCount', header: 'Lists', align: 'center', render: (b) => <Badge>{b.listCount ?? 0}</Badge> },
    { key: 'cardCount', header: 'Cards', align: 'center', render: (b) => <Badge>{b.cardCount ?? 0}</Badge> },
    { key: 'archived', header: 'Status', align: 'center', render: (b) => <Badge kind={b.archived ? 'default' : 'success'}>{b.archived ? 'Archived' : 'Active'}</Badge> },
  ];
  const memberColumns = [
    { key: 'name', header: 'Member', render: (m) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
        <Avatar name={m.name} email={m.email} size={28} />
        <span style={{ fontWeight: 600, color: color.text }}>{m.name || m.email}</span>
      </div>
    ) },
    { key: 'email', header: 'Email', render: (m) => <span style={{ color: color.textMuted }}>{m.email}</span> },
    { key: 'role', header: 'Role', align: 'center', render: (m) => <Badge>{m.role}</Badge> },
  ];

  return (
    <div>
      <BackLink onClick={() => navigate('/workspaces')} />
      <PageHeader
        title={ws.name}
        breadcrumb={['Admin', 'Workspaces', ws.name]}
        subtitle={`Owner: ${ws.owner?.name || ws.owner?.email || '—'} · Created ${fmtDate(ws.createdAt)}`}
        action={
          <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
            {canUpdate && <Button variant="secondary" leftIcon={<Pencil size={16} />} onClick={openEdit}>Edit</Button>}
            {canUpdate && <Button variant="secondary" leftIcon={<UserCog size={16} />} onClick={() => { setNewOwnerId(''); setTransferEmail(''); setTransferOpen(true); }}>Transfer</Button>}
            {canLock && (
              <Button variant="secondary" leftIcon={ws.isLocked ? <Unlock size={16} /> : <Lock size={16} />} onClick={onLock}>
                {ws.isLocked ? 'Unlock' : 'Lock'}
              </Button>
            )}
            {canDelete && <Button variant="danger" leftIcon={<Trash2 size={16} />} onClick={onDelete}>Delete</Button>}
          </div>
        }
      />

      <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap', marginBottom: space.lg }}>
        <Badge kind="primary">{ws.visibility}</Badge>
        {ws.isLocked && <Badge kind="error"><Lock size={11} /> Locked</Badge>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: space.base, marginBottom: space.lg }}>
        <StatTile Icon={LayoutDashboard} label="Boards" value={counts.boards ?? ws.boards?.length ?? 0} />
        <StatTile Icon={Layers} label="Cards" value={counts.cards ?? 0} />
        <StatTile Icon={Users} label="Members" value={counts.members ?? ws.members?.length ?? 0} />
      </div>

      <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
        <KanbanSquare size={18} /> Boards
      </h2>
      <div style={{ marginBottom: space.lg }}>
        <Table columns={boardColumns} rows={ws.boards ?? []} rowKey={(b) => b.id} empty="No boards" emptyIcon={<LayoutDashboard size={36} />} />
      </div>

      <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
        <Users size={18} /> Members
      </h2>
      <Table columns={memberColumns} rows={ws.members ?? []} rowKey={(m) => m.userId} empty="No scoped members" emptyIcon={<Users size={36} />} />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit workspace"
        footer={<>
          <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button loading={update.isPending} disabled={!editName.trim()} onClick={() => update.mutate({ name: editName.trim(), visibility: editVisibility })}>Save changes</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Select label="Visibility" value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}>
            <option value="private">private</option>
            <option value="workspace">workspace</option>
            <option value="public">public</option>
          </Select>
        </div>
      </Modal>

      {(() => {
        const memberList = ws.members ?? [];
        const hasMembers = memberList.length > 0;
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferEmail.trim());
        const canSubmit = hasMembers ? !!newOwnerId : emailValid;
        const submit = () => transfer.mutate({ newOwnerId: hasMembers ? newOwnerId : transferEmail.trim() });
        return (
          <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer owner"
            footer={<>
              <Button variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Button>
              <Button loading={transfer.isPending} disabled={!canSubmit} onClick={submit}>Transfer</Button>
            </>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
              <p style={{ fontFamily: font.text, color: color.textMuted, margin: 0, fontSize: 14 }}>
                Transfer ownership of <strong style={{ color: color.text }}>{ws.name}</strong> to another member.
              </p>
              {hasMembers ? (
                <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.large, maxHeight: 280, overflowY: 'auto' }}>
                  {memberList.map((m) => {
                    const active = m.userId === newOwnerId;
                    return (
                      <button key={m.userId} type="button" onClick={() => setNewOwnerId(m.userId)} style={{
                        display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', textAlign: 'left',
                        padding: '10px 12px', border: 'none', borderBottom: `1px solid ${color.border}`,
                        cursor: 'pointer', background: active ? color.primaryBadgeBg : 'transparent',
                      }}>
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
              ) : (
                <>
                  <Alert kind="info">No member list is available. Enter the email of the new owner; they must be an existing user.</Alert>
                  <Input label="New owner email" type="email" placeholder="name@example.com" value={transferEmail}
                    onChange={(e) => setTransferEmail(e.target.value)}
                    error={transferEmail && !emailValid ? 'Enter a valid email address.' : undefined}
                    helper={!transferEmail ? 'The new owner is granted the workspace owner role.' : undefined} />
                </>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

function BackLink({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none',
      color: color.textMuted, fontFamily: font.text, fontSize: 13, cursor: 'pointer',
      padding: 0, marginBottom: space.md,
    }}>
      <ArrowLeft size={15} /> Back to workspaces
    </button>
  );
}
