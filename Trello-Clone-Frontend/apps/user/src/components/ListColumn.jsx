import { useState, useEffect } from 'react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Archive, GripVertical,
  ArrowDownAZ, Calendar, Clock, ChevronRight, ChevronLeft, Copy, ArchiveX,
  Gauge, ArrowRightLeft, LayoutTemplate,
} from 'lucide-react';
import {
  Button, Input, IconButton, Dropdown, MenuItem,
  color, font, radius, space,
} from '@trello/ui';
import { CardTile } from './CardTile';

export function ListColumn({ list, cards, onAddCard, onCardClick, onRename, onDelete, onArchive, onSort, onCopy, onArchiveCards, onSetWip, onMove, onAddFromTemplate, selectMode = false, selectedIds, onToggleSelect, openComposer, onComposerHandled }) {
  const overWip = list.wipLimit > 0 && cards.length > list.wipLimit;
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(list.name);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (openComposer) { setCollapsed(false); setAdding(true); onComposerHandled?.(); }
  }, [openComposer, onComposerHandled]);

  const sortable = useSortable({ id: `list:${list.id}`, data: { type: 'list', listId: list.id } });
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = sortable;
  const { setNodeRef: setDropRef } = useDroppable({ id: `droplist:${list.id}`, data: { type: 'list', listId: list.id } });

  const submitCard = (e) => {
    e.preventDefault();
    if (title.trim()) { onAddCard(list.id, title.trim()); setTitle(''); setAdding(false); }
  };

  const submitName = (e) => {
    e?.preventDefault();
    const n = draftName.trim();
    if (n && n !== list.name) onRename(list.id, n);
    setEditing(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: 296, flexShrink: 0, background: color.surfaceAlt, borderRadius: radius.large,
    padding: space.md, maxHeight: '100%', display: 'flex', flexDirection: 'column',
    border: `1px solid ${color.border}`,
  };

  if (collapsed) {
    return (
      <div ref={setSortableRef} style={{ ...style, width: 44, alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setCollapsed(false)} aria-label={`Expand list ${list.name}`}>
        <IconButton label="Expand list" size={28} onClick={(e) => { e.stopPropagation(); setCollapsed(false); }}>
          <ChevronRight size={16} />
        </IconButton>
        <div style={{ writingMode: 'vertical-rl', marginTop: space.sm, fontWeight: 600, fontSize: 13, color: color.text }}>
          {list.name}{cards.length ? ` (${cards.length})` : ''}
        </div>
      </div>
    );
  }

  return (
    <div ref={setSortableRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px 4px' }}>
        <span {...attributes} {...listeners}
          style={{ display: 'inline-flex', cursor: 'grab', color: color.textMuted }} aria-label="Drag list">
          <GripVertical size={16} />
        </span>
        {editing ? (
          <form onSubmit={submitName} style={{ flex: 1 }}>
            <Input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
              onBlur={submitName} style={{ minHeight: 30, padding: '4px 8px', fontWeight: 600 }} />
          </form>
        ) : (
          <button
            onClick={() => { setDraftName(list.name); setEditing(true); }}
            style={{
              flex: 1, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'text',
              fontFamily: font.text, fontWeight: 700, fontSize: 15, color: color.text, padding: '2px 4px',
            }}
          >
            {list.name}
          </button>
        )}
        {!editing && (list.wipLimit > 0 ? (
          <span title={`WIP limit ${list.wipLimit}`} style={{
            fontSize: 12, fontWeight: 700, padding: '1px 7px', borderRadius: radius.pill,
            color: overWip ? '#fff' : color.textMuted, background: overWip ? color.danger : color.lightGray,
          }}>{cards.length}/{list.wipLimit}</span>
        ) : cards.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 500, color: color.textMuted }}>{cards.length}</span>
        ))}
        <Dropdown
          align="right" width={170}
          trigger={<IconButton label="List actions" size={28}><MoreHorizontal size={16} /></IconButton>}
        >
          <MenuItem icon={<Pencil size={16} />} onClick={() => { setDraftName(list.name); setEditing(true); }}>Rename</MenuItem>
          {onCopy && <MenuItem icon={<Copy size={16} />} onClick={() => onCopy(list.id)}>Copy list</MenuItem>}
          {onMove && <MenuItem icon={<ArrowRightLeft size={16} />} onClick={() => onMove(list)}>Move to board…</MenuItem>}
          {onAddFromTemplate && <MenuItem icon={<LayoutTemplate size={16} />} onClick={() => onAddFromTemplate(list)}>Add card from template…</MenuItem>}
          {onSetWip && <MenuItem icon={<Gauge size={16} />} onClick={() => onSetWip(list)}>Set WIP limit</MenuItem>}
          <MenuItem icon={<ChevronLeft size={16} />} onClick={() => setCollapsed(true)}>Collapse</MenuItem>
          {onSort && <MenuItem icon={<ArrowDownAZ size={16} />} onClick={() => onSort(list.id, 'name')}>Sort by name</MenuItem>}
          {onSort && <MenuItem icon={<Calendar size={16} />} onClick={() => onSort(list.id, 'due')}>Sort by due date</MenuItem>}
          {onSort && <MenuItem icon={<Clock size={16} />} onClick={() => onSort(list.id, 'created')}>Sort by created</MenuItem>}
          {onArchiveCards && <MenuItem icon={<ArchiveX size={16} />} onClick={() => onArchiveCards(list)}>Archive all cards</MenuItem>}
          <MenuItem icon={<Archive size={16} />} onClick={() => onArchive(list.id)}>Archive</MenuItem>
          <MenuItem icon={<Trash2 size={16} />} danger onClick={() => onDelete(list)}>Delete</MenuItem>
        </Dropdown>
      </div>

      <div ref={setDropRef} style={{ overflowY: 'auto', flex: 1, minHeight: 8, padding: '4px 0' }}>
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <CardTile
              key={c.id}
              card={c}
              onClick={() => onCardClick(c)}
              selectMode={selectMode}
              selected={selectedIds?.has(c.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div style={{
            border: `2px dashed ${color.border}`, borderRadius: radius.large, padding: space.base,
            textAlign: 'center', fontSize: 12, color: color.textMuted,
          }}>
            Drop cards here
          </div>
        )}
      </div>

      {adding ? (
        <form onSubmit={submitCard} style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          <Input autoFocus placeholder="Card title" value={title}
            onChange={(e) => setTitle(e.target.value)} onBlur={() => !title && setAdding(false)} />
          <div style={{ display: 'flex', gap: space.sm }}>
            <Button type="submit" size="sm">Add</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setTitle(''); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none',
            background: 'transparent', color: color.textMuted, textAlign: 'left', padding: '10px',
            cursor: 'pointer', borderRadius: radius.base, fontSize: 15, fontFamily: font.text, fontWeight: 500,
          }}
        >
          <Plus size={16} /> Add a card
        </button>
      )}
    </div>
  );
}
