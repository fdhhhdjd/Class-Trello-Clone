import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Card, Dropdown, MenuItem, IconButton, Spinner, EmptyState, Button,
  color, space, font, radius,
} from '@trello/ui';
import {
  MoreHorizontal, AlertTriangle, FolderX, Lock, Users, LayoutDashboard, ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

/* ----------------------------------------------------------------- Matrix */

export function WorkspacesMatrix({
  workspaces, loading, isError, search, renderActions, onOpen,
}) {
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: space.xxl }}><Spinner size={28} /></div>;
  }
  if (isError) {
    return <Card><EmptyState icon={<AlertTriangle size={36} />} title="Something went wrong" description="Failed to load workspaces. The endpoint may not be available yet." /></Card>;
  }
  if (!workspaces.length) {
    return <Card><EmptyState icon={<FolderX size={36} />} title="No workspaces found" description={search ? 'Try a different search term.' : 'Workspaces created by users will appear here.'} /></Card>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: space.base }}>
      {workspaces.map((w) => (
        <Card key={w.id} hoverable style={{ padding: space.base, display: 'flex', flexDirection: 'column', gap: space.md }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.md }}>
            <Avatar name={w.name} size={44} style={{ borderRadius: radius.large }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <button
                type="button"
                onClick={() => onOpen(w.id)}
                style={{
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                  fontWeight: 700, color: color.blue, fontFamily: font.text, fontSize: 15,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {w.name}
                {w.isLocked && <Lock size={13} style={{ color: color.danger, flexShrink: 0 }} />}
              </button>
              <div style={{ color: color.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.ownerEmail ?? '—'}</div>
            </div>
            {renderActions && (
              <Dropdown align="right" width={190} trigger={<IconButton label="Actions"><MoreHorizontal size={18} /></IconButton>}>
                {renderActions(w)}
              </Dropdown>
            )}
          </div>
          <div style={{ display: 'flex', gap: space.xs, flexWrap: 'wrap' }}>
            <Badge>{w.visibility ?? '—'}</Badge>
            {w.isLocked && <Badge kind="error"><Lock size={11} /> Locked</Badge>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, color: color.textMuted, fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {w.memberCount ?? 0} members</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LayoutDashboard size={13} /> {w.boardCount ?? 0} boards</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Detail */

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, marginBottom: space.sm }}>{title}</div>
      {children}
    </div>
  );
}

function WorkspaceDetailPanel({ wsId, renderActions, onOpen }) {
  const detail = useQuery({
    queryKey: ['admin', 'workspace', wsId],
    enabled: !!wsId,
    queryFn: async () => (await api.get(`/admin/workspaces/${wsId}`)).data,
  });

  if (!wsId) {
    return <EmptyState icon={<FolderX size={36} />} title="No workspace selected" description="Select a workspace from the list to see its details." />;
  }
  if (detail.isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: space.xxl }}><Spinner size={28} /></div>;
  }
  if (detail.isError || !detail.data) {
    return <EmptyState icon={<AlertTriangle size={36} />} title="Could not load workspace" description="The workspace endpoint may not be available yet." />;
  }
  const ws = detail.data;
  const counts = ws.counts ?? {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg, fontFamily: font.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.base }}>
        <Avatar name={ws.name} size={52} style={{ borderRadius: radius.large }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: color.text }}>{ws.name}</div>
          <div style={{ color: color.textMuted, fontSize: 13 }}>Owner: {ws.owner?.name || ws.owner?.email || '—'}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.sm }}>
          <Button variant="ghost" size="sm" leftIcon={<ExternalLink size={15} />} onClick={() => onOpen(ws.id)}>Open</Button>
          {renderActions && (
            <Dropdown align="right" width={190} trigger={<IconButton label="Actions"><MoreHorizontal size={18} /></IconButton>}>
              {renderActions(ws)}
            </Dropdown>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: space.xs, flexWrap: 'wrap' }}>
        <Badge kind="primary">{ws.visibility}</Badge>
        {ws.isLocked && <Badge kind="error"><Lock size={11} /> Locked</Badge>}
        <Badge>Created {fmtDate(ws.createdAt)}</Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: space.base }}>
        <Stat label="Boards" value={counts.boards ?? ws.boards?.length ?? 0} />
        <Stat label="Cards" value={counts.cards ?? 0} />
        <Stat label="Members" value={counts.members ?? ws.members?.length ?? 0} />
      </div>
      <Section title={`Boards (${ws.boards?.length ?? 0})`}>
        {(ws.boards ?? []).length === 0
          ? <span style={{ color: color.mediumGray, fontSize: 13 }}>none</span>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ws.boards.map((b) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: space.sm, color: color.text, fontSize: 13 }}>
                  <span>{b.name}</span>
                  <Badge kind={b.archived ? 'default' : 'success'}>{b.archived ? 'Archived' : 'Active'}</Badge>
                </div>
              ))}
            </div>
          )}
      </Section>
      <Section title={`Members (${ws.members?.length ?? 0})`}>
        {(ws.members ?? []).length === 0
          ? <span style={{ color: color.mediumGray, fontSize: 13 }}>none</span>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
              {ws.members.map((m) => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                  <Avatar name={m.name} email={m.email} size={26} />
                  <span style={{ fontSize: 13, color: color.text }}>{m.name || m.email}</span>
                  <Badge style={{ marginLeft: 'auto' }}>{m.role}</Badge>
                </div>
              ))}
            </div>
          )}
      </Section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: color.surfaceAlt, borderRadius: radius.large, padding: '10px 12px' }}>
      <div style={{ color: color.textMuted, fontSize: 12 }}>{label}</div>
      <div style={{ color: color.text, fontWeight: 700, fontSize: 18 }}>{value}</div>
    </div>
  );
}

export function WorkspacesDetail({
  workspaces, loading, isError, search, selectedId, onSelect, renderActions,
}) {
  const navigate = useNavigate();
  const onOpen = (id) => navigate(`/workspaces/${id}`);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: space.xxl }}><Spinner size={28} /></div>;
  }
  if (isError) {
    return <Card><EmptyState icon={<AlertTriangle size={36} />} title="Something went wrong" description="Failed to load workspaces." /></Card>;
  }
  if (!workspaces.length) {
    return <Card><EmptyState icon={<FolderX size={36} />} title="No workspaces found" description={search ? 'Try a different search term.' : 'Workspaces created by users will appear here.'} /></Card>;
  }
  return (
    <div className="admin-master-detail" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: space.base, alignItems: 'start' }}>
      <div style={{
        background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
        overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto',
      }}>
        {workspaces.map((w) => {
          const active = w.id === selectedId;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelect(w.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none', borderBottom: `1px solid ${color.border}`,
                cursor: 'pointer', background: active ? color.primaryBadgeBg : 'transparent',
                borderLeft: `3px solid ${active ? color.blue : 'transparent'}`,
              }}
            >
              <Avatar name={w.name} size={32} style={{ borderRadius: radius.base }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, color: color.text, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {w.name}
                  {w.isLocked && <Lock size={11} style={{ color: color.danger, flexShrink: 0 }} />}
                </div>
                <div style={{ color: color.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.ownerEmail ?? '—'}</div>
              </div>
            </button>
          );
        })}
      </div>
      <Card style={{ minHeight: 320 }}>
        <WorkspaceDetailPanel wsId={selectedId} renderActions={renderActions} onOpen={onOpen} />
      </Card>
    </div>
  );
}
