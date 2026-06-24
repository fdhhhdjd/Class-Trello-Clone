import { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Search, Link as LinkIcon, Copy, Trash2, UploadCloud } from 'lucide-react';
import {
  Modal, Button, Select, Avatar, Badge, Spinner, IconButton, useToast,
  color, font, space, radius, shadow, focusRing,
} from '@trello/ui';
import { api } from '../lib/api';

function InviteLinks({ workspaceId }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [role, setRole] = useState('ws_member');
  const linksQ = useQuery({
    queryKey: ['ws-invites', workspaceId],
    queryFn: async () => (await api.get(`/workspaces/${workspaceId}/invites`)).data,
    enabled: !!workspaceId,
  });
  const create = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/invites`, { role }),
    onSuccess: () => { toast.success('Invite link created.'); qc.invalidateQueries({ queryKey: ['ws-invites', workspaceId] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not create link.'),
  });
  const revoke = useMutation({
    mutationFn: (token) => api.delete(`/workspaces/${workspaceId}/invites/${token}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws-invites', workspaceId] }),
  });
  const urlFor = (t) => `${window.location.origin}/invite/${t}`;
  const copy = (t) => navigator.clipboard?.writeText(urlFor(t)).then(() => toast.success('Link copied.'), () => {});
  const links = linksQ.data ?? [];

  return (
    <div style={{ marginBottom: space.lg, padding: space.md, border: `1px solid ${color.border}`, borderRadius: radius.large }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
        <LinkIcon size={16} color={color.blue} />
        <strong style={{ fontSize: 14, color: color.text }}>Invite links</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: space.sm }}>
          <Select value={role} onChange={(e) => setRole(e.target.value)} style={{ minHeight: 34 }}>
            <option value="ws_member">Member</option>
            <option value="ws_admin">Admin</option>
            <option value="ws_guest">Guest</option>
          </Select>
          <Button size="sm" loading={create.isPending} onClick={() => create.mutate()}>Create link</Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {links.map((l) => (
          <div key={l.token} style={{ display: 'flex', alignItems: 'center', gap: space.sm, fontSize: 13 }}>
            <code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: color.textMuted, fontFamily: font.mono }}>{urlFor(l.token)}</code>
            <Badge>{l.role.replace('ws_', '')}</Badge>
            <Button size="sm" variant="ghost" leftIcon={<Copy size={13} />} onClick={() => copy(l.token)}>Copy</Button>
            <Button size="sm" variant="ghost" leftIcon={<Trash2 size={13} />} onClick={() => revoke.mutate(l.token)}>Revoke</Button>
          </div>
        ))}
        {!linksQ.isLoading && links.length === 0 && <div style={{ fontSize: 13, color: color.textMuted }}>No active links.</div>}
      </div>
    </div>
  );
}

function LogoRow({ workspaceId }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef(null);
  const wsQ = useQuery({
    queryKey: ['ws-detail', workspaceId],
    queryFn: async () => (await api.get(`/workspaces/${workspaceId}`)).data,
    enabled: !!workspaceId,
  });
  const [busy, setBusy] = useState(false);
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/workspaces/${workspaceId}/logo`, { filename: file.name, contentType: file.type });
      await axios.put(data.uploadUrl, file, { headers: { 'Content-Type': file.type } });
      await api.patch(`/workspaces/${workspaceId}`, { logoUrl: data.fileUrl });
      qc.invalidateQueries({ queryKey: ['ws-detail', workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Logo updated.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Logo upload failed.');
    } finally { setBusy(false); }
  };
  const ws = wsQ.data;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.md, marginBottom: space.lg }}>
      {ws?.logoUrl
        ? <img src={ws.logoUrl} alt="logo" style={{ width: 48, height: 48, borderRadius: radius.large, objectFit: 'cover', border: `1px solid ${color.border}` }} />
        : <div style={{ width: 48, height: 48, borderRadius: radius.large, background: color.surfaceAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: color.textMuted, fontSize: 20 }}>{(ws?.name ?? 'W')[0]?.toUpperCase()}</div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: color.text }}>{ws?.name ?? 'Workspace'}</div>
        <div style={{ fontSize: 12, color: color.textMuted }}>Logo shown across the workspace</div>
      </div>
      <Button variant="secondary" size="sm" loading={busy} leftIcon={<UploadCloud size={15} />} onClick={() => fileRef.current?.click()}>Upload logo</Button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
    </div>
  );
}

const ROLES = [
  { value: 'ws_admin', label: 'Admin' },
  { value: 'ws_member', label: 'Member' },
  { value: 'ws_guest', label: 'Guest' },
];

function useUserSearch(term) {
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  return useQuery({
    queryKey: ['user-search', debounced],
    queryFn: async () => {
      const r = await api.get('/users/search', { params: { q: debounced } });
      return Array.isArray(r.data) ? r.data : r.data?.items ?? [];
    },
    enabled: debounced.length >= 1,
    staleTime: 30_000,
  });
}

function InviteCombobox({ email, setEmail }) {
  const listboxId = useId();
  const ref = useRef(null);
  const boxRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [coords, setCoords] = useState(null);
  const searchQ = useUserSearch(email);
  const results = searchQ.data ?? [];

  const place = () => {
    if (!boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open, results]);

  useEffect(() => { setHighlight(-1); }, [results]);

  const pick = (u) => {
    setEmail(u.email || '');
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const borderColor = focused ? color.blue : color.border;
  const showMenu = open && email.trim().length >= 1;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label htmlFor={`${listboxId}-input`}
        style={{ display: 'block', fontFamily: font.text, fontSize: 13, fontWeight: 600, color: color.darkGray, marginBottom: space.xs }}>
        Invite by email
      </label>
      <div ref={boxRef} style={{
        display: 'flex', alignItems: 'center', gap: space.sm, minHeight: 44,
        border: `1px solid ${borderColor}`, borderRadius: radius.primary, padding: '0 12px',
        background: color.surface, boxShadow: focused ? focusRing : 'none',
        transition: 'border-color .12s, box-shadow .12s',
      }}>
        <Search size={16} aria-hidden style={{ color: color.mediumGray, flexShrink: 0 }} />
        <input
          id={`${listboxId}-input`}
          type="email"
          placeholder="Search people or type an email…"
          value={email}
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined}
          autoComplete="off"
          onChange={(e) => { setEmail(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          style={{
            flex: 1, border: 'none', outline: 'none', height: 42, fontFamily: font.text,
            fontSize: 15, color: color.text, background: 'transparent',
          }}
        />
        {searchQ.isFetching && <Spinner size={16} />}
      </div>

      {showMenu && coords && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 3000,
            background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
            boxShadow: shadow.dropdown, padding: space.xs, maxHeight: 280, overflowY: 'auto',
          }}
        >
          {searchQ.isLoading && (
            <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}><Spinner size={18} /></div>
          )}
          {!searchQ.isLoading && results.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 14, color: color.textMuted }}>
              No matches. Press Invite to send to this email.
            </div>
          )}
          {results.map((u, i) => (
            <button
              key={u.id}
              id={`${listboxId}-opt-${i}`}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(u); }}
              style={{
                display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', textAlign: 'left',
                border: 'none', cursor: 'pointer', borderRadius: radius.base, padding: '8px 10px',
                background: i === highlight ? color.surfaceAlt : 'transparent', color: color.text,
              }}
            >
              <Avatar name={u.name} email={u.email} src={u.avatarUrl} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: font.text, fontSize: 14, fontWeight: 600, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name || u.email}
                </div>
                <div style={{ fontFamily: font.text, fontSize: 12, color: color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </div>
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function WorkspaceMembers({ workspaceId, open, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ws_member');

  const membersQ = useQuery({
    queryKey: ['ws-members', workspaceId],
    queryFn: async () => {
      const r = await api.get(`/workspaces/${workspaceId}/members`);
      return Array.isArray(r.data) ? r.data : r.data?.items ?? [];
    },
    enabled: !!workspaceId && open,
  });

  const invite = useMutation({
    mutationFn: ({ email, role }) => api.post(`/workspaces/${workspaceId}/members`, { email, role }),
    onSuccess: () => {
      toast.success('Member invited.');
      setEmail('');
      qc.invalidateQueries({ queryKey: ['ws-members', workspaceId] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not invite. Check the email exists.'),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }) => api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: () => { toast.success('Role updated.'); qc.invalidateQueries({ queryKey: ['ws-members', workspaceId] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not update role.'),
  });
  const removeMember = useMutation({
    mutationFn: (userId) => api.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => { toast.success('Member removed.'); qc.invalidateQueries({ queryKey: ['ws-members', workspaceId] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not remove member.'),
  });

  const onInvite = (e) => {
    e.preventDefault();
    const v = email.trim();
    if (v) invite.mutate({ email: v, role });
  };

  const members = membersQ.data ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Workspace members" size="lg">
      {open && <LogoRow workspaceId={workspaceId} />}
      {open && <InviteLinks workspaceId={workspaceId} />}
      <form onSubmit={onInvite} style={{ display: 'flex', gap: space.md, marginBottom: space.lg, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <InviteCombobox email={email} setEmail={setEmail} />
        </div>
        <div style={{ width: 140 }}>
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
        <Button type="submit" leftIcon={<UserPlus size={16} />} loading={invite.isPending} disabled={!email.trim()}>Invite</Button>
      </form>

      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: color.textMuted, marginBottom: space.sm }}>
        Members ({members.length})
      </div>
      {membersQ.isLoading && <Spinner size={18} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.md }}>
        {members.map((m) => (
          <div key={m.userId || m.id} style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
            <Avatar name={m.name} email={m.email} src={m.avatarUrl} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, color: color.text, fontWeight: 600 }}>{m.name || m.email}</div>
              <div style={{ fontSize: 13, color: color.textMuted }}>{m.email}</div>
            </div>
            {m.role === 'ws_owner' ? (
              <Badge kind="primary">owner</Badge>
            ) : (
              <>
                <Select value={m.role} onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value })} style={{ minHeight: 34, width: 120 }}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
                <IconButton label="Remove member" onClick={() => removeMember.mutate(m.userId)}><Trash2 size={16} /></IconButton>
              </>
            )}
          </div>
        ))}
        {!membersQ.isLoading && members.length === 0 && (
          <div style={{ fontSize: 14, color: color.textMuted }}>No members yet.</div>
        )}
      </div>
    </Modal>
  );
}
