import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, CheckSquare, MessageSquare } from 'lucide-react';
import { color, font, radius, space, LabelChip, Avatar } from '@trello/ui';

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

function fmtDue(dueDate) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const COLS = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'list', label: 'List', sortable: true },
  { key: 'labels', label: 'Labels', sortable: false },
  { key: 'members', label: 'Members', sortable: false },
  { key: 'due', label: 'Due', sortable: true },
  { key: 'checklist', label: 'Checklist', sortable: false },
  { key: 'comments', label: 'Comments', sortable: false },
];

export function BoardTable({ lists, cards, onCardClick }) {
  const [sort, setSort] = useState({ by: 'list', dir: 'asc' });

  const listName = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists]);
  const listPos = useMemo(() => new Map(lists.map((l, i) => [l.id, i])), [lists]);

  const rows = useMemo(() => {
    const arr = [...cards];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let r = 0;
      if (sort.by === 'title') r = (a.title || '').localeCompare(b.title || '');
      else if (sort.by === 'list') {
        r = (listPos.get(a.listId) ?? 0) - (listPos.get(b.listId) ?? 0);
        if (r === 0) r = a.position - b.position;
      } else if (sort.by === 'due') {
        r = (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity);
      }
      return r * dir;
    });
    return arr;
  }, [cards, sort, listPos]);

  const toggleSort = (key) => setSort((s) =>
    s.by === key ? { by: key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by: key, dir: 'asc' });

  const th = {
    textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.3px', color: color.textMuted,
    borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap', position: 'sticky', top: 0,
    background: color.surface, zIndex: 1,
  };
  const td = {
    padding: '10px 14px', fontSize: 14, color: color.text, borderBottom: `1px solid ${color.border}`,
    verticalAlign: 'middle',
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 24px 24px' }}>
      <div style={{
        background: color.surface, borderRadius: radius.large, border: `1px solid ${color.border}`,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font.text, minWidth: 880 }}>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} style={{ ...th, cursor: c.sortable ? 'pointer' : 'default' }}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {c.label}
                    {c.sortable && sort.by === c.key && (
                      sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td style={{ ...td, color: color.textMuted }} colSpan={COLS.length}>No cards.</td></tr>
            )}
            {rows.map((card) => {
              const cl = card.checklistSummary ?? card.checklist ?? { done: 0, total: 0 };
              const overdue = isOverdue(card.dueDate);
              return (
                <tr key={card.id} onClick={() => onCardClick(card)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = color.surfaceAlt)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...td, fontWeight: 600, maxWidth: 320 }}>{card.title}</td>
                  <td style={{ ...td, color: color.textMuted, whiteSpace: 'nowrap' }}>{listName.get(card.listId) ?? ''}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                      {(card.labels ?? []).map((l) => <LabelChip key={l.id} color={l.color} name={l.name} />)}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', gap: 2 }}>
                      {(card.members ?? []).map((m) => (
                        <Avatar key={m.id} name={m.name} email={m.email} src={m.avatarUrl} size={24} />
                      ))}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: overdue ? color.red : color.text, fontWeight: overdue ? 600 : 400 }}>
                    {fmtDue(card.dueDate)}
                  </td>
                  <td style={{ ...td, color: color.textMuted, whiteSpace: 'nowrap' }}>
                    {cl.total > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckSquare size={14} /> {cl.done}/{cl.total}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: color.textMuted, whiteSpace: 'nowrap' }}>
                    {card.commentCount > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MessageSquare size={14} /> {card.commentCount}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
