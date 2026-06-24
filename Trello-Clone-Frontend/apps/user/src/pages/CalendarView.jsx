import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Columns3, AlertTriangle, CalendarDays } from 'lucide-react';
import {
  Button, Skeleton, EmptyState, IconButton,
  color, font, space, radius,
} from '@trello/ui';
import { useBoardData, useUpdateCard } from '../lib/boardData';
import { CardModal } from '../components/CardModal';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Monday-first 6-week grid covering the given month.
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // days before the 1st (Mon=0)
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const MAX_CHIPS = 3;

function EventChip({ card, overdue, onClick }) {
  const [hover, setHover] = useState(false);
  const dot = card.labels?.[0]?.color ?? (overdue ? color.danger : color.blue);
  const time = (() => {
    const d = new Date(card.dueDate);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  })();
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/cardId', card.id)}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={card.title}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, width: '100%', textAlign: 'left',
        border: `1px solid ${overdue ? color.danger : color.border}`, borderRadius: radius.base,
        padding: '2px 6px', marginBottom: 3, cursor: 'pointer', fontFamily: font.text,
        background: hover ? color.surfaceAlt : (overdue ? color.errorBg : color.surface),
        transition: 'background .12s',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500,
        color: overdue ? color.danger : color.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{card.title}</span>
      {time && <span style={{ fontSize: 10, color: color.textMuted, flexShrink: 0 }}>{time}</span>}
    </button>
  );
}

function CalendarSkeleton() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.base, padding: '12px 24px', borderBottom: `1px solid ${color.border}` }}>
        <Skeleton width={180} height={18} />
        <span style={{ flex: 1 }} />
        <Skeleton width={150} height={18} />
        <Skeleton width={72} height={34} radius={radius.base} />
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', gap: 1, padding: 1, minHeight: 0 }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} height="100%" radius={radius.base} style={{ minHeight: 96 }} />
        ))}
      </div>
    </div>
  );
}

export function CalendarView() {
  const { boardId = '' } = useParams();
  const { board, cards, isLoading, isError } = useBoardData(boardId);
  const updateCard = useUpdateCard(boardId, { successMessage: null });
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [openCard, setOpenCard] = useState(null);

  const days = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const byDay = useMemo(() => {
    const map = new Map();
    cards.forEach((c) => {
      if (!c.dueDate) return;
      const d = new Date(c.dueDate);
      if (Number.isNaN(d.getTime())) return;
      const key = ymd(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    map.forEach((list) => list.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
    return map;
  }, [cards]);

  const dueCount = useMemo(() => cards.filter((c) => c.dueDate && !Number.isNaN(new Date(c.dueDate).getTime())).length, [cards]);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const prev = () => setCursor(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  const next = () => setCursor(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });
  const today = () => { const n = new Date(); setCursor({ y: n.getFullYear(), m: n.getMonth() }); };
  const todayKey = ymd(new Date());
  const nowMs = Date.now();

  const onDrop = (e, day) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/cardId');
    if (cardId) updateCard.mutate({ cardId, patch: { dueDate: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString() } });
  };

  if (isLoading) return <CalendarSkeleton />;
  if (isError) return <EmptyState icon={<AlertTriangle size={36} />} title="Could not load board" description="Try again in a moment." />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media (max-width: 767px) {
          .cal-grid { min-width: 720px; }
          .cal-scroll { overflow-x: auto; }
          .cal-month { min-width: auto !important; }
        }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: space.base, flexWrap: 'wrap',
        padding: '12px 24px', borderBottom: `1px solid ${color.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <CalendarDays size={18} color={color.textMuted} />
          <Link to={`/b/${boardId}`} style={{ fontSize: 14, color: color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {board?.name ?? 'Board'}
          </Link>
          <span style={{ fontSize: 14, color: color.textMuted }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: color.text }}>Calendar</span>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <IconButton label="Previous month" onClick={prev}><ChevronLeft size={18} /></IconButton>
          <span className="cal-month" style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: color.text, minWidth: 150, textAlign: 'center' }}>{monthLabel}</span>
          <IconButton label="Next month" onClick={next}><ChevronRight size={18} /></IconButton>
          <Button variant="secondary" size="sm" onClick={today}>Today</Button>
        </div>
        <Link to={`/b/${boardId}`}><Button variant="secondary" size="sm" leftIcon={<Columns3 size={15} />}>Board</Button></Link>
      </div>

      {dueCount === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="No due dates yet"
          description="Cards with a due date will appear here. Open a card and set its due date to see it on the calendar."
        />
      ) : (
        <div className="cal-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="cal-grid" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${color.border}` }}>
              {WEEKDAYS.map((w) => (
                <div key={w} style={{ padding: '8px', fontSize: 12, fontWeight: 700, color: color.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.04em' }}>{w}</div>
              ))}
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', minHeight: 0 }}>
              {days.map((day) => {
                const key = ymd(day);
                const inMonth = day.getMonth() === cursor.m;
                const isToday = key === todayKey;
                const list = byDay.get(key) ?? [];
                const extra = list.length - MAX_CHIPS;
                return (
                  <div key={key} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, day)}
                    style={{
                      borderRight: `1px solid ${color.border}`, borderBottom: `1px solid ${color.border}`,
                      padding: 5, overflowY: 'auto', minHeight: 96,
                      background: inMonth ? color.surface : color.surfaceAlt,
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 22, height: 22, borderRadius: '50%', fontSize: 12,
                        fontWeight: isToday ? 700 : 500,
                        background: isToday ? color.blue : 'transparent',
                        color: isToday ? color.white : (inMonth ? color.text : color.textMuted),
                      }}>
                        {day.getDate()}
                      </span>
                    </div>
                    {list.slice(0, MAX_CHIPS).map((c) => (
                      <EventChip
                        key={c.id}
                        card={c}
                        overdue={new Date(c.dueDate).getTime() < nowMs}
                        onClick={() => setOpenCard(c)}
                      />
                    ))}
                    {extra > 0 && (
                      <button type="button" onClick={() => setOpenCard(list[MAX_CHIPS])}
                        style={{ border: 'none', background: 'transparent', color: color.textMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '0 6px', fontFamily: font.text }}>
                        +{extra} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <CardModal card={openCard} boardId={boardId} board={board} onClose={() => setOpenCard(null)} />
    </div>
  );
}
