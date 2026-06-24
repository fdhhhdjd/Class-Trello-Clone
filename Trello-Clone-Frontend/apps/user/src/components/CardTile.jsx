import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, MessageSquare, CheckSquare, Paperclip } from 'lucide-react';
import { Avatar, LabelChip, color, font, radius, shadow, space } from '@trello/ui';

export const STATUS_META = {
  todo: { label: 'To do', color: '#8590A2' },
  doing: { label: 'In progress', color: '#1868DB' },
  done: { label: 'Done', color: '#4BCE97' },
  blocked: { label: 'Blocked', color: '#F87168' },
};

const AGING_ENABLED = true;
const AGE_WARN_DAYS = 14;
const AGE_STALE_DAYS = 30;

function ageTier(card) {
  if (!AGING_ENABLED) return null;
  const ts = card.updatedAt ?? card.createdAt;
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const days = (Date.now() - d.getTime()) / 86400000;
  if (days >= AGE_STALE_DAYS) return 'stale';
  if (days >= AGE_WARN_DAYS) return 'warn';
  return null;
}

function dueState(due) {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const overdue = d < new Date();
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return { label: `${date}, ${time}`, overdue };
}

export function CardTile({ card, onClick, overlay = false, selectMode = false, selected = false, onToggleSelect }) {
  const sortable = useSortable({
    id: card.id,
    data: { type: 'card', listId: card.listId },
    disabled: overlay || selectMode,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const aging = overlay ? null : ageTier(card);
  const baseOpacity = aging === 'stale' ? 0.72 : aging === 'warn' ? 0.88 : 1;

  const style = {
    transform: overlay ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: !overlay && isDragging ? 0.3 : baseOpacity,
    background: color.surface,
    borderRadius: radius.large,
    boxShadow: overlay ? shadow.hover : shadow.subtle,
    padding: card.coverUrl ? 0 : '10px 12px',
    overflow: 'hidden',
    marginBottom: space.sm,
    cursor: overlay ? 'grabbing' : 'pointer',
    fontFamily: font.text,
    fontSize: 15,
    color: color.text,
    border: selected ? `2px solid ${color.blue}` : `1px solid ${color.border}`,
    rotate: overlay ? '3deg' : undefined,
    width: overlay ? 280 : undefined,
    position: 'relative',
  };

  const handleClick = selectMode ? () => onToggleSelect?.(card.id) : onClick;
  const dragProps = (overlay || selectMode) ? {} : { ...attributes, ...listeners };

  const labels = card.labels ?? [];
  const members = card.members ?? [];
  const due = dueState(card.dueDate);
  const count = card.commentCount ?? 0;
  const attachments = card.attachmentCount ?? 0;
  const cl = card.checklist ?? card.checklistSummary;

  return (
    <div ref={overlay ? undefined : setNodeRef} className={!overlay && !isDragging ? 'trello-card-tile' : undefined} style={style} {...dragProps} onClick={handleClick}>
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(card.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select card"
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, cursor: 'pointer' }}
        />
      )}
      {card.coverUrl && (
        <img src={card.coverUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: card.coverUrl ? '10px 12px' : 0 }}>
      {labels.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {labels.map((l) => <LabelChip key={l.id} color={l.color} name={l.name} compact />)}
        </div>
      )}

      {card.status && STATUS_META[card.status] && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
            padding: '2px 8px', borderRadius: radius.pill, color: '#fff', background: STATUS_META[card.status].color,
          }}>{STATUS_META[card.status].label}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ flex: 1, lineHeight: '22px', fontWeight: 500 }}>{card.title}</span>
        {aging && (
          <span title={aging === 'stale' ? `Inactive ${AGE_STALE_DAYS}+ days` : `Inactive ${AGE_WARN_DAYS}+ days`}
            style={{ marginTop: 3, color: color.textMuted, opacity: aging === 'stale' ? 0.85 : 0.55, flexShrink: 0 }}>
            <Clock size={13} />
          </span>
        )}
      </div>

      {(due || count > 0 || attachments > 0 || members.length > 0 || (cl && cl.total > 0)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginTop: 6, flexWrap: 'wrap' }}>
          {due && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
              padding: '2px 6px', borderRadius: radius.base,
              background: due.overdue ? color.errorBg : color.surfaceAlt,
              color: due.overdue ? color.danger : color.textMuted,
            }}>
              <Clock size={12} /> {due.label}
            </span>
          )}
          {cl && cl.total > 0 && (
            <span style={{ fontSize: 12, color: color.textMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <CheckSquare size={12} /> {cl.done}/{cl.total}
            </span>
          )}
          {count > 0 && (
            <span style={{ fontSize: 12, color: color.textMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <MessageSquare size={12} /> {count}
            </span>
          )}
          {attachments > 0 && (
            <span style={{ fontSize: 12, color: color.textMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Paperclip size={12} /> {attachments}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {members.slice(0, 3).map((m) => (
            <Avatar key={m.id} name={m.name} email={m.email} src={m.avatarUrl} size={24} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
