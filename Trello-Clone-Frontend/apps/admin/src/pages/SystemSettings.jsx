import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Input, EmptyState, useToast, color, space, font, radius,
} from '@trello/ui';
import { Flag, Gauge, Mail, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { FormSkeleton } from '../components/PageSkeleton';

const FEATURE_LABELS = {
  registration: 'User registration',
  attachments: 'File attachments',
  comments: 'Card comments',
  invites: 'Workspace invites',
};

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.base,
      padding: '10px 12px', borderRadius: radius.base, border: `1px solid ${color.border}`,
      background: color.surface, cursor: 'pointer',
    }}>
      <span style={{ fontSize: 14, color: color.text, fontWeight: 500 }}>{label}</span>
      <span
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        style={{
          width: 40, height: 22, borderRadius: 999, flexShrink: 0, position: 'relative',
          background: checked ? color.blue : color.lightGray, transition: 'background .15s', cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
          background: '#FFFFFF', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }} />
      </span>
    </label>
  );
}

function SectionCard({ Icon, title, description, children }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.base }}>
        <span style={{
          width: 34, height: 34, borderRadius: radius.large, flexShrink: 0,
          background: 'rgba(24,104,219,0.12)', color: color.blue,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={17} /></span>
        <div>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, margin: 0 }}>{title}</h2>
          {description && <p style={{ color: color.textMuted, fontSize: 13, margin: '2px 0 0' }}>{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function SystemSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(null);

  const config = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: async () => (await api.get('/admin/config')).data,
  });

  useEffect(() => {
    if (config.data) setForm(config.data);
  }, [config.data]);

  const save = useMutation({
    mutationFn: (patch) => api.patch('/admin/config', patch),
    onSuccess: (res) => {
      qc.setQueryData(['admin', 'config'], res.data);
      toast.success('Settings saved.');
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to save settings.'),
  });

  if (config.isLoading || (config.data && !form)) {
    return (
      <div>
        <PageHeader title="System Settings" subtitle="Platform-wide configuration" breadcrumb={['Admin', 'System']} />
        <FormSkeleton blocks={3} />
      </div>
    );
  }
  if (config.isError || !form) {
    return (
      <div>
        <PageHeader title="System Settings" subtitle="Platform-wide configuration" breadcrumb={['Admin', 'System']} />
        <Card><EmptyState icon={<AlertTriangle size={36} />} title="Could not load configuration" description="The config endpoint may not be available yet." /></Card>
      </div>
    );
  }

  const features = form.features ?? {};
  const limits = form.limits ?? {};
  const smtp = form.smtp ?? {};

  const setFeature = (k, v) => setForm((f) => ({ ...f, features: { ...f.features, [k]: v } }));
  const setLimit = (k, v) => setForm((f) => ({ ...f, limits: { ...f.limits, [k]: v } }));
  const setSmtp = (k, v) => setForm((f) => ({ ...f, smtp: { ...f.smtp, [k]: v } }));

  const num = (v) => (v === '' || v === undefined || v === null ? undefined : Number(v));

  return (
    <div>
      <PageHeader
        title="System Settings"
        subtitle="Platform-wide configuration"
        breadcrumb={['Admin', 'System']}
        action={<Button loading={save.isPending} onClick={() => save.mutate({
          features,
          limits: { maxUploadMb: num(limits.maxUploadMb), workspaceQuotaMb: num(limits.workspaceQuotaMb) },
          smtp: { host: smtp.host, port: num(smtp.port), user: smtp.user, from: smtp.from },
        })}>Save changes</Button>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg, maxWidth: 720 }}>
        <SectionCard Icon={Flag} title="Feature flags" description="Enable or disable platform features.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
            {Object.keys({ ...FEATURE_LABELS, ...features }).map((k) => (
              <Toggle key={k} label={FEATURE_LABELS[k] ?? k} checked={!!features[k]} onChange={(v) => setFeature(k, v)} />
            ))}
          </div>
        </SectionCard>

        <SectionCard Icon={Gauge} title="Limits" description="Upload and quota constraints.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.base }}>
            <Input label="Max upload size (MB)" type="number" min="0" value={limits.maxUploadMb ?? ''} onChange={(e) => setLimit('maxUploadMb', e.target.value)} />
            <Input label="Workspace quota (MB)" type="number" min="0" value={limits.workspaceQuotaMb ?? ''} onChange={(e) => setLimit('workspaceQuotaMb', e.target.value)} />
          </div>
        </SectionCard>

        <SectionCard Icon={Mail} title="SMTP" description="Outbound email settings. Password is set via environment, never shown here.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.base }}>
            <Input label="Host" placeholder="smtp.example.com" value={smtp.host ?? ''} onChange={(e) => setSmtp('host', e.target.value)} />
            <Input label="Port" type="number" placeholder="587" value={smtp.port ?? ''} onChange={(e) => setSmtp('port', e.target.value)} />
            <Input label="User" placeholder="no-reply@example.com" value={smtp.user ?? ''} onChange={(e) => setSmtp('user', e.target.value)} />
            <Input label="From address" placeholder="Trello <no-reply@example.com>" value={smtp.from ?? ''} onChange={(e) => setSmtp('from', e.target.value)} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
