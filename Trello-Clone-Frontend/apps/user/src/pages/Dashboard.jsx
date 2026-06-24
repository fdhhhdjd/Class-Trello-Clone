import { Link } from 'react-router-dom';
import { ListChecks, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react';
import { Card, Spinner, EmptyState, color, font, space, radius } from '@trello/ui';
import { useDashboard } from '../lib/userData';

const BUCKET_META = [
  { key: 'overdue', label: 'Overdue', c: '#F87168' },
  { key: 'today', label: 'Today', c: '#F5CD47' },
  { key: 'week', label: 'This week', c: '#579DFF' },
  { key: 'later', label: 'Later', c: '#9F8FEF' },
  { key: 'none', label: 'No due date', c: '#8590A2' },
];

function StatCard({ icon, label, value, c }) {
  return (
    <Card style={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', gap: space.base }}>
      <div style={{ width: 40, height: 40, borderRadius: radius.large, background: `${c}22`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, color: color.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: font.text, fontSize: 13, color: color.textMuted }}>{label}</div>
      </div>
    </Card>
  );
}

function Bars({ data, max }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      {data.map((d) => (
        <div key={d.key ?? d.label} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <span style={{ width: 110, fontSize: 13, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <div style={{ flex: 1, height: 18, background: color.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' }}>
            <div style={{ width: `${max ? (d.value / max) * 100 : 0}%`, height: '100%', background: d.c ?? color.blue, transition: 'width .25s' }} />
          </div>
          <span style={{ width: 28, textAlign: 'right', fontSize: 13, color: color.textMuted }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_META = [
  { key: 'todo', label: 'To do', c: '#8590A2' },
  { key: 'doing', label: 'In progress', c: '#1868DB' },
  { key: 'done', label: 'Done', c: '#4BCE97' },
  { key: 'blocked', label: 'Blocked', c: '#F87168' },
  { key: 'none', label: 'No status', c: '#C1C7D0' },
];

function Donut({ segments, total }) {
  let acc = 0;
  const stops = segments.filter((s) => s.value > 0).map((s) => {
    const start = total ? (acc / total) * 360 : 0;
    acc += s.value;
    const end = total ? (acc / total) * 360 : 0;
    return `${s.c} ${start}deg ${end}deg`;
  });
  const bg = stops.length ? `conic-gradient(${stops.join(', ')})` : color.surfaceAlt;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.lg, flexWrap: 'wrap' }}>
      <div style={{ width: 130, height: 130, borderRadius: '50%', background: bg, flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 26, borderRadius: '50%', background: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <span style={{ fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.text }}>{total}</span>
          <span style={{ fontSize: 11, color: color.textMuted }}>cards</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: color.textMuted }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.c, flexShrink: 0 }} />
            <span style={{ color: color.text, fontWeight: 600, width: 24 }}>{s.value}</span>{s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function VBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: space.sm, height: 140, paddingTop: space.sm }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: color.text }}>{d.value}</span>
          <div style={{ width: '100%', maxWidth: 44, height: `${Math.max(4, (d.value / max) * 100)}%`, background: '#4BCE97', borderRadius: `${radius.base} ${radius.base} 0 0`, transition: 'height .3s', minHeight: 4 }} />
          <span style={{ fontSize: 11, color: color.textMuted }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: space.xl }}><Spinner size={28} /></div>;
  if (isError || !data) return <EmptyState icon={<AlertTriangle size={36} />} title="Could not load dashboard" description="Try again in a moment." />;

  const t = data.totals;
  const buckets = BUCKET_META.map((b) => ({ ...b, value: data.byBucket?.[b.key] ?? 0 }));
  const bucketMax = Math.max(1, ...buckets.map((b) => b.value));
  const boards = (data.byBoard ?? []).map((b) => ({ label: b.name, value: b.count }));
  const boardMax = Math.max(1, ...boards.map((b) => b.value));

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: `${space.xl} ${space.base}`, display: 'flex', flexDirection: 'column', gap: space.lg }}>
      <h1 style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: color.text, margin: 0 }}>Dashboard</h1>

      <div style={{ display: 'flex', gap: space.base, flexWrap: 'wrap' }}>
        <StatCard icon={<ListChecks size={20} />} label="Assigned" value={t.assigned} c="#579DFF" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Completed" value={t.completed} c="#4BCE97" />
        <StatCard icon={<AlertTriangle size={20} />} label="Overdue" value={t.overdue} c="#F87168" />
        <StatCard icon={<CalendarClock size={20} />} label="Due this week" value={t.dueThisWeek} c="#F5CD47" />
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        <h2 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: color.text, margin: 0 }}>Cards by due date</h2>
        <Bars data={buckets} max={bucketMax} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: space.lg }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <h2 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: color.text, margin: 0 }}>Phân bố trạng thái</h2>
          <Donut
            segments={STATUS_META.map((s) => ({ ...s, value: data.byStatus?.[s.key] ?? 0 }))}
            total={STATUS_META.reduce((n, s) => n + (data.byStatus?.[s.key] ?? 0), 0)}
          />
        </Card>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
          <h2 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: color.text, margin: 0 }}>Velocity (hoàn thành / tuần)</h2>
          {(data.velocity ?? []).some((v) => v.value > 0)
            ? <VBars data={data.velocity} />
            : <div style={{ fontSize: 13, color: color.textMuted }}>Chưa có card hoàn thành trong 6 tuần qua.</div>}
        </Card>
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        <h2 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: color.text, margin: 0 }}>Cards by board</h2>
        {boards.length ? <Bars data={boards} max={boardMax} /> : (
          <div style={{ fontSize: 13, color: color.textMuted }}>
            No assigned cards yet. <Link to="/" style={{ color: color.blue }}>Open a board</Link> and assign yourself to cards.
          </div>
        )}
      </Card>
    </div>
  );
}
