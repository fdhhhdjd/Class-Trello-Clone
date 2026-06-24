import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Tooltip, useToast, color, space, font, radius } from '@trello/ui';
import { Download, ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { Table, Pagination } from '../components/Table';
import { usePagination } from '../lib/usePagination';

const EMPTY = { actor: '', action: '', from: '', to: '' };

function toParams(f, page, pageSize) {
  return {
    actor: f.actor || undefined,
    action: f.action || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    page,
    pageSize,
  };
}

function metaText(m) {
  if (!m) return '';
  if (typeof m === 'string') return m;
  try { return JSON.stringify(m); } catch { return String(m); }
}

function toCsv(rows) {
  const head = ['id', 'actor', 'action', 'target', 'ip', 'metadata', 'createdAt'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.id, r.actorEmail ?? r.actorId, r.action, r.targetId, r.ipAddress, metaText(r.metadata), r.createdAt].map(esc).join(',')
  );
  return [head.join(','), ...lines].join('\n');
}

export function AuditPage() {
  const toast = useToast();
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const { page, setPage, pageSize, setPageSize, reset: resetPage } = usePagination('audit', 50);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['admin', 'audit', applied, page, pageSize],
    queryFn: async () => {
      const res = await api.get('/admin/audit', { params: toParams(applied, page, pageSize) });
      return Array.isArray(res.data) ? { data: res.data, total: res.data.length } : res.data;
    },
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const apply = () => { setApplied(draft); resetPage(); };
  const reset = () => { setDraft(EMPTY); setApplied(EMPTY); resetPage(); };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows.`);
  };

  const columns = [
    {
      key: 'createdAt', header: 'Time', width: 170,
      render: (r) => r.createdAt
        ? <span style={{ color: color.text }}>{new Date(r.createdAt).toLocaleString()}</span>
        : '—',
    },
    { key: 'actor', header: 'Actor', render: (r) => <span style={{ fontWeight: 500 }}>{r.actorEmail ?? r.actorId ?? '—'}</span> },
    {
      key: 'action', header: 'Action',
      render: (r) => (
        <span style={{
          fontFamily: font.mono, fontSize: 12, background: color.surfaceAlt,
          padding: '2px 8px', borderRadius: radius.base, color: color.text,
        }}>{r.action}</span>
      ),
    },
    { key: 'targetId', header: 'Target', render: (r) => <span style={{ color: color.textMuted }}>{r.targetId ?? '—'}</span> },
    { key: 'ipAddress', header: 'IP', width: 130, render: (r) => <span style={{ fontFamily: font.mono, fontSize: 12, color: color.textMuted }}>{r.ipAddress ?? '—'}</span> },
    {
      key: 'metadata', header: 'Metadata',
      render: (r) => {
        const t = metaText(r.metadata);
        if (!t) return <span style={{ color: color.mediumGray }}>—</span>;
        const short = t.length > 40 ? `${t.slice(0, 40)}…` : t;
        return (
          <Tooltip label={t}>
            <span style={{ fontFamily: font.mono, fontSize: 12, color: color.textMuted, cursor: 'help' }}>{short}</span>
          </Tooltip>
        );
      },
    },
  ];

  const field = { display: 'flex', flexDirection: 'column', gap: 4 };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: color.textMuted, fontFamily: font.text };

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Sensitive actions and access decisions"
        breadcrumb={['Admin', 'Audit Log']}
        action={
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}
            leftIcon={<Download size={16} />}>Export CSV</Button>
        }
      />

      <div style={{
        display: 'flex', gap: space.base, flexWrap: 'wrap', alignItems: 'flex-end',
        marginBottom: space.base, background: color.surface, padding: space.base,
        border: `1px solid ${color.border}`, borderRadius: radius.large,
      }}>
        <div style={field}>
          <label style={labelStyle}>Actor</label>
          <Input style={{ width: 200 }} placeholder="email or id"
            value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && apply()} />
        </div>
        <div style={field}>
          <label style={labelStyle}>Action</label>
          <Input style={{ width: 200 }} placeholder="e.g. users.suspend"
            value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && apply()} />
        </div>
        <div style={field}>
          <label style={labelStyle}>From</label>
          <Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div style={field}>
          <label style={labelStyle}>To</label>
          <Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <Button onClick={apply}>Apply filters</Button>
        <Button variant="ghost" onClick={reset}>Reset</Button>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading}
        fetching={isFetching}
        onRetry={refetch}
        error={isError ? 'Failed to load audit log. The endpoint may not be available yet.' : null}
        empty="No audit entries"
        emptyDescription="No records match the current filters."
        emptyIcon={<ScrollText size={36} />}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
    </div>
  );
}
