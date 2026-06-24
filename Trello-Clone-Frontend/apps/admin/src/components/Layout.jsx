import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  useAuth, usePermission, useTheme, Avatar, Dropdown, MenuItem, MenuDivider, IconButton, ThemeToggle,
  color, space, font, radius, shadow,
} from '@trello/ui';
import {
  LayoutDashboard, Users, KanbanSquare, ScrollText, HardDrive,
  LogOut, Shield, Menu, Search, User, Settings, ShieldCheck, Activity, SlidersHorizontal, Megaphone, CloudUpload,
} from 'lucide-react';
import { meProfile } from '../lib/api';
import { APP_VERSION } from '../lib/version';

// `perm`/`role` gate visibility via usePermission; undefined = always visible.
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
      { to: '/monitoring', label: 'Monitoring', Icon: Activity },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/users', label: 'Users', Icon: Users },
      { to: '/workspaces', label: 'Workspaces', Icon: KanbanSquare },
      { to: '/roles', label: 'Roles & Permissions', Icon: ShieldCheck, role: 'super_admin' },
      { to: '/storage', label: 'Storage', Icon: HardDrive, perm: 'storage.view' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/audit', label: 'Audit Log', Icon: ScrollText, perm: 'system.view_audit_log' },
      { to: '/system', label: 'System Settings', Icon: SlidersHorizontal, role: 'super_admin' },
      { to: '/landing', label: 'Landing Page', Icon: Megaphone, role: 'super_admin' },
      { to: '/backup', label: 'Backup', Icon: CloudUpload, role: 'super_admin' },
    ],
  },
];

const SIDEBAR_W = 248;
// Fixed dark sidebar in both themes (admin chrome stays dark).
const SIDEBAR_BG = '#0B1626';

function NavItem({ to, label, Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: space.md,
        padding: '10px 12px', borderRadius: radius.large, textDecoration: 'none',
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
        background: isActive ? 'rgba(24,104,219,0.95)' : 'transparent',
        fontSize: 14.5, fontWeight: isActive ? 600 : 500,
        transition: 'background .12s, color .12s',
      })}
      onMouseEnter={(e) => { if (!e.currentTarget.style.background.includes('rgba(24')) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.background = 'transparent'; }}
    >
      {({ isActive }) => (
        <>
          <span style={{ display: 'inline-flex', opacity: isActive ? 1 : 0.85 }}><Icon size={18} /></span>
          {label}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }) {
  const { can, hasRole } = usePermission();
  const visible = (n) => {
    if (n.role && !hasRole(n.role)) return false;
    if (n.perm && !can(n.perm)) return false;
    return true;
  };
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter(visible) }))
    .filter((g) => g.items.length > 0);
  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: space.sm,
        padding: `${space.lg} ${space.base}`, marginBottom: space.sm,
      }}>
        <span style={{
          width: 32, height: 32, borderRadius: radius.large, flexShrink: 0,
          background: color.blue, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', color: '#FFFFFF',
        }}>
          <Shield size={18} />
        </span>
        <span style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
          Trello Admin
        </span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: space.sm, padding: `0 ${space.md}`, overflowY: 'auto' }}>
        {groups.map((g, gi) => (
          <div key={g.label}>
            {gi > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: `${space.xs} 8px ${space.sm}` }} />}
            <div style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
            }}>
              {g.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {g.items.map((it) => <NavItem key={it.to} {...it} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </nav>
      <div style={{
        marginTop: 'auto', padding: space.base,
        fontSize: 12, color: 'rgba(255,255,255,0.4)',
      }}>
        Admin Console {APP_VERSION}
      </div>
    </>
  );
}

// Thin top progress bar that animates briefly on each route change.
function NavProgress({ trigger }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(true);
    const t = setTimeout(() => setActive(false), 450);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <div aria-hidden style={{
      position: 'sticky', top: 60, left: 0, right: 0, height: 2, zIndex: 29, overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      <div className={active ? 'admin-navbar-on' : undefined} style={{
        height: '100%', width: '100%', transformOrigin: '0 50%',
        transform: active ? undefined : 'scaleX(0)', opacity: active ? 1 : 0,
        background: `linear-gradient(90deg, ${color.blue}, ${color.blueBright ?? color.blue})`,
      }} />
    </div>
  );
}

export function Layout({ children }) {
  const { user: rawUser, logout } = useAuth();
  const { resolved } = useTheme();
  const user = meProfile(rawUser);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const sidebarStyle = {
    width: SIDEBAR_W, background: SIDEBAR_BG, color: '#FFFFFF',
    display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    flexShrink: 0,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: font.text, background: color.surfaceAlt }}>
      {/* Desktop sidebar (fixed) */}
      <aside className="admin-sidebar" style={{
        ...sidebarStyle, position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40,
      }}>
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.5)', zIndex: 49,
          }} />
          <aside style={{ ...sidebarStyle, position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, boxShadow: shadow.modal }}>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="admin-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: SIDEBAR_W }}>
        <header style={{
          height: 60, background: color.surface, borderBottom: `1px solid ${color.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: space.base, padding: `0 ${space.lg}`, position: 'sticky', top: 0, zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
            <span className="admin-menu-btn" style={{ display: 'none' }}>
              <IconButton label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></IconButton>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
            <ThemeToggle />
            <Dropdown align="right" width={240} trigger={
              <button type="button" style={{
                display: 'flex', alignItems: 'center', gap: space.sm, cursor: 'pointer',
                background: 'transparent', border: 'none', padding: '4px 6px', borderRadius: radius.large,
              }}>
                <Avatar name={user?.name} email={user?.email} src={user?.avatarUrl} size={32} />
                <span className="admin-email" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                  <span style={{ color: color.text, fontSize: 14, fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || 'Administrator'}
                  </span>
                  <span style={{ color: color.textMuted, fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </span>
                </span>
              </button>
            }>
              <div style={{ padding: '8px 12px 6px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Administrator'}
                </div>
                <div style={{ fontSize: 12, color: color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </div>
              </div>
              <MenuDivider />
              <MenuItem icon={<User size={16} />} onClick={() => navigate('/profile')}>Profile</MenuItem>
              <MenuItem icon={<Settings size={16} />} onClick={() => navigate('/settings')}>Settings</MenuItem>
              <MenuDivider />
              <MenuItem icon={<LogOut size={16} />} danger onClick={onLogout}>Sign out</MenuItem>
            </Dropdown>
          </div>
        </header>

        <NavProgress trigger={location.pathname} />
        <main style={{ flex: 1, padding: space.xl, overflow: 'auto', width: '100%', boxSizing: 'border-box' }}>
          <div key={location.pathname} className="admin-page-enter">
            {children}
          </div>
        </main>
      </div>

      <style>{`
        :root { color-scheme: ${resolved}; }
        @keyframes adminPageEnter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .admin-page-enter { animation: adminPageEnter .18s ease-out both; }
        @keyframes adminNavbar {
          0% { transform: scaleX(0); opacity: 1; }
          70% { transform: scaleX(0.85); opacity: 1; }
          100% { transform: scaleX(1); opacity: 0; }
        }
        .admin-navbar-on { animation: adminNavbar .45s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .admin-page-enter { animation: none !important; }
          .admin-navbar-on { animation: none !important; opacity: 0 !important; }
        }
        @media (max-width: 1023px) {
          .admin-sidebar { display: none !important; }
          .admin-content { margin-left: 0 !important; }
          .admin-menu-btn { display: inline-flex !important; }
        }
        @media (max-width: 900px) {
          .admin-master-detail { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .admin-email { display: none !important; }
          .admin-vs-label { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function PageHeader({ title, subtitle, breadcrumb, action }) {
  return (
    <div style={{ marginBottom: space.lg }}>
      {breadcrumb && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: color.textMuted, marginBottom: space.sm }}>
          {breadcrumb.map((b, i) => (
            <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: color.mediumGray }}>/</span>}
              <span style={{ color: i === breadcrumb.length - 1 ? color.text : color.textMuted, fontWeight: i === breadcrumb.length - 1 ? 600 : 400 }}>{b}</span>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.base, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, color: color.text, margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ color: color.textMuted, margin: `6px 0 0`, fontSize: 14 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

// kept for backwards-compat with any imports
export const PageTitle = PageHeader;

export function SearchInput({ value, onChange, placeholder = 'Search…', width = 320 }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: width }}>
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        color: color.mediumGray, display: 'inline-flex', pointerEvents: 'none',
      }}>
        <Search size={16} />
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: font.text, fontSize: 14, minHeight: 40, width: '100%',
          padding: '8px 12px 8px 36px', borderRadius: radius.primary, boxSizing: 'border-box',
          border: `1px solid ${focused ? color.blue : color.border}`, color: color.text,
          background: color.surface, outline: 'none',
          boxShadow: focused ? '0px 0px 0px 3px rgba(24, 104, 219, 0.15)' : 'none',
          transition: 'border-color .12s, box-shadow .12s',
        }}
      />
    </div>
  );
}
