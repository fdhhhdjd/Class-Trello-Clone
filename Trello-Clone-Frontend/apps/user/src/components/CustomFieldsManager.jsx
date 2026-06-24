import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Modal, Button, Input, IconButton, useConfirm,
  color, space, radius, font,
} from '@trello/ui';
import { useCreateField, useDeleteField } from '../lib/boardData';

const TYPES = ['text', 'number', 'date', 'checkbox', 'dropdown'];

export function CustomFieldsManager({ open, onClose, boardId, fields }) {
  const confirm = useConfirm();
  const create = useCreateField(boardId);
  const del = useDeleteField(boardId);
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState('');

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    const payload = { name: n, type };
    if (type === 'dropdown') payload.options = options.split(',').map((s) => s.trim()).filter(Boolean);
    create.mutate(payload, { onSuccess: () => { setName(''); setOptions(''); setType('text'); } });
  };

  const onDelete = async (f) => {
    const ok = await confirm({ title: 'Delete field?', message: `"${f.name}" and its values will be removed.`, confirmText: 'Delete', danger: true });
    if (ok) del.mutate(f.id);
  };

  const selectStyle = { fontFamily: font.text, fontSize: 13, padding: '6px 8px', borderRadius: radius.base, border: `1px solid ${color.border}` };

  return (
    <Modal open={open} onClose={onClose} title="Custom fields" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
        {(fields ?? []).map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
            <span style={{ flex: 1, fontSize: 13, color: color.text }}>{f.name}</span>
            <span style={{ fontSize: 12, color: color.textMuted }}>{f.type}</span>
            <IconButton label="Delete field" size={28} onClick={() => onDelete(f)}><Trash2 size={14} /></IconButton>
          </div>
        ))}
        {(fields ?? []).length === 0 && <div style={{ fontSize: 13, color: color.textMuted }}>No custom fields yet.</div>}

        <div style={{ borderTop: `1px solid ${color.border}`, marginTop: space.sm, paddingTop: space.sm, display: 'flex', flexDirection: 'column', gap: space.sm }}>
          <Input placeholder="Field name" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {type === 'dropdown' && (
            <Input placeholder="Options (comma separated)" value={options} onChange={(e) => setOptions(e.target.value)} />
          )}
          <Button size="sm" leftIcon={<Plus size={15} />} loading={create.isPending} onClick={submit} disabled={!name.trim()}>
            Add field
          </Button>
        </div>
      </div>
    </Modal>
  );
}
