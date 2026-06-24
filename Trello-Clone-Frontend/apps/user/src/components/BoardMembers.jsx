import { Plus, Trash2 } from 'lucide-react';
import {
  Modal, Avatar, IconButton, Spinner, Button,
  color, space, radius, font,
} from '@trello/ui';
import {
  useBoardMembers, useWorkspaceMembers, useAddBoardMember,
  useUpdateBoardMember, useRemoveBoardMember,
} from '../lib/boardData';

const ROLES = ['admin', 'member', 'observer'];

export function BoardMembers({ open, onClose, boardId, workspaceId }) {
  const membersQ = useBoardMembers(boardId);
  const wsQ = useWorkspaceMembers(workspaceId);
  const add = useAddBoardMember(boardId);
  const updateRole = useUpdateBoardMember(boardId);
  const remove = useRemoveBoardMember(boardId);

  const members = membersQ.data ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = (wsQ.data ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <Modal open={open} onClose={onClose} title="Board members" size="sm">
      {membersQ.isLoading ? <Spinner size={20} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
              <Avatar name={m.name} email={m.email} src={m.avatarUrl} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.name || m.email}
                </div>
              </div>
              <select value={m.role} onChange={(e) => updateRole.mutate({ userId: m.id, role: e.target.value })}
                style={{ fontFamily: font.text, fontSize: 13, padding: '4px 6px', borderRadius: radius.base, border: `1px solid ${color.border}` }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <IconButton label="Remove member" size={28} onClick={() => remove.mutate(m.id)}><Trash2 size={14} /></IconButton>
            </div>
          ))}
          {members.length === 0 && <div style={{ fontSize: 13, color: color.textMuted }}>No board members yet.</div>}

          <div style={{ borderTop: `1px solid ${color.border}`, marginTop: space.sm, paddingTop: space.sm }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: color.textMuted, marginBottom: 6 }}>
              Add from workspace
            </div>
            {wsQ.isLoading ? <Spinner size={16} /> : candidates.length === 0 ? (
              <div style={{ fontSize: 13, color: color.textMuted }}>Everyone is already a member.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {candidates.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                    <Avatar name={u.name} email={u.email} src={u.avatarUrl} size={26} />
                    <span style={{ flex: 1, fontSize: 13, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name || u.email}
                    </span>
                    <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} loading={add.isPending}
                      onClick={() => add.mutate({ userId: u.id, role: 'member' })}>Add</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
