import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Card, Button, Input, Textarea, Spinner, EmptyState, useToast, useConfirm,
  color, space, font, radius,
} from '@trello/ui';
import {
  Megaphone, Tag, Sparkles, ShieldCheck, LayoutGrid, ListOrdered, CreditCard,
  HelpCircle, PanelBottom, Plus, Trash2, ArrowUp, ArrowDown, Upload, X, Image as ImageIcon,
  AlertTriangle, QrCode,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/Layout';
import { FormSkeleton } from '../components/PageSkeleton';

const EMPTY = {
  brand: { name: '' },
  chatbot: { enabled: true, title: '', subtitle: '', botName: '', qrImage: '' },
  hero: { eyebrow: '', title: '', subtitle: '', primaryCtaLabel: '', secondaryCtaLabel: '', image: '' },
  trust: { logos: [] },
  features: [],
  steps: [],
  pricing: [],
  faq: [],
  footer: { tagline: '', copyright: '' },
};

// Merge fetched content over EMPTY so missing keys never crash the editor.
function normalize(c) {
  if (!c) return EMPTY;
  return {
    brand: { ...EMPTY.brand, ...(c.brand ?? {}) },
    chatbot: { ...EMPTY.chatbot, ...(c.chatbot ?? {}) },
    hero: { ...EMPTY.hero, ...(c.hero ?? {}) },
    trust: { logos: Array.isArray(c.trust?.logos) ? c.trust.logos : [] },
    features: Array.isArray(c.features) ? c.features : [],
    steps: Array.isArray(c.steps) ? c.steps : [],
    pricing: Array.isArray(c.pricing) ? c.pricing : [],
    faq: Array.isArray(c.faq) ? c.faq : [],
    footer: { ...EMPTY.footer, ...(c.footer ?? {}) },
  };
}

function SectionCard({ Icon, title, description, action, children }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.base }}>
        <span style={{
          width: 34, height: 34, borderRadius: radius.large, flexShrink: 0,
          background: 'rgba(24,104,219,0.12)', color: color.blue,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={17} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: font.display, fontSize: 16, fontWeight: 700, color: color.text, margin: 0 }}>{title}</h2>
          {description && <p style={{ color: color.textMuted, fontSize: 13, margin: '2px 0 0' }}>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: space.sm, cursor: 'pointer' }}>
      <span
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        style={{
          width: 40, height: 22, borderRadius: 999, flexShrink: 0, position: 'relative',
          background: checked ? color.blue : color.lightGray, transition: 'background .15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
          background: '#FFFFFF', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }} />
      </span>
      <span style={{ fontSize: 14, color: color.text, fontWeight: 500 }}>{label}</span>
    </label>
  );
}

// Reusable editable list of plain strings.
function StringListField({ label, items, onChange, placeholder = '' }) {
  const set = (i, v) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const add = () => onChange([...items, '']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      {label && <span style={{ fontSize: 13, fontWeight: 600, color: color.darkGray }}>{label}</span>}
      {items.length === 0 && (
        <span style={{ fontSize: 13, color: color.textMuted }}>None yet.</span>
      )}
      {items.map((val, i) => (
        <div key={i} style={{ display: 'flex', gap: space.sm, alignItems: 'center' }}>
          <Input wrapStyle={{ flex: 1 }} value={val} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Remove" style={{ color: color.danger, padding: '8px' }}>
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" leftIcon={<Plus size={15} />} onClick={add}>Add</Button>
      </div>
    </div>
  );
}

// Reusable image upload field using the presigned-URL flow.
function ImageUploadField({ value, onChange }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await api.post('/admin/landing/image', {
        filename: file.name, contentType: file.type,
      });
      await axios.put(data.uploadUrl, file, { headers: { 'Content-Type': file.type } });
      onChange(data.fileUrl);
      toast.success('Image uploaded.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '16 / 9',
        borderRadius: radius.large, border: `1px dashed ${color.border}`, background: color.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {value ? (
          <img src={value} alt="Hero preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.xs, color: color.textMuted }}>
            <ImageIcon size={28} />
            <span style={{ fontSize: 13 }}>No image</span>
          </span>
        )}
        {uploading && (
          <span style={{
            position: 'absolute', inset: 0, background: 'rgba(9,30,66,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Spinner size={26} color="#FFFFFF" /></span>
        )}
      </div>
      <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" leftIcon={<Upload size={15} />} loading={uploading} onClick={pick}>
          {value ? 'Replace' : 'Upload'}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" leftIcon={<X size={15} />} onClick={() => onChange('')} style={{ color: color.danger }}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

// Generic repeatable item list with add/remove/reorder, rendered via renderItem.
function ItemList({ items, onChange, makeEmpty, renderItem, addLabel = 'Add item', emptyText = 'None yet.' }) {
  const update = (i, patch) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
      {items.length === 0 && <span style={{ fontSize: 13, color: color.textMuted }}>{emptyText}</span>}
      {items.map((item, i) => (
        <div key={i} style={{
          border: `1px solid ${color.border}`, borderRadius: radius.large,
          padding: space.base, background: color.surfaceAlt,
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: space.sm }}>
            <Button variant="ghost" size="sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} style={{ padding: 6 }}><ArrowUp size={15} /></Button>
            <Button variant="ghost" size="sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} style={{ padding: 6 }}><ArrowDown size={15} /></Button>
            <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(i)} style={{ padding: 6, color: color.danger }}><Trash2 size={15} /></Button>
          </div>
          {renderItem(item, (patch) => update(i, patch))}
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" leftIcon={<Plus size={15} />} onClick={() => onChange([...items, makeEmpty()])}>{addLabel}</Button>
      </div>
    </div>
  );
}

const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: space.base };

export function LandingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);

  const content = useQuery({
    queryKey: ['admin', 'landing'],
    queryFn: async () => (await api.get('/admin/landing')).data,
    // Don't refetch on window focus — it would wipe unsaved edits (e.g. after the
    // file picker closes during an image upload).
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (content.data && !dirty) setForm(normalize(content.data));
  }, [content.data, dirty]);

  const save = useMutation({
    mutationFn: (c) => api.patch('/admin/landing', { content: c }),
    onSuccess: (res) => {
      const saved = normalize(res.data);
      qc.setQueryData(['admin', 'landing'], res.data);
      setForm(saved);
      setDirty(false);
      toast.success('Landing page saved.');
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to save landing page.'),
  });

  // Patch helpers — every change flips dirty.
  const patch = (updater) => { setForm(updater); setDirty(true); };
  const setBrand = (k, v) => patch((f) => ({ ...f, brand: { ...f.brand, [k]: v } }));
  const setHero = (k, v) => patch((f) => ({ ...f, hero: { ...f.hero, [k]: v } }));
  const setChatbot = (k, v) => patch((f) => ({ ...f, chatbot: { ...f.chatbot, [k]: v } }));
  const setFooter = (k, v) => patch((f) => ({ ...f, footer: { ...f.footer, [k]: v } }));
  const setList = (k, v) => patch((f) => ({ ...f, [k]: v }));

  const onDiscard = async () => {
    const ok = await confirm({
      title: 'Discard changes?',
      message: 'Unsaved changes to the landing page will be lost.',
      confirmText: 'Discard', danger: true,
    });
    if (!ok) return;
    setForm(normalize(content.data));
    setDirty(false);
  };

  const header = (
    <PageHeader
      title="Landing Page"
      subtitle="Edit the public marketing site content"
      breadcrumb={['Admin', 'Landing Page']}
    />
  );

  if (content.isLoading || (content.data && !form)) {
    return <div>{header}<FormSkeleton blocks={3} /></div>;
  }
  if (content.isError && !form) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            icon={<AlertTriangle size={36} />}
            title="Could not load landing content"
            description="The landing endpoint may not be available yet."
            action={<Button variant="secondary" onClick={() => content.refetch()}>Retry</Button>}
          />
        </Card>
      </div>
    );
  }

  const f = form ?? EMPTY;

  return (
    <div>
      {header}
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg, maxWidth: 1200, paddingBottom: 96 }}>
        <SectionCard Icon={Tag} title="Brand" description="Product name shown across the site.">
          <Input label="Brand name" value={f.brand.name} onChange={(e) => setBrand('name', e.target.value)} placeholder="Trello" />
        </SectionCard>

        <SectionCard Icon={Sparkles} title="Hero" description="The top banner: headline, subheadline, CTAs and image.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
            <Input label="Eyebrow" value={f.hero.eyebrow} onChange={(e) => setHero('eyebrow', e.target.value)} placeholder="Trusted by teams worldwide" />
            <Input label="Title" value={f.hero.title} onChange={(e) => setHero('title', e.target.value)} placeholder="Manage work, your way" />
            <Textarea label="Subtitle" value={f.hero.subtitle} onChange={(e) => setHero('subtitle', e.target.value)} placeholder="Boards, lists and cards..." />
            <div style={grid2}>
              <Input label="Primary CTA label" value={f.hero.primaryCtaLabel} onChange={(e) => setHero('primaryCtaLabel', e.target.value)} placeholder="Get started" />
              <Input label="Secondary CTA label" value={f.hero.secondaryCtaLabel} onChange={(e) => setHero('secondaryCtaLabel', e.target.value)} placeholder="Learn more" />
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: color.darkGray, display: 'block', marginBottom: space.sm }}>Hero image</span>
              <ImageUploadField value={f.hero.image} onChange={(v) => setHero('image', v)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard Icon={QrCode} title="Chatbot Zalo" description="Khối QR chat bot trên landing. Upload ảnh QR, sửa tiêu đề / tên bot, hoặc ẩn đi."
          action={<Toggle checked={f.chatbot.enabled !== false} onChange={(v) => setChatbot('enabled', v)} label="Hiện" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
            <Input label="Tiêu đề" value={f.chatbot.title} onChange={(e) => setChatbot('title', e.target.value)} placeholder="Hỏi đáp nhanh với Trợ lý AI trên Zalo" />
            <Textarea label="Mô tả" value={f.chatbot.subtitle} onChange={(e) => setChatbot('subtitle', e.target.value)} placeholder="Quét mã QR để chat với bot…" />
            <Input label="Tên bot" value={f.chatbot.botName} onChange={(e) => setChatbot('botName', e.target.value)} placeholder="Bot Code Web Không Khó" />
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: color.darkGray, display: 'block', marginBottom: space.sm }}>Ảnh QR (để trống = dùng ảnh mặc định)</span>
              <ImageUploadField value={f.chatbot.qrImage} onChange={(v) => setChatbot('qrImage', v)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard Icon={ShieldCheck} title="Trust logos" description="Company / brand names shown in the trust strip.">
          <StringListField items={f.trust.logos} placeholder="Company name" onChange={(v) => patch((s) => ({ ...s, trust: { ...s.trust, logos: v } }))} />
        </SectionCard>

        <SectionCard Icon={LayoutGrid} title="Features" description="Highlight cards. Icon is a lucide icon name (e.g. Zap).">
          <ItemList
            items={f.features}
            onChange={(v) => setList('features', v)}
            makeEmpty={() => ({ icon: '', title: '', desc: '' })}
            addLabel="Add feature"
            renderItem={(item, set) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                <Input label="Icon (lucide name)" value={item.icon} onChange={(e) => set({ icon: e.target.value })} placeholder="Zap" />
                <Input label="Title" value={item.title} onChange={(e) => set({ title: e.target.value })} />
                <Textarea label="Description" value={item.desc} onChange={(e) => set({ desc: e.target.value })} />
              </div>
            )}
          />
        </SectionCard>

        <SectionCard Icon={ListOrdered} title="Steps" description="How it works, step by step.">
          <ItemList
            items={f.steps}
            onChange={(v) => setList('steps', v)}
            makeEmpty={() => ({ title: '', desc: '' })}
            addLabel="Add step"
            renderItem={(item, set) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                <Input label="Title" value={item.title} onChange={(e) => set({ title: e.target.value })} />
                <Textarea label="Description" value={item.desc} onChange={(e) => set({ desc: e.target.value })} />
              </div>
            )}
          />
        </SectionCard>

        <SectionCard Icon={CreditCard} title="Pricing" description="Pricing tiers.">
          <ItemList
            items={f.pricing}
            onChange={(v) => setList('pricing', v)}
            makeEmpty={() => ({ name: '', price: '', period: '', features: [], recommended: false, ctaLabel: '' })}
            addLabel="Add tier"
            renderItem={(item, set) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
                <div style={grid2}>
                  <Input label="Name" value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="Free" />
                  <Input label="Price" value={item.price} onChange={(e) => set({ price: e.target.value })} placeholder="$0" />
                  <Input label="Period" value={item.period} onChange={(e) => set({ period: e.target.value })} placeholder="per month" />
                  <Input label="CTA label" value={item.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder="Start free" />
                </div>
                <StringListField label="Tier features" items={Array.isArray(item.features) ? item.features : []} placeholder="Unlimited cards" onChange={(v) => set({ features: v })} />
                <Toggle label="Recommended" checked={!!item.recommended} onChange={(v) => set({ recommended: v })} />
              </div>
            )}
          />
        </SectionCard>

        <SectionCard Icon={HelpCircle} title="FAQ" description="Frequently asked questions.">
          <ItemList
            items={f.faq}
            onChange={(v) => setList('faq', v)}
            makeEmpty={() => ({ q: '', a: '' })}
            addLabel="Add question"
            renderItem={(item, set) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                <Input label="Question" value={item.q} onChange={(e) => set({ q: e.target.value })} />
                <Textarea label="Answer" value={item.a} onChange={(e) => set({ a: e.target.value })} />
              </div>
            )}
          />
        </SectionCard>

        <SectionCard Icon={PanelBottom} title="Footer" description="Footer tagline and copyright line.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
            <Input label="Tagline" value={f.footer.tagline} onChange={(e) => setFooter('tagline', e.target.value)} />
            <Input label="Copyright" value={f.footer.copyright} onChange={(e) => setFooter('copyright', e.target.value)} placeholder="© 2026 Trello Clone" />
          </div>
        </SectionCard>
      </div>

      {/* Sticky save bar */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0, marginTop: space.lg,
        background: color.surface, borderTop: `1px solid ${color.border}`,
        padding: `${space.md} ${space.base}`, display: 'flex', alignItems: 'center',
        justifyContent: 'flex-end', gap: space.sm, zIndex: 20,
        boxShadow: 'rgba(9,30,66,0.13) 0px -1px 4px 0px',
      }}>
        <span style={{ marginRight: 'auto', fontSize: 13, color: dirty ? color.text : color.textMuted }}>
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <Button variant="secondary" disabled={!dirty || save.isPending} onClick={onDiscard}>Discard</Button>
        <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(f)}>Save changes</Button>
      </div>
    </div>
  );
}
