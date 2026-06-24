import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, User, Settings as SettingsIcon, LogOut, Layout, CreditCard, LayoutDashboard, Keyboard } from 'lucide-react';
import {
  useAuth, useToast, ThemeToggle, Avatar, Dropdown, MenuItem, MenuDivider, Spinner,
  color, font, radius, space, shadow,
} from '@trello/ui';
import { meUser } from '../lib/me';
import { useSearch } from '../lib/searchData';
import { NotificationsBell } from './NotificationsBell';

function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { results, isLoading, active } = useSearch(q);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (path) => { setOpen(false); setQ(''); navigate(path); };
  const hasResults = results.boards.length > 0 || results.cards.length > 0;

  return (
    <div ref={ref} style={{ flex: 1, maxWidth: 460, position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: space.sm,
        border: `1px solid ${color.border}`, borderRadius: radius.primary, padding: '0 12px',
        background: color.surface,
      }}>
        <Search size={18} aria-hidden style={{ color: color.mediumGray, flexShrink: 0 }} />
        <input
          data-global-search
          placeholder="Search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{
            flex: 1, border: 'none', outline: 'none', height: 40, fontFamily: font.text,
            fontSize: 15, color: color.text, background: 'transparent',
          }}
        />
      </div>
      {open && active && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 600,
          background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
          boxShadow: shadow.dropdown, padding: space.xs, maxHeight: 420, overflowY: 'auto',
        }}>
          {isLoading && <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}><Spinner size={18} /></div>}
          {!isLoading && !hasResults && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: color.textMuted }}>No results.</div>
          )}
          {results.boards.length > 0 && (
            <>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: color.textMuted }}>Boards</div>
              {results.boards.map((b) => (
                <MenuItem key={b.id} icon={<Layout size={15} />} onClick={() => go(`/b/${b.id}`)}>{b.name}</MenuItem>
              ))}
            </>
          )}
          {results.cards.length > 0 && (
            <>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: color.textMuted }}>Cards</div>
              {results.cards.map((c) => (
                <MenuItem key={c.id} icon={<CreditCard size={15} />} onClick={() => go(`/b/${c.boardId}?card=${c.id}`)}>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                    <span style={{ fontSize: 11, color: color.textMuted }}>{c.boardName} · {c.listName}</span>
                  </span>
                </MenuItem>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Logo({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: space.sm, border: 'none', background: 'transparent',
      cursor: 'pointer', padding: '4px 8px', borderRadius: radius.base,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <span style={{ width: 6, height: 16, background: color.blue, borderRadius: 2 }} />
        <span style={{ width: 6, height: 11, background: color.blue, borderRadius: 2 }} />
      </span>
      <span style={{ fontFamily: font.display, fontSize: 22, fontWeight: 800, color: color.blue, letterSpacing: '-0.5px' }}>
        Trello
      </span>
    </button>
  );
}

export function NavBar() {
  const { user, logout } = useAuth();
  const me = meUser(user);
  const toast = useToast();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    toast.info('You have been logged out.');
    navigate('/login');
  };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 500, background: color.surface,
      borderBottom: `1px solid ${color.border}`, padding: '8px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.base,
      height: 60, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.xs, minWidth: 0 }}>
        <Logo onClick={() => navigate('/')} />
      </div>

      <SearchBox />

      {me && (
        <div style={{ display: 'flex', alignItems: 'center', gap: space.xs }}>
          <ThemeToggle size={38} />
          <NotificationsBell enabled={!!me} />
          <Dropdown
            align="right"
            width={240}
            trigger={
              <button aria-label="Account menu" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, borderRadius: '50%' }}>
                <Avatar name={me.name} email={me.email} src={me.avatarUrl} size={36} />
              </button>
            }
          >
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: space.sm }}>
              <Avatar name={me.name} email={me.email} src={me.avatarUrl} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: font.text, fontWeight: 600, fontSize: 14, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {me.name || 'Member'}
                </div>
                <div style={{ fontFamily: font.text, fontSize: 12, color: color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {me.email}
                </div>
              </div>
            </div>
            <MenuDivider />
            <MenuItem icon={<Home size={16} />} onClick={() => navigate('/')}>Workspaces</MenuItem>
            <MenuItem icon={<LayoutDashboard size={16} />} onClick={() => navigate('/dashboard')}>Dashboard</MenuItem>
            <MenuItem icon={<User size={16} />} onClick={() => navigate('/profile')}>Profile</MenuItem>
            <MenuItem icon={<SettingsIcon size={16} />} onClick={() => navigate('/settings')}>Settings</MenuItem>
            <MenuItem icon={<Keyboard size={16} />} onClick={() => window.dispatchEvent(new Event('trello:open-shortcuts'))}>Shortcuts</MenuItem>
            <MenuDivider />
            <MenuItem icon={<LogOut size={16} />} danger onClick={onLogout}>Log out</MenuItem>
          </Dropdown>
        </div>
      )}
    </header>
  );
}
