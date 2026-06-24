import { useQuery } from '@tanstack/react-query';
import { Card, Badge, color, space, font, radius } from '@trello/ui';
import {
  Server, Database, Zap, HardDrive, Users, KanbanSquare, LayoutDashboard, Layers, MessageSquare, Wifi, Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { CardGridSkeleton } from '../components/PageSkeleton';

const SERVICES = [
  { key: 'api', label: 'API', Icon: Server },
  { key: 'db', label: 'Database', Icon: Database },
  { key: 'redis', label: 'Redis', Icon: Zap },
  { key: 'minio', label: 'Object Storage', Icon: HardDrive },
];

const COUNTS = [
  { key: 'users', label: 'Users', Icon: Users },
  { key: 'workspaces', label: 'Workspaces', Icon: KanbanSquare },
  { key: 'boards', label: 'Boards', Icon: LayoutDashboard },
  { key: 'cards', label: 'Cards', Icon: Layers },
  { key: 'comments', label: 'Comments', Icon: MessageSquare },
];

function isUp(v) {
  return v === true || v === 'up' || v === 'ok';
}

function fmtUptime(sec) {
  if (sec === undefined || sec === null) return '—';
  const s = Math.floor(sec);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function ServiceCard({ label, Icon, up }) {
  return (
    <Card style={{ padding: space.base }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
        <span style={{
          width: 40, height: 40, borderRadius: radius.large, flexShrink: 0,
          background: color.surfaceAlt, color: color.textMuted,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: color.text, fontSize: 14 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: up ? color.success : color.danger,
              boxShadow: `0 0 0 3px ${up ? 'rgba(76,107,31,0.15)' : 'rgba(201,55,44,0.15)'}`,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: up ? color.success : color.danger }}>
              {up ? 'Operational' : 'Down'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CountTile({ Icon, label, value }) {
  return (
    <Card style={{ padding: space.base }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
        <span style={{
          width: 34, height: 34, borderRadius: radius.large, flexShrink: 0,
          background: 'rgba(24,104,219,0.12)', color: color.blue,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={17} /></span>
        <div>
          <div style={{ color: color.textMuted, fontSize: 12 }}>{label}</div>
          <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, color: color.text, lineHeight: 1.1 }}>
            {value === undefined || value === null ? '—' : Number(value).toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MonitoringPage() {
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => (await api.get('/admin/health')).data,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const services = data?.services ?? {};
  const counts = data?.counts ?? {};

  return (
    <div>
      <PageHeader
        title="Monitoring"
        breadcrumb={['Admin', 'Monitoring']}
        subtitle="Live service health, refreshed every 10s"
        action={
          <Badge kind={isError ? 'error' : 'success'}>
            {isFetching ? 'Refreshing…' : isError ? 'Unreachable' : 'Live'}
          </Badge>
        }
      />

      {isError && (
        <div style={{
          background: color.errorBg, border: `1px solid ${color.danger}`, color: color.danger,
          borderRadius: radius.base, padding: '10px 14px', fontSize: 14, marginBottom: space.base,
        }}>
          Health endpoint unreachable. It may not be available yet.
        </div>
      )}

      {isLoading ? (
        <>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, marginBottom: space.md }}>Services</h2>
          <div style={{ marginBottom: space.lg }}><CardGridSkeleton count={4} minWidth={220} height={28} /></div>
          <div style={{ marginBottom: space.lg }}><CardGridSkeleton count={2} minWidth={220} height={28} /></div>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, marginBottom: space.md }}>Totals</h2>
          <CardGridSkeleton count={5} minWidth={180} height={24} />
        </>
      ) : (
        <>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, marginBottom: space.md }}>Services</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.base, marginBottom: space.lg }}>
            {SERVICES.map((s) => (
              <ServiceCard key={s.key} label={s.label} Icon={s.Icon} up={isUp(services[s.key])} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.base, marginBottom: space.lg }}>
            <Card style={{ padding: space.base }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                <span style={{
                  width: 34, height: 34, borderRadius: radius.large, flexShrink: 0,
                  background: color.successBg, color: color.success,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}><Wifi size={17} /></span>
                <div>
                  <div style={{ color: color.textMuted, fontSize: 12 }}>Online users</div>
                  <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, color: color.text, lineHeight: 1.1 }}>
                    {data?.onlineUsers ?? 0}
                  </div>
                </div>
              </div>
            </Card>
            <Card style={{ padding: space.base }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                <span style={{
                  width: 34, height: 34, borderRadius: radius.large, flexShrink: 0,
                  background: 'rgba(168,85,247,0.14)', color: color.purple,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}><Clock size={17} /></span>
                <div>
                  <div style={{ color: color.textMuted, fontSize: 12 }}>Uptime</div>
                  <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, color: color.text, lineHeight: 1.1 }}>
                    {fmtUptime(data?.uptimeSec)}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {(data?.queues ?? []).length > 0 && (
            <>
              <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, marginBottom: space.md }}>Background queues</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.base, marginBottom: space.lg }}>
                {data.queues.map((q) => (
                  <Card key={q.name} style={{ padding: space.base }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
                      <span style={{ fontWeight: 700, color: color.text, fontSize: 14, textTransform: 'capitalize' }}>{q.name}</span>
                      {q.failed > 0 ? <Badge kind="error">{q.failed} failed</Badge> : <Badge kind="success">healthy</Badge>}
                    </div>
                    <div style={{ display: 'flex', gap: space.base, flexWrap: 'wrap', fontSize: 12, color: color.textMuted }}>
                      <span><strong style={{ color: color.text }}>{q.active ?? 0}</strong> active</span>
                      <span><strong style={{ color: color.text }}>{q.waiting ?? 0}</strong> waiting</span>
                      <span><strong style={{ color: color.text }}>{q.delayed ?? 0}</strong> delayed</span>
                      <span><strong style={{ color: color.text }}>{q.completed ?? 0}</strong> done</span>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, marginBottom: space.md }}>Totals</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: space.base }}>
            {COUNTS.map((c) => <CountTile key={c.key} Icon={c.Icon} label={c.label} value={counts[c.key]} />)}
          </div>
        </>
      )}
    </div>
  );
}
