import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, Layout, CreditCard, Home, User, Settings as SettingsIcon,
  SunMoon, LogOut, CornerDownLeft,
} from 'lucide-react';
import { useAuth, useTheme, useToast, Spinner, color, font, radius, space, shadow } from '@trello/ui';
import { useSearch } from '../lib/searchData';

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { results, isLoading } = useSearch(q);

  useEffect(() => {
    if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const close = () => { onClose?.(); };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const doLogout = async () => {
    await logout();
    toast.info('You have been logged out.');
    navigate('/login');
  };

  const actions = useMemo(() => ([
    { id: 'a-workspaces', icon: Home, label: 'Go to Workspaces', run: () => navigate('/') },
    { id: 'a-dashboard', icon: Layout, label: 'Go to Dashboard', run: () => navigate('/dashboard') },
    { id: 'a-profile', icon: User, label: 'Profile', run: () => navigate('/profile') },
    { id: 'a-settings', icon: SettingsIcon, label: 'Settings', run: () => navigate('/settings') },
    { id: 'a-theme', icon: SunMoon, label: 'Toggle theme', run: toggleTheme, keepOpen: true },
    { id: 'a-logout', icon: LogOut, label: 'Log out', run: doLogout, danger: true },
  ]), [theme, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const term = q.trim().toLowerCase();
  const filteredActions = term
    ? actions.filter((a) => a.label.toLowerCase().includes(term))
    : actions;

  // Flat list of selectable items for keyboard nav.
  const items = useMemo(() => {
    const out = [];
    (results.boards ?? []).forEach((b) => out.push({
      type: 'board', key: `b-${b.id}`, icon: Layout, label: b.name,
      run: () => navigate(`/b/${b.id}`),
    }));
    (results.cards ?? []).forEach((c) => out.push({
      type: 'card', key: `c-${c.id}`, icon: CreditCard, label: c.title,
      sub: [c.boardName, c.listName].filter(Boolean).join(' · '),
      run: () => navigate(`/b/${c.boardId}?card=${c.id}`),
    }));
    filteredActions.forEach((a) => out.push({
      type: 'action', key: a.id, icon: a.icon, label: a.label, danger: a.danger,
      run: a.run, keepOpen: a.keepOpen,
    }));
    return out;
  }, [results, filteredActions, navigate]);

  useEffect(() => { setActive(0); }, [q, results]);

  if (!open) return null;

  const activate = (item) => {
    if (!item) return;
    item.run?.();
    if (!item.keepOpen) close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(items[active]); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const boardCount = (results.boards ?? []).length;
  const cardCount = (results.cards ?? []).length;

  let idx = -1;
  const renderItem = (item) => {
    idx += 1;
    const i = idx;
    const Icon = item.icon;
    const selected = i === active;
    return (
      <button
        key={item.key}
        data-idx={i}
        onMouseEnter={() => setActive(i)}
        onClick={() => activate(item)}
        style={{
          display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', textAlign: 'left',
          border: 'none', cursor: 'pointer', padding: '9px 12px', borderRadius: radius.base,
          background: selected ? color.primaryBadgeBg : 'transparent',
          color: item.danger ? color.danger : color.text,
          fontFamily: font.text, fontSize: 14,
        }}
      >
        <Icon size={16} style={{ flexShrink: 0, color: item.danger ? color.danger : color.textMuted }} />
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
          {item.sub && <span style={{ fontSize: 12, color: color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</span>}
        </span>
        {selected && <CornerDownLeft size={14} style={{ color: color.textMuted, flexShrink: 0 }} />}
      </button>
    );
  };

  const Group = ({ title }) => (
    <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: color.textMuted }}>{title}</div>
  );

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.54)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 1100, padding: space.lg,
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Command palette"
        onKeyDown={onKeyDown}
        style={{
          background: color.surface, borderRadius: radius.large, boxShadow: shadow.modal,
          width: '100%', maxWidth: 560, marginTop: '10vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', maxHeight: '70vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, padding: '12px 14px', borderBottom: `1px solid ${color.border}` }}>
          <Search size={18} style={{ color: color.mediumGray, flexShrink: 0 }} />
          <input
            ref={inputRef}
            placeholder="Search boards, cards, or run a command…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: font.text, fontSize: 16, color: color.text, height: 28,
            }}
          />
          {isLoading && <Spinner size={16} />}
        </div>

        <div ref={listRef} style={{ overflowY: 'auto', padding: space.xs }}>
          {boardCount > 0 && <Group title="Boards" />}
          {(results.boards ?? []).map(renderItem)}
          {cardCount > 0 && <Group title="Cards" />}
          {(results.cards ?? []).map(renderItem)}
          {filteredActions.length > 0 && <Group title="Actions" />}
          {filteredActions.map(renderItem)}
          {items.length === 0 && (
            <div style={{ padding: '16px 12px', fontSize: 13, color: color.textMuted, textAlign: 'center' }}>No results.</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
