import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Input, EmptyState, useToast, color, space, font, radius, shadow,
} from '@trello/ui';
import {
  KeyRound, CalendarClock, History, BookOpen, CheckCircle2, XCircle, Loader2,
  AlertTriangle, Trash2, Database, Image as ImageIcon, FileCog, Plug, Clock, ChevronDown, Play,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { FormSkeleton } from '../components/PageSkeleton';

/* ----------------------------------------------------------------- helpers */

const pad = (n) => String(n).padStart(2, '0');
const DOW = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function parseCron(expr) {
  const p = (expr || '').trim().split(/\s+/);
  if (p.length !== 5) return { mode: 'custom', raw: expr, hour: 2, minute: 0, everyN: 6, dow: 1, dom: 1 };
  const [min, hour, dom, , dowF] = p;
  const m = Number(min) || 0;
  if (/^\*\/\d+$/.test(hour) && dom === '*' && dowF === '*') {
    return { mode: 'hourly', everyN: Number(hour.slice(2)) || 1, minute: m, hour: 2, dow: 1, dom: 1, raw: expr };
  }
  const h = Number(hour) || 0;
  if (dowF !== '*') return { mode: 'weekly', hour: h, minute: m, dow: Number(dowF) || 0, dom: 1, everyN: 6, raw: expr };
  if (dom !== '*') return { mode: 'monthly', hour: h, minute: m, dom: Number(dom) || 1, dow: 1, everyN: 6, raw: expr };
  if (/^\d+$/.test(hour)) return { mode: 'daily', hour: h, minute: m, dow: 1, dom: 1, everyN: 6, raw: expr };
  return { mode: 'custom', raw: expr, hour: 2, minute: 0, everyN: 6, dow: 1, dom: 1 };
}

function buildCron(s) {
  if (s.mode === 'custom') return s.raw || '0 2 * * *';
  if (s.mode === 'hourly') return `${s.minute} */${s.everyN} * * *`;
  if (s.mode === 'weekly') return `${s.minute} ${s.hour} * * ${s.dow}`;
  if (s.mode === 'monthly') return `${s.minute} ${s.hour} ${s.dom} * *`;
  return `${s.minute} ${s.hour} * * *`;
}

function describeCron(s) {
  const t = `${pad(s.hour)}:${pad(s.minute)}`;
  if (s.mode === 'hourly') return `Mỗi ${s.everyN} tiếng`;
  if (s.mode === 'weekly') return `Hằng tuần ${DOW[s.dow]} lúc ${t}`;
  if (s.mode === 'monthly') return `Hằng tháng ngày ${s.dom} lúc ${t}`;
  if (s.mode === 'custom') return s.raw || '—';
  return `Hằng ngày lúc ${t}`;
}

const fmtSize = (b) => {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
};
const fmtDate = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const dur = (a, b) => {
  if (!a || !b) return '';
  const sec = Math.max(0, Math.round((new Date(b) - new Date(a)) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m${pad(sec % 60)}s`;
};

const STATUS = {
  success: { Icon: CheckCircle2, c: color.success, t: 'Thành công' },
  failed: { Icon: XCircle, c: color.danger, t: 'Thất bại' },
  running: { Icon: Loader2, c: color.blue, t: 'Đang chạy', spin: true },
  pending: { Icon: Loader2, c: color.textMuted, t: 'Chờ', spin: true },
};

/* ------------------------------------------------------------- small parts */

function Tabs({ tab, setTab, historyCount }) {
  const items = [
    { id: 'connect', label: 'Kết nối', Icon: Plug },
    { id: 'config', label: 'Cấu hình', Icon: CalendarClock },
    { id: 'history', label: 'Lịch sử', Icon: History, badge: historyCount },
    { id: 'guide', label: 'Hướng dẫn', Icon: BookOpen },
  ];
  return (
    <div style={{ display: 'flex', gap: space.xs, background: color.surfaceAlt, padding: 6, borderRadius: radius.large, marginBottom: space.lg, flexWrap: 'wrap' }}>
      {items.map((it) => {
        const on = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: space.sm, padding: '9px 16px',
            border: 'none', borderRadius: radius.base, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: on ? color.surface : 'transparent', color: on ? color.text : color.textMuted,
            boxShadow: on ? shadow.subtle : 'none', transition: 'all .12s',
          }}>
            <it.Icon size={16} />{it.label}
            {it.badge ? <span style={{ marginLeft: 2, fontSize: 12, fontWeight: 700, background: color.primaryBadgeBg, color: color.blue, borderRadius: radius.pill, padding: '1px 7px' }}>{it.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, Icon, accent, children }) {
  return (
    <div style={{ flex: 1, minWidth: 220, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large, padding: space.base }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.xs, fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: accent ?? color.textMuted, marginBottom: 6 }}>
        <Icon size={14} />{label}
      </div>
      {children}
    </div>
  );
}

function ScopeCard({ Icon, title, hint, on, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: space.md, width: '100%', textAlign: 'left',
      padding: space.base, borderRadius: radius.large, cursor: 'pointer', transition: 'all .12s',
      border: `1.5px solid ${on ? color.blue : color.border}`,
      background: on ? color.primaryBadgeBg : color.surface,
    }}>
      <span style={{ width: 36, height: 36, borderRadius: radius.base, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? color.blue : color.surfaceAlt, color: on ? color.white : color.textMuted }}>
        <Icon size={18} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: color.text }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: color.textMuted, fontFamily: font.mono }}>{hint}</span>
      </span>
      <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${on ? color.blue : color.lightGray}`, background: on ? color.blue : 'transparent', color: color.white }}>
        {on ? <CheckCircle2 size={14} /> : null}
      </span>
    </button>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 8px', border: `1px solid ${active ? color.blue : color.border}`, borderRadius: radius.base,
      cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .12s',
      background: active ? color.blue : color.surface, color: active ? color.white : color.textMuted, whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

function SchedulePicker({ sched, setSched }) {
  const upd = (patch) => setSched((s) => ({ ...s, ...patch }));
  const timeVal = `${pad(sched.hour)}:${pad(sched.minute)}`;
  const onTime = (e) => {
    const [h, m] = e.target.value.split(':').map(Number);
    upd({ hour: h || 0, minute: m || 0 });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
      <div style={{ display: 'flex', gap: space.xs, flexWrap: 'wrap' }}>
        <ModeBtn active={sched.mode === 'hourly'} onClick={() => upd({ mode: 'hourly' })}>Mỗi N tiếng</ModeBtn>
        <ModeBtn active={sched.mode === 'daily'} onClick={() => upd({ mode: 'daily' })}>Hằng ngày</ModeBtn>
        <ModeBtn active={sched.mode === 'weekly'} onClick={() => upd({ mode: 'weekly' })}>Hằng tuần</ModeBtn>
        <ModeBtn active={sched.mode === 'monthly'} onClick={() => upd({ mode: 'monthly' })}>Hằng tháng</ModeBtn>
        <ModeBtn active={sched.mode === 'custom'} onClick={() => upd({ mode: 'custom' })}>Tự gõ</ModeBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: space.base }}>
        {sched.mode === 'hourly' && (
          <Input label="Mỗi mấy tiếng" type="number" min="1" max="24" value={sched.everyN} onChange={(e) => upd({ everyN: Number(e.target.value) || 1 })} />
        )}
        {sched.mode === 'weekly' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: color.text }}>
            Thứ
            <select value={sched.dow} onChange={(e) => upd({ dow: Number(e.target.value) })} style={selStyle}>
              {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </label>
        )}
        {sched.mode === 'monthly' && (
          <Input label="Ngày trong tháng" type="number" min="1" max="28" value={sched.dom} onChange={(e) => upd({ dom: Number(e.target.value) || 1 })} />
        )}
        {sched.mode === 'custom' ? (
          <Input label="Cron expression" value={sched.raw ?? ''} onChange={(e) => upd({ raw: e.target.value })} placeholder="0 2 * * *" />
        ) : (
          <Input label="Giờ" type="time" value={timeVal} onChange={onTime} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, padding: '10px 14px', background: color.primaryBadgeBg, border: `1px solid ${color.blue}`, borderRadius: radius.base }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: color.blue }}>→ {describeCron(sched)}</span>
        <code style={{ fontSize: 13, color: color.textMuted, fontFamily: font.mono }}>{buildCron(sched)}</code>
      </div>
      <p style={{ fontSize: 12, color: color.textMuted, margin: 0 }}>Timezone: Asia/Ho_Chi_Minh (GMT+7)</p>
    </div>
  );
}

const selStyle = {
  padding: '9px 10px', border: `1px solid ${color.border}`, borderRadius: radius.base,
  background: color.surface, color: color.text, fontSize: 14, fontFamily: font.text,
};

function SectionCard({ Icon, title, description, children, action }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.base }}>
        <span style={{ width: 34, height: 34, borderRadius: radius.large, flexShrink: 0, background: color.primaryBadgeBg, color: color.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={17} /></span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, margin: 0 }}>{title}</h2>
          {description && <p style={{ color: color.textMuted, fontSize: 13, margin: '2px 0 0' }}>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------- page */

export function BackupPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('config');
  const [form, setForm] = useState(null);
  const [sched, setSched] = useState({ mode: 'daily', hour: 2, minute: 0, everyN: 6, dow: 1, dom: 1, raw: '0 2 * * *' });
  const [advOpen, setAdvOpen] = useState(false);
  const [creds, setCreds] = useState({ clientId: '', clientSecret: '' });

  const settings = useQuery({
    queryKey: ['admin', 'backup', 'settings'],
    queryFn: async () => (await api.get('/admin/backup/settings')).data,
  });
  useEffect(() => {
    if (settings.data) {
      setForm(settings.data);
      setSched(parseCron(settings.data.cronExpr));
    }
  }, [settings.data]);

  const runs = useQuery({
    queryKey: ['admin', 'backup', 'runs'],
    queryFn: async () => (await api.get('/admin/backup/runs', { params: { limit: 20 } })).data,
    refetchInterval: (q) => (q.state.data?.some((r) => ['pending', 'running'].includes(r.status)) ? 4000 : false),
  });

  const save = useMutation({
    mutationFn: (patch) => api.put('/admin/backup/settings', patch),
    onSuccess: (res) => { qc.setQueryData(['admin', 'backup', 'settings'], res.data); toast.success('Đã lưu cấu hình.'); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Lưu thất bại.'),
  });
  const saveCreds = useMutation({
    mutationFn: () => api.put('/admin/backup/gdrive/creds', creds),
    onSuccess: (res) => { qc.setQueryData(['admin', 'backup', 'settings'], res.data); setCreds({ clientId: '', clientSecret: '' }); toast.success('Đã lưu credentials. Bấm Kết nối Google.'); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Lưu credentials thất bại.'),
  });
  const disconnect = useMutation({
    mutationFn: () => api.post('/admin/backup/gdrive/disconnect'),
    onSuccess: (res) => { qc.setQueryData(['admin', 'backup', 'settings'], res.data); toast.success('Đã ngắt kết nối.'); },
  });
  const runNow = useMutation({
    mutationFn: () => api.post('/admin/backup/run'),
    onSuccess: () => { toast.success('Đã bắt đầu backup.'); qc.invalidateQueries({ queryKey: ['admin', 'backup', 'runs'] }); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Không thể bắt đầu backup.'),
  });
  const delRun = useMutation({
    mutationFn: (id) => api.delete(`/admin/backup/runs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'backup', 'runs'] }),
  });

  const connect = async () => {
    try {
      const { data } = await api.get('/admin/backup/gdrive/oauth/start', { params: { origin: window.location.origin } });
      const w = 560, h = 720;
      const x = window.screen.width / 2 - w / 2, y = window.screen.height / 2 - h / 2;
      window.open(data.authUrl, 'gdrive-oauth', `width=${w},height=${h},left=${x},top=${y}`);
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'Nhập Client ID/Secret trước.');
    }
  };
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type !== 'backup-oauth-result') return;
      if (e.data.ok) toast.success(`Đã kết nối: ${e.data.msg}`); else toast.error(e.data.msg);
      qc.invalidateQueries({ queryKey: ['admin', 'backup', 'settings'] });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [qc, toast]);

  if (settings.isLoading || (settings.data && !form)) {
    return (<div><PageHeader title="Backup hệ thống" subtitle="Sao lưu lên Google Drive" breadcrumb={['Admin', 'Backup']} /><FormSkeleton blocks={3} /></div>);
  }
  if (settings.isError || !form) {
    return (<div><PageHeader title="Backup hệ thống" subtitle="Sao lưu lên Google Drive" breadcrumb={['Admin', 'Backup']} /><Card><EmptyState icon={<AlertTriangle size={36} />} title="Không tải được cấu hình backup" description="Endpoint backup có thể chưa được deploy." /></Card></div>);
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const list = runs.data ?? [];
  const last = list[0];
  const scopeCount = [form.scopeDb, form.scopeUploads, form.scopeConfigs].filter(Boolean).length;

  const saveConfig = () => save.mutate({
    enabled: form.enabled, cronExpr: buildCron(sched), retentionCount: Number(form.retentionCount) || 30,
    scopeDb: form.scopeDb, scopeUploads: form.scopeUploads, scopeConfigs: form.scopeConfigs,
    remoteFolder: form.remoteFolder,
  });

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="Backup hệ thống" subtitle="Sao lưu DB + uploads + configs lên Google Drive · auto theo lịch hoặc backup ngay" breadcrumb={['Admin', 'Backup']} />

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: space.base, flexWrap: 'wrap', marginBottom: space.lg }}>
        <SummaryCard label="Kết nối" Icon={form.connected ? CheckCircle2 : XCircle} accent={form.connected ? color.success : color.danger}>
          <div style={{ fontSize: 18, fontWeight: 700, color: color.text }}>{form.connected ? 'OK' : 'Chưa kết nối'}</div>
          <div style={{ fontSize: 12, color: color.textMuted }}>{form.gdriveAccountEmail || 'Vào tab Kết nối'}</div>
        </SummaryCard>
        <SummaryCard label="Lần cuối" Icon={Clock} accent={last ? (STATUS[last.status]?.c) : color.textMuted}>
          <div style={{ fontSize: 18, fontWeight: 700, color: color.text }}>{last ? STATUS[last.status]?.t : '—'}</div>
          <div style={{ fontSize: 12, color: color.textMuted }}>{last ? `${fmtDate(last.startedAt)} · ${fmtSize(last.sizeBytes)} · ${dur(last.startedAt, last.finishedAt)}` : 'Chưa có'}</div>
        </SummaryCard>
        <SummaryCard label={`Auto · ${form.enabled ? 'Bật' : 'Tắt'}`} Icon={CalendarClock} accent={form.enabled ? color.blue : color.textMuted}>
          <div style={{ fontSize: 18, fontWeight: 700, color: color.text }}>{describeCron(sched)}</div>
          <div style={{ fontSize: 12, color: color.textMuted }}>Giữ {form.retentionCount} bản</div>
        </SummaryCard>
        <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 200 }}>
          <Button loading={runNow.isPending} disabled={!form.connected} onClick={() => runNow.mutate()} style={{ width: '100%', fontSize: 15 }}>
            <Play size={18} style={{ marginRight: 8 }} /> Backup ngay
          </Button>
        </div>
      </div>

      <Tabs tab={tab} setTab={setTab} historyCount={list.length} />

      {/* ----------------------------------------------------------- CONNECT */}
      {tab === 'connect' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
          <SectionCard Icon={KeyRound} title="Kết nối Google Drive" description="Dán OAuth Client ID + Secret từ Google Cloud rồi bấm Kết nối."
            action={form.connected ? <Button variant="secondary" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>Ngắt kết nối</Button> : null}>
            {form.connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, fontSize: 14, color: color.text }}>
                <CheckCircle2 size={18} color={color.success} /> Đã kết nối: <strong>{form.gdriveAccountEmail}</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.base, maxWidth: 720 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: space.base }}>
                  <Input label="Client ID" value={creds.clientId} onChange={(e) => setCreds((c) => ({ ...c, clientId: e.target.value }))} placeholder="...apps.googleusercontent.com" />
                  <Input label="Client Secret" type="password" value={creds.clientSecret} onChange={(e) => setCreds((c) => ({ ...c, clientSecret: e.target.value }))} placeholder="GOCSPX-..." />
                </div>
                <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
                  <Button variant="secondary" loading={saveCreds.isPending} disabled={!creds.clientId || !creds.clientSecret} onClick={() => saveCreds.mutate()}>Lưu credentials</Button>
                  <Button onClick={connect}>Kết nối Google</Button>
                </div>
                <p style={{ fontSize: 12, color: color.textMuted, margin: 0 }}>
                  Redirect URI đăng ký trong Google Cloud:&nbsp;
                  <code style={{ fontFamily: font.mono }}>{`${window.location.origin.replace(/\/$/, '')}`}/api/backup/oauth/callback</code>
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ------------------------------------------------------------ CONFIG */}
      {tab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
          {/* big toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: space.base, padding: space.lg, borderRadius: radius.large, border: `1.5px solid ${form.enabled ? color.blue : color.border}`, background: form.enabled ? color.primaryBadgeBg : color.surface }}>
            <span style={{ width: 44, height: 44, borderRadius: radius.large, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: form.enabled ? color.blue : color.surfaceAlt, color: form.enabled ? color.white : color.textMuted }}>
              <CheckCircle2 size={22} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                <h3 style={{ margin: 0, fontFamily: font.display, fontSize: 17, fontWeight: 800, color: color.text }}>Auto backup {form.enabled ? 'BẬT' : 'TẮT'}</h3>
                {settings.data?.enabled && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: color.success, background: color.successBg, borderRadius: radius.pill, padding: '2px 8px' }}>SCHEDULER ACTIVE</span>}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: color.textMuted }}>Chạy tự động: <strong style={{ color: color.text }}>{describeCron(sched)}</strong></p>
            </div>
            <span onClick={() => set('enabled', !form.enabled)} style={{ width: 52, height: 28, borderRadius: 999, flexShrink: 0, position: 'relative', cursor: 'pointer', background: form.enabled ? color.blue : color.lightGray, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: form.enabled ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
            </span>
          </div>

          {/* two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: space.lg, alignItems: 'start' }}>
            <SectionCard Icon={Clock} title="Lịch chạy">
              <SchedulePicker sched={sched} setSched={setSched} />
            </SectionCard>

            <SectionCard Icon={Database} title="Backup gì" action={<span style={{ fontSize: 12, color: color.textMuted, fontWeight: 600 }}>{scopeCount}/3 chọn</span>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                <ScopeCard Icon={Database} title="Postgres DB" hint="pg_dump --clean --if-exists | gzip" on={!!form.scopeDb} onToggle={() => set('scopeDb', !form.scopeDb)} />
                <ScopeCard Icon={ImageIcon} title="MinIO uploads" hint="avatars, attachments, covers" on={!!form.scopeUploads} onToggle={() => set('scopeUploads', !form.scopeUploads)} />
                <ScopeCard Icon={FileCog} title="App config" hint="bảng settings (cấu hình hệ thống)" on={!!form.scopeConfigs} onToggle={() => set('scopeConfigs', !form.scopeConfigs)} />
              </div>
            </SectionCard>
          </div>

          {/* advanced */}
          <Card>
            <button onClick={() => setAdvOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ width: 34, height: 34, borderRadius: radius.large, flexShrink: 0, background: color.surfaceAlt, color: color.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FileCog size={17} /></span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, margin: 0 }}>Cài đặt nâng cao</h2>
                <p style={{ color: color.textMuted, fontSize: 13, margin: '2px 0 0' }}>Retention {form.retentionCount} bản · Drive: {form.remoteFolder}</p>
              </div>
              <ChevronDown size={18} color={color.textMuted} style={{ transform: advOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {advOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.base, marginTop: space.base }}>
                <Input label="Giữ lại N bản gần nhất" type="number" min="1" value={form.retentionCount ?? ''} onChange={(e) => set('retentionCount', e.target.value)} />
                <Input label="Thư mục trên Drive" value={form.remoteFolder ?? ''} onChange={(e) => set('remoteFolder', e.target.value)} />
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button loading={save.isPending} onClick={saveConfig}>Lưu cấu hình</Button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- HISTORY */}
      {tab === 'history' && (
        <SectionCard Icon={History} title="Lịch sử backup" description={`${list.length} lần chạy gần nhất.`}>
          {list.length === 0 ? (
            <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>Chưa có backup nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map((r) => {
                const st = STATUS[r.status] ?? STATUS.pending;
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: space.sm, padding: '10px 14px', border: `1px solid ${color.border}`, borderRadius: radius.base, background: color.surface }}>
                    <st.Icon size={16} color={st.c} style={st.spin ? { animation: 'spin 1s linear infinite' } : undefined} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: st.c, width: 84 }}>{st.t}</span>
                    <span style={{ fontSize: 13, color: color.text, flex: 1 }}>{fmtDate(r.startedAt)} · {r.kind === 'manual' ? 'thủ công' : 'tự động'}</span>
                    <span style={{ fontSize: 12, color: color.textMuted, width: 70, textAlign: 'right' }}>{fmtSize(r.sizeBytes)}</span>
                    <span style={{ fontSize: 12, color: color.textMuted, width: 56, textAlign: 'right' }}>{dur(r.startedAt, r.finishedAt)}</span>
                    {r.error ? <span title={r.error} style={{ fontSize: 12, color: color.danger, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error}</span> : null}
                    <button onClick={() => delRun.mutate(r.id)} title="Xoá" style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textMuted, display: 'inline-flex' }}><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ------------------------------------------------------------- GUIDE */}
      {tab === 'guide' && (
        <SectionCard Icon={BookOpen} title="Hướng dẫn kết nối Google Drive">
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: space.sm, fontSize: 14, color: color.text, lineHeight: 1.55 }}>
            <li>Tạo project tại <code style={mono}>console.cloud.google.com</code> → Enable <strong>Google Drive API</strong>.</li>
            <li>OAuth consent screen: User type <strong>External</strong>, thêm email vào <strong>Test users</strong>.</li>
            <li>Data Access → thêm scope <code style={mono}>https://www.googleapis.com/auth/drive</code> (sensitive scope).</li>
            <li>Credentials → OAuth client ID → <strong>Web application</strong>. Authorized redirect URI:
              <div style={{ marginTop: 6 }}><code style={mono}>{`${window.location.origin.replace(/\/$/, '')}`}/api/backup/oauth/callback</code></div>
            </li>
            <li>Copy Client ID + Secret → tab <strong>Kết nối</strong> → Lưu → <strong>Kết nối Google</strong> → tick Drive → Allow.</li>
            <li>Vào <strong>Cấu hình</strong>: bật Auto, chọn lịch + scope → Lưu. Hoặc bấm <strong>Backup ngay</strong> để test.</li>
          </ol>
          <div style={{ marginTop: space.base, padding: space.base, background: color.surfaceAlt, borderRadius: radius.base, fontSize: 13, color: color.textMuted }}>
            <strong style={{ color: color.text }}>Lưu ý:</strong> Testing mode → refresh token hết hạn sau 7 ngày, Publish app để vĩnh viễn. Nếu lỗi <code style={mono}>403 access_denied</code> → email chưa thêm Test users.
          </div>
        </SectionCard>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const mono = { fontFamily: font.mono, background: color.surfaceAlt, padding: '1px 6px', borderRadius: radius.base, fontSize: 13 };
