import { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import {
  Modal, Button, Input, IconButton, LabelChip, useConfirm,
  color, space, radius, labelColors,
} from '@trello/ui';
import { useCreateBoardLabel, useUpdateBoardLabel, useDeleteBoardLabel } from '../lib/boardData';

const PALETTE = Object.values(labelColors);

function Swatches({ value, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} aria-label={`Pick ${c}`}
          style={{
            width: 28, height: 28, borderRadius: radius.base, background: c, cursor: 'pointer',
            border: value === c ? `2px solid ${color.text}` : '2px solid transparent',
          }}>
          {value === c && <Check size={14} color="#fff" />}
        </button>
      ))}
    </div>
  );
}

function LabelRow({ boardId, label }) {
  const confirm = useConfirm();
  const update = useUpdateBoardLabel(boardId);
  const del = useDeleteBoardLabel(boardId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name ?? '');
  const [col, setCol] = useState(label.color);

  const save = () => {
    update.mutate({ labelId: label.id, patch: { name: name.trim() || null, color: col } },
      { onSuccess: () => setEditing(false) });
  };

  const onDelete = async () => {
    const ok = await confirm({ title: 'Delete label?', message: 'It will be removed from all cards.', confirmText: 'Delete', danger: true });
    if (ok) del.mutate(label.id);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm, padding: space.sm, border: `1px solid ${color.border}`, borderRadius: radius.large }}>
        <Input value={name} placeholder="Label name" onChange={(e) => setName(e.target.value)} />
        <Swatches value={col} onPick={setCol} />
        <div style={{ display: 'flex', gap: space.sm }}>
          <Button size="sm" onClick={save} loading={update.isPending}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
      <button onClick={() => { setName(label.name ?? ''); setCol(label.color); setEditing(true); }}
        style={{ flex: 1, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        <LabelChip color={label.color} name={label.name || '(no name)'} />
      </button>
      <IconButton label="Delete label" size={28} onClick={onDelete}><Trash2 size={14} /></IconButton>
    </div>
  );
}

export function LabelsManager({ open, onClose, boardId, labels }) {
  const create = useCreateBoardLabel(boardId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [col, setCol] = useState(PALETTE[0]);

  const submit = () => {
    create.mutate({ name: name.trim() || undefined, color: col }, {
      onSuccess: () => { setName(''); setCol(PALETTE[0]); setAdding(false); },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Labels" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
        {labels.map((l) => <LabelRow key={l.id} boardId={boardId} label={l} />)}
        {labels.length === 0 && <div style={{ fontSize: 13, color: color.textMuted }}>No labels yet.</div>}

        {adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm, padding: space.sm, border: `1px solid ${color.border}`, borderRadius: radius.large }}>
            <Input autoFocus value={name} placeholder="Label name (optional)" onChange={(e) => setName(e.target.value)} />
            <Swatches value={col} onPick={setCol} />
            <div style={{ display: 'flex', gap: space.sm }}>
              <Button size="sm" onClick={submit} loading={create.isPending}>Create</Button>
              <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" leftIcon={<Plus size={15} />} onClick={() => setAdding(true)}>
            Create label
          </Button>
        )}
      </div>
    </Modal>
  );
}
