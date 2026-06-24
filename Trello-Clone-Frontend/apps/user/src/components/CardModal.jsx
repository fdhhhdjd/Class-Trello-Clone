import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Trash2, Pencil, X, Archive, Paperclip, Download, Image as ImageIcon,
  FileText, Activity as ActivityIcon, Copy, Eye, EyeOff, Check, Clock, Search, SmilePlus, SquareArrowOutUpRight,
  Link as LinkIcon, LayoutTemplate,
} from 'lucide-react';
import {
  Modal, Button, Input, Textarea, Avatar, LabelChip, Spinner, IconButton, useConfirm, useToast, useAuth,
  color, font, space, radius, shadow,
} from '@trello/ui';
import {
  useUpdateCard, useDeleteCard, useCardDetail, useComments, useAddComment,
  useEditComment, useDeleteComment, useToggleChecklistItem, useAddChecklistItem,
  useDeleteChecklistItem, useAddCardLabel, useRemoveCardLabel,
  useAttachments, useUploadAttachment, useDeleteAttachment, useDownloadAttachment,
  useCardActivity, useDuplicateCard, useWatchCard,
  useBoardMembers, useAddCardMember, useRemoveCardMember, useSetCardFieldValue,
  useCreateBoardLabel, useDeleteBoardLabel, useWorkspaceMembers,
  useConvertChecklistItem, useToggleReaction,
} from '../lib/boardData';
import axios from 'axios';
import { api } from '../lib/api';
import { MentionInput } from './MentionInput';
import { Markdown, markdownStyles } from './Markdown';
import { STATUS_META } from './CardTile';

const sectionLabel = { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: color.textMuted, marginBottom: 10 };

// ISO -> "YYYY-MM-DDTHH:mm" in LOCAL time for <input type="datetime-local">.
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDueDisplay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Comment({ c, cardId, currentUserId, onReact }) {
  const confirm = useConfirm();
  const edit = useEditComment(cardId);
  const del = useDeleteComment(cardId);
  const author = c.author ?? {};
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(c.body);
  const mine = currentUserId && author.id === currentUserId;

  const save = () => {
    const b = body.trim();
    if (b && b !== c.body) edit.mutate({ commentId: c.id, body: b }, { onSuccess: () => setEditing(false) });
    else setEditing(false);
  };

  const onDelete = async () => {
    const ok = await confirm({ title: 'Delete comment?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
    if (ok) del.mutate(c.id);
  };

  return (
    <div style={{ display: 'flex', gap: space.sm }}>
      <Avatar name={author.name} email={author.email} src={author.avatarUrl} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, color: color.text }}>{author.name || author.email || 'User'}</span>
          {c.createdAt && (
            <span style={{ color: color.textMuted, fontSize: 12 }}>{new Date(c.createdAt).toLocaleString()}</span>
          )}
          {c.editedAt && <span style={{ color: color.textMuted, fontSize: 11 }}>(edited)</span>}
        </div>
        {editing ? (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: space.sm }}>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 60 }} />
            <div style={{ display: 'flex', gap: space.sm }}>
              <Button size="sm" onClick={save} loading={edit.isPending}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setBody(c.body); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <div style={{
              marginTop: 4, fontSize: 14, color: color.text, background: color.surfaceAlt,
              padding: '8px 12px', borderRadius: radius.large, wordBreak: 'break-word',
            }}>
              <Markdown>{c.body}</Markdown>
            </div>
            {mine && (
              <div style={{ display: 'flex', gap: space.sm, marginTop: 4 }}>
                <button onClick={() => { setBody(c.body); setEditing(true); }} style={linkBtn}><Pencil size={12} /> Edit</button>
                <button onClick={onDelete} style={{ ...linkBtn, color: color.danger }}><Trash2 size={12} /> Delete</button>
              </div>
            )}
            <ReactionBar reactions={c.reactions} currentUserId={currentUserId} onToggle={(emoji) => onReact({ commentId: c.id, emoji })} />
          </>
        )}
      </div>
    </div>
  );
}

const linkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'transparent',
  color: color.textMuted, cursor: 'pointer', fontSize: 12, fontFamily: font.text, padding: 0,
};

const EMOJIS = ['👍', '❤️', '😄', '🎉', '👀', '🚀', '✅', '🔥'];

function ReactionBar({ reactions = [], currentUserId, onToggle }) {
  const [picking, setPicking] = useState(false);
  const groups = {};
  for (const r of reactions) (groups[r.emoji] ??= []).push(r.userId);
  const chip = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 13,
    borderRadius: radius.pill, cursor: 'pointer', lineHeight: 1.6,
    border: `1px solid ${active ? color.blue : color.border}`,
    background: active ? 'rgba(24,104,219,0.12)' : color.surface, color: color.text,
  });
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, position: 'relative' }}>
      {Object.entries(groups).map(([emoji, users]) => (
        <button key={emoji} onClick={() => onToggle(emoji)} style={chip(currentUserId && users.includes(currentUserId))}>
          {emoji} {users.length}
        </button>
      ))}
      <button onClick={() => setPicking((p) => !p)} title="Add reaction" style={{ ...chip(false), color: color.textMuted }}>
        <SmilePlus size={14} />
      </button>
      {picking && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 30, display: 'flex', gap: 4,
          background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
          padding: 6, boxShadow: shadow.dropdown,
        }}>
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => { onToggle(e); setPicking(false); }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, padding: 2 }}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Checklist({ checklist, cardId, onConvert }) {
  const confirm = useConfirm();
  const toggle = useToggleChecklistItem(cardId);
  const addItem = useAddChecklistItem(cardId);
  const delItem = useDeleteChecklistItem(cardId);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const items = checklist.items ?? [];
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (t) addItem.mutate({ checklistId: checklist.id, text: t }, { onSuccess: () => { setText(''); setAdding(false); } });
  };

  const onDeleteItem = async (id) => {
    const ok = await confirm({ title: 'Delete item?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
    if (ok) delItem.mutate(id);
  };

  return (
    <div style={{ marginBottom: space.lg }}>
      <div style={sectionLabel}>{checklist.title || 'Checklist'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
        <span style={{ fontSize: 12, color: color.textMuted, width: 32 }}>{pct}%</span>
        <div style={{ flex: 1, height: 8, background: color.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color.success, transition: 'width .2s' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: space.sm, fontSize: 14, padding: '2px 0' }}>
            <input type="checkbox" checked={!!it.done} onChange={() => toggle.mutate({ itemId: it.id, done: !it.done })} />
            <span style={{ flex: 1, color: it.done ? color.textMuted : color.text, textDecoration: it.done ? 'line-through' : 'none' }}>
              {it.text}
            </span>
            {onConvert && <IconButton label="Convert to card" size={24} onClick={() => onConvert(it.id)}><SquareArrowOutUpRight size={13} /></IconButton>}
            <IconButton label="Delete item" size={24} onClick={() => onDeleteItem(it.id)}><Trash2 size={13} /></IconButton>
          </div>
        ))}
      </div>
      {adding ? (
        <form onSubmit={submit} style={{ display: 'flex', gap: space.sm, marginTop: space.sm }}>
          <Input autoFocus placeholder="Add an item" value={text} onChange={(e) => setText(e.target.value)} wrapStyle={{ flex: 1 }} />
          <Button type="submit" size="sm" loading={addItem.isPending} disabled={!text.trim()}>Add</Button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...linkBtn, marginTop: space.sm }}><Plus size={13} /> Add item</button>
      )}
    </div>
  );
}

const LABEL_SWATCHES = ['#4C6B1F', '#C9372C', '#1868DB', '#A855F7', '#06B6D4', '#E2B203', '#505F79', '#0C9488'];

function LabelsEditor({ boardId, card, boardLabels }) {
  const confirm = useConfirm();
  const add = useAddCardLabel(boardId, card.id);
  const remove = useRemoveCardLabel(boardId, card.id);
  const createLabel = useCreateBoardLabel(boardId);
  const deleteLabel = useDeleteBoardLabel(boardId);
  const [picking, setPicking] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_SWATCHES[0]);
  const applied = card.labels ?? [];
  const appliedIds = new Set(applied.map((l) => l.id));

  const onRemove = async (l) => {
    const ok = await confirm({ title: 'Remove label?', message: 'Remove this label from the card?', confirmText: 'Remove', danger: true });
    if (ok) remove.mutate(l.id);
  };
  const onDeleteLabel = async (l) => {
    const ok = await confirm({ title: 'Delete label?', message: 'Deletes it from the whole board.', confirmText: 'Delete', danger: true });
    if (ok) deleteLabel.mutate(l.id);
  };
  const onCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createLabel.mutate({ name, color: newColor }, { onSuccess: () => setNewName('') });
  };

  return (
    <div>
      <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Labels</span>
        <IconButton label="Manage labels" size={22} onClick={() => setPicking((v) => !v)}><Plus size={14} /></IconButton>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: applied.length ? 6 : 0 }}>
        {applied.map((l) => (
          <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <LabelChip color={l.color} name={l.name} />
            <IconButton label="Remove label" size={20} onClick={() => onRemove(l)}><X size={12} /></IconButton>
          </span>
        ))}
        {applied.length === 0 && !picking && <span style={{ fontSize: 13, color: color.textMuted }}>No labels. Click + to add.</span>}
      </div>

      {picking && (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.large, padding: space.sm, background: color.surfaceAlt, marginTop: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: space.sm }}>
            {boardLabels.length === 0 && <span style={{ fontSize: 12, color: color.textMuted }}>No board labels yet — create one below.</span>}
            {boardLabels.map((l) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => (appliedIds.has(l.id) ? remove.mutate(l.id) : add.mutate(l.id))}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, textAlign: 'left' }}>
                  <LabelChip color={l.color} name={l.name} />
                  {appliedIds.has(l.id) && <Check size={14} color={color.text} style={{ marginLeft: 'auto' }} />}
                </button>
                <IconButton label="Delete label" size={20} onClick={() => onDeleteLabel(l)}><Trash2 size={12} /></IconButton>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${color.border}`, paddingTop: space.sm }}>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New label name"
              onKeyDown={(e) => e.key === 'Enter' && onCreate()} style={{ marginBottom: 6 }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {LABEL_SWATCHES.map((c) => (
                <button key={c} onClick={() => setNewColor(c)} aria-label={`Color ${c}`}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c, cursor: 'pointer',
                    border: newColor === c ? `2px solid ${color.text}` : `2px solid transparent` }} />
              ))}
            </div>
            <Button size="sm" leftIcon={<Plus size={13} />} loading={createLabel.isPending} disabled={!newName.trim()} onClick={onCreate}>
              Create label
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberAvatar({ m, onRemove }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      title={m.name || m.email}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <Avatar name={m.name} email={m.email} src={m.avatarUrl} size={32} />
      <button
        type="button"
        aria-label={`Remove ${m.name || m.email}`}
        onClick={() => onRemove(m.id)}
        style={{
          position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          border: `1px solid ${color.border}`, background: color.surface, color: color.danger,
          opacity: hover ? 1 : 0, transform: hover ? 'scale(1)' : 'scale(0.8)',
          transition: 'opacity .14s ease, transform .14s ease', boxShadow: shadow.subtle,
        }}
      >
        <X size={11} />
      </button>
    </span>
  );
}

function CandidateRow({ u, onAssign }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onAssign(u.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Assign ${u.name || u.email}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none',
        background: hover ? color.surface : 'transparent', borderRadius: radius.base,
        padding: '5px 6px', cursor: 'pointer', textAlign: 'left', transition: 'background .12s',
      }}
    >
      <Avatar name={u.name} email={u.email} src={u.avatarUrl} size={28} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.email}</span>
        {u.name && u.email && (
          <span style={{ display: 'block', fontSize: 11, color: color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
        )}
      </span>
      <Plus size={14} color={color.textMuted} />
    </button>
  );
}

function MembersEditor({ boardId, workspaceId, card }) {
  const boardQ = useBoardMembers(boardId);
  const wsQ = useWorkspaceMembers(workspaceId);
  const add = useAddCardMember(boardId, card.id);
  const remove = useRemoveCardMember(boardId, card.id);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const assigned = card.members ?? [];
  const assignedIds = new Set(assigned.map((m) => m.id));

  // Candidates = workspace + board members, de-duped, not already assigned.
  const candidates = useMemo(() => {
    const pool = new Map();
    [...(wsQ.data ?? []), ...(boardQ.data ?? [])].forEach((u) => {
      const id = u.id || u.userId;
      if (id && !assignedIds.has(id)) pool.set(id, { id, name: u.name, email: u.email, avatarUrl: u.avatarUrl });
    });
    return [...pool.values()];
  }, [wsQ.data, boardQ.data, assigned.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((u) => `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(q));
  }, [candidates, query]);

  const onAssign = (id) => { add.mutate(id); setQuery(''); };

  return (
    <div>
      <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Members</span>
        <IconButton label="Add member" size={22} active={picking} onClick={() => setPicking((v) => !v)}><Plus size={14} /></IconButton>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: assigned.length ? 8 : 0 }}>
        {assigned.map((m) => <MemberAvatar key={m.id} m={m} onRemove={remove.mutate} />)}
        {assigned.length === 0 && !picking && <span style={{ fontSize: 13, color: color.textMuted }}>No members. Click + to add.</span>}
      </div>
      {picking && (
        <div style={{
          border: `1px solid ${color.border}`, borderRadius: radius.large, padding: space.sm,
          background: color.surface, marginTop: 8, boxShadow: shadow.subtle,
          animation: 'trello-panel-in .14s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          {candidates.length > 5 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginBottom: 6,
              border: `1px solid ${color.border}`, borderRadius: radius.base, background: color.surfaceAlt,
            }}>
              <Search size={14} color={color.textMuted} />
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: color.text, fontFamily: font.text }}
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map((u) => <CandidateRow key={u.id} u={u} onAssign={onAssign} />)}
            {candidates.length === 0 && (
              <span style={{ fontSize: 12, color: color.textMuted, padding: 4 }}>No one to add. Invite people via the workspace “Members” button.</span>
            )}
            {candidates.length > 0 && filtered.length === 0 && (
              <span style={{ fontSize: 12, color: color.textMuted, padding: 4 }}>No matches.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ boardId, card, field }) {
  const set = useSetCardFieldValue(boardId, card.id);
  const current = (card.fieldValues ?? []).find((v) => v.fieldId === field.id)?.value ?? '';
  const [val, setVal] = useState(current);
  useEffect(() => { setVal(current); }, [current]);
  const save = (v) => set.mutate({ fieldId: field.id, value: v === '' ? null : v });

  const common = { width: '100%' };
  return (
    <div style={{ marginBottom: space.sm }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 2 }}>{field.name}</div>
      {field.type === 'checkbox' ? (
        <input type="checkbox" checked={!!val} onChange={(e) => { setVal(e.target.checked); save(e.target.checked); }} />
      ) : field.type === 'dropdown' ? (
        <select value={val} onChange={(e) => { setVal(e.target.value); save(e.target.value); }}
          style={{ ...common, padding: '6px 8px', borderRadius: radius.base, border: `1px solid ${color.border}`, fontFamily: font.text, fontSize: 13 }}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <Input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => save(val)} wrapStyle={common} />
      )}
    </div>
  );
}

function CustomFieldsEditor({ boardId, card, fields }) {
  if (!fields?.length) return null;
  return (
    <div style={{ marginBottom: space.lg }}>
      <div style={sectionLabel}>Custom fields</div>
      {fields.map((f) => <FieldRow key={f.id} boardId={boardId} card={card} field={f} />)}
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

const isImage = (mime) => typeof mime === 'string' && mime.startsWith('image/');

function AttachmentsSection({ boardId, card, onSetCover }) {
  const confirm = useConfirm();
  const attsQ = useAttachments(card.id);
  const upload = useUploadAttachment(boardId, card.id);
  const del = useDeleteAttachment(boardId, card.id);
  const download = useDownloadAttachment();
  const fileRef = useRef(null);
  const atts = attsQ.data ?? [];

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = '';
  };

  const onDelete = async (a) => {
    const ok = await confirm({ title: 'Delete attachment?', message: `"${a.filename}" will be removed.`, confirmText: 'Delete', danger: true });
    if (ok) del.mutate(a.id);
  };

  return (
    <div style={{ marginBottom: space.lg }}>
      <div style={sectionLabel}>Attachments</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
        {atts.map((a) => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: space.sm, padding: 6,
            border: `1px solid ${color.border}`, borderRadius: radius.large, background: color.surfaceAlt,
          }}>
            <div style={{
              width: 48, height: 40, borderRadius: radius.base, flexShrink: 0, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.surface,
            }}>
              {isImage(a.mime) && a.fileUrl
                ? <img src={a.fileUrl} alt={a.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (isImage(a.mime) ? <ImageIcon size={18} color={color.textMuted} /> : <FileText size={18} color={color.textMuted} />)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</div>
              <div style={{ fontSize: 11, color: color.textMuted }}>{formatSize(a.size)}</div>
            </div>
            {isImage(a.mime) && (
              <Button size="sm" variant="ghost" onClick={() => onSetCover(a)} style={{ whiteSpace: 'nowrap' }}>Make cover</Button>
            )}
            <IconButton label="Download" size={28} onClick={() => download.mutate(a.id)}><Download size={14} /></IconButton>
            <IconButton label="Delete attachment" size={28} onClick={() => onDelete(a)}><Trash2 size={14} /></IconButton>
          </div>
        ))}
        {!attsQ.isLoading && atts.length === 0 && (
          <div style={{ fontSize: 13, color: color.textMuted }}>No attachments.</div>
        )}
      </div>
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onPick} />
      <button onClick={() => fileRef.current?.click()} disabled={upload.isPending} style={{ ...linkBtn, marginTop: space.sm }}>
        <Paperclip size={13} /> {upload.isPending ? 'Uploading…' : 'Add attachment'}
      </button>
    </div>
  );
}

function humanizeActivity(a) {
  const who = a.actor?.name || 'Someone';
  switch (a.action) {
    case 'card.created': return `${who} created this card`;
    case 'card.updated': return `${who} updated this card`;
    case 'card.moved': return `${who} moved this card`;
    case 'comment.created': return `${who} commented`;
    case 'attachment.added': return `${who} added an attachment${a.metadata?.filename ? `: ${a.metadata.filename}` : ''}`;
    default: return `${who} ${a.action}`;
  }
}

function ActivitySection({ cardId }) {
  const actQ = useCardActivity(cardId);
  const items = actQ.data ?? [];
  return (
    <div style={{ marginBottom: space.lg }}>
      <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ActivityIcon size={13} /> Activity
      </div>
      {actQ.isLoading && <Spinner size={16} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
        {items.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: space.sm, alignItems: 'flex-start' }}>
            <Avatar name={a.actor?.name} src={a.actor?.avatarUrl} size={24} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: color.text }}>{humanizeActivity(a)}</div>
              <div style={{ fontSize: 11, color: color.textMuted }}>{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</div>
            </div>
          </div>
        ))}
        {!actQ.isLoading && items.length === 0 && (
          <div style={{ fontSize: 13, color: color.textMuted }}>No activity yet.</div>
        )}
      </div>
    </div>
  );
}

export function CardModal({ card, boardId, board, onClose }) {
  const confirm = useConfirm();
  const toast = useToast();
  const update = useUpdateCard(boardId, { successMessage: null });
  const del = useDeleteCard(boardId);
  const duplicate = useDuplicateCard(boardId);
  const watch = useWatchCard(card?.id);
  const detailQ = useCardDetail(card?.id);
  const commentsQ = useComments(card?.id);
  const addComment = useAddComment(card?.id);
  const dropUpload = useUploadAttachment(boardId, card?.id);
  const convertItem = useConvertChecklistItem(card?.id, boardId);
  const toggleReaction = useToggleReaction(card?.id);
  const auth = useAuth();
  const currentUserId = auth?.user?.id;
  const onReact = ({ commentId, emoji }) => toggleReaction.mutate({ commentId, emoji });

  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const commentFileRef = useRef(null);

  const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const onDragEnter = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };
  const onDragOver = (e) => { if (hasFiles(e)) e.preventDefault(); };
  const onDragLeave = (e) => {
    if (!hasFiles(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) { dragDepth.current = 0; setDragOver(false); }
  };
  const onDrop = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    files.forEach((f) => dropUpload.mutate(f));
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState('');
  const [descEditing, setDescEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [mentions, setMentions] = useState([]);

  const full = detailQ.data ?? card ?? {};
  const boardLabels = board?.labels ?? [];
  const mentionCandidates = useMemo(() => {
    const m = new Map();
    (full?.members ?? []).forEach((u) => m.set(u.id, u));
    (board?.lists ?? []).forEach((l) => (l.cards ?? []).forEach((c) =>
      (c.members ?? []).forEach((u) => m.set(u.id, u))));
    return [...m.values()];
  }, [full?.members, board]);

  useEffect(() => {
    setTitle(card?.title ?? '');
    setDescription(card?.description ?? '');
    setDue(isoToLocalInput(card?.dueDate));
  }, [card]);

  useEffect(() => {
    if (detailQ.data) {
      setDescription(detailQ.data.description ?? '');
      setDue(isoToLocalInput(detailQ.data.dueDate));
    }
  }, [detailQ.data]);

  if (!card) return null;

  const saveField = (patch, opts) => update.mutate({ cardId: card.id, patch }, opts);

  const setCoverFromAttachment = (a) =>
    update.mutate({ cardId: card.id, patch: { coverUrl: a.fileUrl } });
  const removeCover = () => saveField({ coverUrl: null });
  const cover = full.coverUrl;

  const onComment = (e) => {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    addComment.mutate({ body, mentions }, { onSuccess: () => { setComment(''); setMentions([]); } });
  };

  const copyCardLink = () => {
    const url = `${window.location.origin}/b/${boardId}?card=${card.id}`;
    navigator.clipboard?.writeText(url).then(() => toast.success('Link copied.'), () => toast.error('Copy failed.'));
  };

  const onCommentAttach = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { data } = await api.post(`/cards/${card.id}/attachments/presign`, { filename: file.name, contentType: file.type });
      await axios.put(data.uploadUrl, file, { headers: { 'Content-Type': file.type } });
      const isImg = file.type.startsWith('image/');
      const md = `${isImg ? '!' : ''}[${file.name}](${data.fileUrl})`;
      setComment((c) => (c ? `${c}\n${md}` : md));
      toast.success('Attached. Press Send to post.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Upload failed.');
    }
  };

  const onDeleteCard = async () => {
    const ok = await confirm({ title: 'Delete card?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
    if (ok) del.mutate(card.id, { onSuccess: onClose });
  };

  const comments = commentsQ.data ?? [];
  const checklists = full.checklists ?? [];
  const descDirty = description !== (full.description ?? '');
  const currentDue = isoToLocalInput(full.dueDate);
  const dueOverdue = full.dueDate ? new Date(full.dueDate) < new Date() : false;

  const saveDescription = () => update.mutate(
    { cardId: card.id, patch: { description } },
    { onSuccess: () => { toast.success('Description saved.'); setDescEditing(false); } },
  );
  const cancelDescription = () => { setDescription(full.description ?? ''); setDescEditing(false); };

  const saveDue = () => {
    if (due === currentDue) return; // no change -> no write/activity
    saveField({ dueDate: due ? new Date(due).toISOString() : null });
  };
  const clearDue = () => {
    setDue('');
    if (full.dueDate) saveField({ dueDate: null });
  };

  return (
    <Modal open={!!card} onClose={onClose} width={980} title={null} padded>
      <div
        style={{ position: 'relative' }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
      {dragOver && (
        <div style={{
          position: 'absolute', inset: -8, zIndex: 20, borderRadius: radius.large,
          border: `2px dashed ${color.blue}`, background: 'rgba(38,132,255,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.sm, color: color.blue, fontFamily: font.text, fontWeight: 700 }}>
            <Paperclip size={28} /> Drop files to attach
          </div>
        </div>
      )}
      {dropUpload.isPending && (
        <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 21, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: color.textMuted }}>
          <Spinner size={14} /> Uploading…
        </div>
      )}
      <style>{`@media (max-width:640px){.cm-grid{flex-direction:column}.cm-side{width:100%!important}}${markdownStyles}`}</style>
      {cover && (
        <div style={{ position: 'relative', marginBottom: space.lg }}>
          <img src={cover} alt="Card cover" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: radius.large, display: 'block' }} />
          <Button size="sm" variant="secondary" leftIcon={<X size={13} />} onClick={removeCover}
            style={{ position: 'absolute', top: 8, right: 8 }}>Remove cover</Button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.sm, paddingRight: 44 }}>
        {full.number != null && (
          <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.textMuted, background: color.surfaceAlt, borderRadius: radius.base, padding: '2px 8px' }}>#{full.number}</span>
        )}
        <button onClick={copyCardLink} title="Copy card link" style={{ ...linkBtn, marginLeft: 'auto' }}>
          <LinkIcon size={13} /> Copy link
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== card.title && saveField({ title: title.trim() })}
        aria-label="Card title"
        style={{
          fontFamily: font.display, fontSize: 26, fontWeight: 700, color: color.text,
          border: 'none', outline: 'none', width: '100%', marginBottom: space.lg, background: 'transparent',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.lg, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: color.textMuted }}>Status:</span>
        {Object.entries(STATUS_META).map(([key, m]) => {
          const on = full.status === key;
          return (
            <button key={key} onClick={() => saveField({ status: on ? null : key })} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              padding: '4px 10px', borderRadius: radius.pill,
              border: `1.5px solid ${on ? m.color : color.border}`,
              background: on ? m.color : color.surface, color: on ? '#fff' : color.textMuted,
            }}>{m.label}</button>
          );
        })}
      </div>

      <div className="cm-grid" style={{ display: 'flex', gap: space.xl, alignItems: 'flex-start' }}>
        {/* Main column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <CustomFieldsEditor boardId={boardId} card={full} fields={board?.customFields ?? []} />

          <div style={{ marginBottom: space.lg }}>
            <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Description</span>
              <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: color.textMuted }}>Markdown supported</span>
            </div>
            {descEditing ? (
              <>
                <Textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a more detailed description…"
                  style={{ minHeight: 110 }}
                />
                <div style={{ display: 'flex', gap: space.sm, marginTop: space.sm }}>
                  <Button size="sm" loading={update.isPending} onClick={saveDescription} disabled={!descDirty}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={cancelDescription}>Cancel</Button>
                </div>
              </>
            ) : (
              <div
                onClick={() => setDescEditing(true)}
                style={{
                  cursor: 'pointer', borderRadius: radius.large, padding: '8px 12px',
                  background: color.surfaceAlt, minHeight: 40,
                }}
              >
                {full.description
                  ? <Markdown>{full.description}</Markdown>
                  : <span style={{ fontSize: 14, color: color.textMuted }}>Add a more detailed description…</span>}
              </div>
            )}
          </div>

          {checklists.map((cl) => <Checklist key={cl.id} checklist={cl} cardId={card.id} onConvert={(itemId) => convertItem.mutate(itemId)} />)}

          <AttachmentsSection boardId={boardId} card={full} onSetCover={setCoverFromAttachment} />

          <div style={{ marginBottom: space.lg }}>
            <div style={sectionLabel}>Reactions</div>
            <ReactionBar reactions={full.reactions} currentUserId={currentUserId} onToggle={(emoji) => toggleReaction.mutate({ cardId: card.id, emoji })} />
          </div>

          <div style={{ marginBottom: space.lg }}>
            <div style={sectionLabel}>Comments</div>
            <form onSubmit={onComment} style={{ display: 'flex', gap: space.sm, marginBottom: space.base, alignItems: 'flex-start' }}>
              <MentionInput placeholder="Write a comment… use @ to mention" value={comment}
                onChange={setComment} candidates={mentionCandidates} onMentionsChange={setMentions} />
              <IconButton label="Attach file" onClick={() => commentFileRef.current?.click()}><Paperclip size={16} /></IconButton>
              <input ref={commentFileRef} type="file" onChange={onCommentAttach} style={{ display: 'none' }} />
              <Button type="submit" loading={addComment.isPending} disabled={!comment.trim()} style={{ whiteSpace: 'nowrap' }}>Send</Button>
            </form>
            {/\!\[[^\]]*\]\([^)]+\)/.test(comment) && (
              <div style={{ marginBottom: space.base, padding: space.sm, border: `1px dashed ${color.border}`, borderRadius: radius.base, background: color.surfaceAlt }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: color.textMuted, marginBottom: 6 }}>Xem trước</div>
                <Markdown>{comment}</Markdown>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.md }}>
              {commentsQ.isLoading && <Spinner size={18} />}
              {!commentsQ.isLoading && comments.map((c) => <Comment key={c.id} c={c} cardId={card.id} currentUserId={currentUserId} onReact={onReact} />)}
              {!commentsQ.isLoading && comments.length === 0 && (
                <div style={{ fontSize: 13, color: color.textMuted }}>No comments yet.</div>
              )}
            </div>
          </div>

          <ActivitySection cardId={card.id} />
        </div>

        {/* Sidebar column */}
        <div className="cm-side" style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: space.lg }}>
          <div><LabelsEditor boardId={boardId} card={full} boardLabels={boardLabels} /></div>
          <div><MembersEditor boardId={boardId} workspaceId={board?.workspaceId} card={full} /></div>
          <div>
            <div style={sectionLabel}>Due date</div>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} onBlur={saveDue} />
            {full.dueDate && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                  padding: '3px 8px', borderRadius: radius.base,
                  background: dueOverdue ? color.errorBg : color.surfaceAlt,
                  color: dueOverdue ? color.danger : color.textMuted,
                }}>
                  <Clock size={13} /> {formatDueDisplay(full.dueDate)}{dueOverdue ? ' · Overdue' : ''}
                </span>
                <button onClick={clearDue} style={{ ...linkBtn, color: color.danger }}>Clear</button>
              </div>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${color.border}`, paddingTop: space.base, display: 'flex', flexDirection: 'column', gap: space.sm }}>
            <Button variant="secondary" leftIcon={full.watching ? <EyeOff size={15} /> : <Eye size={15} />}
              loading={watch.isPending} onClick={() => watch.mutate(!full.watching)} style={{ justifyContent: 'flex-start' }}>
              {full.watching ? 'Unwatch' : 'Watch'}
            </Button>
            <Button variant="secondary" leftIcon={<Copy size={15} />} loading={duplicate.isPending}
              onClick={() => duplicate.mutate(card.id, { onSuccess: onClose })} style={{ justifyContent: 'flex-start' }}>
              Duplicate
            </Button>
            <Button variant="secondary" leftIcon={<LayoutTemplate size={15} />}
              onClick={() => saveField({ isTemplate: !full.isTemplate }, { onSuccess: full.isTemplate ? undefined : onClose })} style={{ justifyContent: 'flex-start' }}>
              {full.isTemplate ? 'Remove from templates' : 'Save as template'}
            </Button>
            <Button variant="secondary" leftIcon={<Archive size={15} />}
              onClick={() => saveField({ archived: !full.archived })} style={{ justifyContent: 'flex-start' }}>
              {full.archived ? 'Unarchive' : 'Archive'}
            </Button>
            <Button variant="danger" leftIcon={<Trash2 size={15} />} loading={del.isPending} onClick={onDeleteCard} style={{ justifyContent: 'flex-start' }}>
              Delete card
            </Button>
          </div>
        </div>
      </div>
      </div>
    </Modal>
  );
}
