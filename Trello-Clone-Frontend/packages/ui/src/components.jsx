import {
  createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, useId,
} from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, Info, AlertTriangle, AlertCircle,
} from 'lucide-react';
import { color, space, radius, shadow, font, focusRing } from './tokens';

/* ------------------------------------------------------------------ Spinner */

export function Spinner({ size = 20, color: c = color.blue, style }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block', width: size, height: size,
        border: `2px solid ${color.lightGray}`, borderTopColor: c,
        borderRadius: '50%', animation: 'trello-spin 0.6s linear infinite', ...style,
      }}
    />
  );
}

export function Skeleton({ width = '100%', height = 16, radius: r = radius.base, style }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'block', width, height, borderRadius: r,
        background: `linear-gradient(90deg, ${color.surfaceAlt} 25%, ${color.lightGray} 37%, ${color.surfaceAlt} 63%)`,
        backgroundSize: '400% 100%', animation: 'trello-shimmer 1.4s ease infinite', ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------------- Button */

const btnVariants = {
  primary: {
    base: { background: color.blue, color: color.white, border: '1px solid transparent', boxShadow: shadow.subtle },
    hover: { background: color.blueBright },
    active: { background: color.blueDark },
  },
  secondary: {
    base: { background: color.surface, color: color.text, border: `1px solid ${color.border}` },
    hover: { background: color.surfaceAlt },
    active: { background: color.lightGray },
  },
  ghost: {
    base: { background: 'transparent', color: color.text, border: '1px solid transparent' },
    hover: { background: color.surfaceAlt },
    active: { background: color.lightGray },
  },
  subtle: {
    base: { background: color.surfaceAlt, color: color.text, border: '1px solid transparent' },
    hover: { background: color.lightGray },
    active: { background: color.lightGray },
  },
  danger: {
    base: { background: color.danger, color: color.white, border: '1px solid transparent' },
    hover: { background: '#B5261B' },
    active: { background: '#8E1A12' },
  },
};

const btnSizes = {
  sm: { minHeight: 34, padding: '4px 14px', fontSize: 14 },
  md: { minHeight: 42, padding: '9px 18px', fontSize: 15 },
  lg: { minHeight: 46, padding: '11px 22px', fontSize: 16 },
};

export function Button({
  variant = 'primary', size = 'md', loading = false, fullWidth = false,
  leftIcon, rightIcon, disabled, style, children, ...rest
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const v = btnVariants[variant] ?? btnVariants.primary;
  const isDisabled = disabled || loading;

  const composed = {
    fontFamily: font.text, fontWeight: 500, lineHeight: '20px',
    borderRadius: radius.primary, cursor: isDisabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    transition: 'background .12s ease, box-shadow .12s ease, opacity .12s',
    width: fullWidth ? '100%' : undefined, whiteSpace: 'nowrap',
    ...btnSizes[size], ...v.base,
    ...(!isDisabled && hover ? v.hover : null),
    ...(!isDisabled && active ? v.active : null),
    ...(isDisabled ? { opacity: 0.6 } : null),
    ...style,
  };

  return (
    <button
      type="button"
      disabled={isDisabled}
      style={composed}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onFocus={(e) => { e.currentTarget.style.boxShadow = focusRing; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = v.base.boxShadow ?? 'none'; }}
      {...rest}
    >
      {loading && <Spinner size={14} color={v.base.color} />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

export function IconButton({ label, size = 32, active = false, style, children, ...rest }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', border: 'none', borderRadius: radius.base, cursor: 'pointer',
        background: active ? color.lightGray : hover ? color.surfaceAlt : 'transparent',
        color: color.text, transition: 'background .12s', ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={(e) => { e.currentTarget.style.boxShadow = focusRing; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Input */

export function Input({ label, error, helper, id, style, wrapStyle, ...rest }) {
  const auto = useId();
  const inputId = id ?? auto;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.danger : focused ? color.blue : color.border;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs, ...wrapStyle }}>
      {label && (
        <label htmlFor={inputId} style={{ fontFamily: font.text, fontSize: 13, fontWeight: 600, color: color.darkGray }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={{
          fontFamily: font.text, fontSize: 15, lineHeight: '24px', minHeight: 44,
          padding: '10px 14px', borderRadius: radius.primary,
          border: `1px solid ${borderColor}`, color: color.text,
          background: error ? color.errorBg : color.surface,
          outline: 'none', width: '100%', boxSizing: 'border-box',
          boxShadow: focused ? focusRing : 'none', transition: 'border-color .12s, box-shadow .12s',
          ...style,
        }}
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => {
          setFocused(false);
          // Auto-clean: trim leading/trailing whitespace on blur (skip passwords).
          if (rest.onChange && typeof rest.value === 'string' && rest.type !== 'password') {
            const trimmed = rest.value.trim();
            if (trimmed !== rest.value) {
              rest.onChange({ ...e, target: { ...e.target, value: trimmed } });
            }
          }
          rest.onBlur?.(e);
        }}
      />
      {error ? (
        <span style={{ fontFamily: font.text, fontSize: 12, color: color.danger }}>{error}</span>
      ) : helper ? (
        <span style={{ fontFamily: font.text, fontSize: 12, color: color.navyLight }}>{helper}</span>
      ) : null}
    </div>
  );
}

export function Textarea({ label, error, helper, id, style, wrapStyle, ...rest }) {
  const auto = useId();
  const taId = id ?? auto;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.danger : focused ? color.blue : color.border;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs, ...wrapStyle }}>
      {label && (
        <label htmlFor={taId} style={{ fontFamily: font.text, fontSize: 13, fontWeight: 600, color: color.darkGray }}>
          {label}
        </label>
      )}
      <textarea
        id={taId}
        style={{
          fontFamily: font.text, fontSize: 15, lineHeight: '22px', minHeight: 88,
          padding: '10px 14px', borderRadius: radius.primary,
          border: `1px solid ${borderColor}`, color: color.text,
          background: color.surface, outline: 'none', width: '100%', boxSizing: 'border-box',
          resize: 'vertical', boxShadow: focused ? focusRing : 'none',
          transition: 'border-color .12s, box-shadow .12s', ...style,
        }}
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => {
          setFocused(false);
          // Auto-clean: trim leading/trailing whitespace on blur (skip passwords).
          if (rest.onChange && typeof rest.value === 'string' && rest.type !== 'password') {
            const trimmed = rest.value.trim();
            if (trimmed !== rest.value) {
              rest.onChange({ ...e, target: { ...e.target, value: trimmed } });
            }
          }
          rest.onBlur?.(e);
        }}
      />
      {error && <span style={{ fontFamily: font.text, fontSize: 12, color: color.danger }}>{error}</span>}
      {!error && helper && <span style={{ fontFamily: font.text, fontSize: 12, color: color.navyLight }}>{helper}</span>}
    </div>
  );
}

export function Select({ label, error, id, style, wrapStyle, children, ...rest }) {
  const auto = useId();
  const selId = id ?? auto;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.danger : focused ? color.blue : color.border;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs, ...wrapStyle }}>
      {label && (
        <label htmlFor={selId} style={{ fontFamily: font.text, fontSize: 13, fontWeight: 600, color: color.darkGray }}>
          {label}
        </label>
      )}
      <select
        id={selId}
        style={{
          fontFamily: font.text, fontSize: 15, minHeight: 44, padding: '10px 14px',
          borderRadius: radius.primary, border: `1px solid ${borderColor}`,
          color: color.text, background: color.surface, outline: 'none', width: '100%',
          boxSizing: 'border-box', cursor: 'pointer', boxShadow: focused ? focusRing : 'none', ...style,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

/* --------------------------------------------------------------------- Card */

export function Card({ children, hoverable = false, style, ...rest }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
        padding: space.lg, boxShadow: hover && hoverable ? shadow.hover : shadow.subtle,
        color: color.text, transition: 'box-shadow .15s, transform .15s',
        transform: hover && hoverable ? 'translateY(-2px)' : 'none', ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- Badge */

export function Badge({ kind = 'default', children, style }) {
  const kinds = {
    default: { background: color.surfaceAlt, color: color.text, border: `1px solid ${color.lightGray}` },
    success: { background: color.successBg, color: color.success, border: `1px solid ${color.success}` },
    error: { background: color.errorBg, color: color.danger, border: `1px solid ${color.danger}` },
    primary: { background: color.primaryBadgeBg, color: color.blue, border: `1px solid ${color.blue}` },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: radius.badge,
      padding: '2px 8px', fontSize: 12, fontWeight: 600, lineHeight: '16px',
      fontFamily: font.text, ...kinds[kind], ...style,
    }}>{children}</span>
  );
}

// Trello-style color chip (board labels).
export function LabelChip({ color: bg, name, compact = false, style }) {
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex', alignItems: 'center', background: bg,
        color: '#1D2125', fontFamily: font.text, fontSize: 12, fontWeight: 600,
        borderRadius: radius.base, height: compact ? 8 : 20,
        minWidth: compact ? 40 : 0, padding: compact ? 0 : '0 8px',
        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...style,
      }}
    >
      {!compact && name}
    </span>
  );
}

/* ------------------------------------------------------------------- Avatar */

function hashColor(str) {
  const palette = ['#1868DB', '#A855F7', '#06B6D4', '#0EA47A', '#E8590C', '#C9372C', '#6554C0', '#0747A6'];
  let h = 0;
  for (let i = 0; i < (str || '').length; i += 1) h = str.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

export function Avatar({ name, email, src, size = 32, style, title }) {
  const [failed, setFailed] = useState(false);
  const label = name || email || '?';
  const initials = label.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: font.text, fontWeight: 600, fontSize: Math.round(size * 0.42),
    color: color.white, userSelect: 'none', ...style,
  };
  if (src && !failed) {
    return (
      <img
        src={src} alt={label} title={title ?? label}
        onError={() => setFailed(true)}
        style={{ ...base, objectFit: 'cover' }}
      />
    );
  }
  return <span title={title ?? label} style={{ ...base, background: hashColor(label) }}>{initials}</span>;
}

/* -------------------------------------------------------------------- Modal */

const modalSizes = { sm: 420, md: 560, lg: 720, xl: 880 };

export function Modal({ open, onClose, title, size = 'md', width, footer, headerExtra, children, padded = true }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  const beginClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => { onClose?.(); }, 140);
  }, [onClose]);

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); }
    else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => { setMounted(false); setClosing(false); }, 140);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') beginClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [mounted, beginClose]);

  useEffect(() => {
    if (open && !closing && ref.current) {
      const focusable = ref.current.querySelector('input, textarea, button, [tabindex]');
      focusable?.focus?.();
    }
  }, [open, closing]);

  if (!mounted) return null;
  const maxWidth = width ?? modalSizes[size] ?? modalSizes.md;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) beginClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.54)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 1000, padding: space.lg, overflowY: 'auto',
        animation: `${closing ? 'trello-fade-out' : 'trello-fade'} .14s ease both`,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        style={{
          background: color.surface, borderRadius: radius.large, boxShadow: shadow.modal,
          maxWidth, width: '100%', marginTop: '6vh', marginBottom: '6vh', position: 'relative',
          animation: `${closing ? 'trello-pop-out' : 'trello-pop'} .16s cubic-bezier(0.16,1,0.3,1) both`,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {!(title || headerExtra) && (
          <IconButton label="Close" onClick={beginClose}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
            <X size={18} />
          </IconButton>
        )}
        {(title || headerExtra) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.md,
            padding: `${space.lg} ${space.lg} ${space.base}`, borderBottom: `1px solid ${color.border}`,
          }}>
            <h2 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: color.text, margin: 0 }}>
              {title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
              {headerExtra}
              <IconButton label="Close" onClick={beginClose}><X size={18} /></IconButton>
            </div>
          </div>
        )}
        <div style={{ padding: padded ? space.lg : 0, overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: space.sm,
            padding: space.lg, borderTop: `1px solid ${color.border}`,
          }}>{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ----------------------------------------------------------------- Dropdown */

export function Dropdown({ trigger, children, align = 'left', width = 220 }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = align === 'right' ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8)); // keep within viewport
    setCoords({ top: r.bottom + 6, left });
  };

  const toggle = () => { if (!open) place(); setOpen((v) => !v); };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <span ref={triggerRef} style={{ display: 'inline-flex' }}>
      <span onClick={toggle}>{trigger}</span>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, width, zIndex: 3000,
            background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
            boxShadow: shadow.dropdown, padding: space.xs, transformOrigin: 'top',
            animation: 'trello-menu-in .14s cubic-bezier(0.16,1,0.3,1) both',
            maxHeight: '70vh', overflowY: 'auto',
          }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body,
      )}
    </span>
  );
}

export function MenuItem({ icon, danger, children, style, ...rest }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      style={{
        display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', textAlign: 'left',
        padding: '8px 12px', border: 'none', borderRadius: radius.base, cursor: 'pointer',
        background: hover ? color.surfaceAlt : 'transparent',
        color: danger ? color.danger : color.text, fontFamily: font.text, fontSize: 15, ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {icon && <span style={{ width: 16, textAlign: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div style={{ height: 1, background: color.border, margin: `${space.xs} 0` }} />;
}

/* ------------------------------------------------------------------ Tooltip */

export function Tooltip({ label, children, side = 'top' }) {
  const [show, setShow] = useState(false);
  const pos = side === 'top'
    ? { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }
    : { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' };
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && label && (
        <span style={{
          position: 'absolute', ...pos, zIndex: 300, whiteSpace: 'nowrap',
          background: '#091E42', color: '#FFFFFF', fontFamily: font.text,
          fontSize: 12, padding: '4px 8px', borderRadius: radius.base, pointerEvents: 'none',
        }}>{label}</span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------- EmptyState */

export function EmptyState({ icon, title, description, action, style }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: `${space.xxl} ${space.lg}`, color: color.navyLight, ...style,
    }}>
      {icon && <div style={{ fontSize: 40, marginBottom: space.base, opacity: 0.7 }}>{icon}</div>}
      {title && <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: color.navyMedium, marginBottom: space.xs }}>{title}</div>}
      {description && <div style={{ fontFamily: font.text, fontSize: 14, maxWidth: 360, lineHeight: '21px' }}>{description}</div>}
      {action && <div style={{ marginTop: space.lg }}>{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------- Toast */

const ToastContext = createContext(null);

const TOAST_KINDS = {
  success: { bg: '#1F845A', Icon: Check },
  error: { bg: '#C9372C', Icon: AlertCircle },
  warning: { bg: '#B38600', Icon: AlertTriangle },
  info: { bg: '#0C66E4', Icon: Info },
};

function ToastItem({ toast, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const k = TOAST_KINDS[toast.kind] ?? TOAST_KINDS.info;
  const { Icon } = k;

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onClose(toast.id), 180);
  }, [onClose, toast.id]);

  useEffect(() => {
    if (!toast.duration) return undefined;
    const t = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(t);
  }, [toast.duration, dismiss]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      style={{
        display: 'flex', alignItems: 'center', gap: space.md,
        background: k.bg, color: '#FFFFFF', fontFamily: font.text, fontSize: 14,
        padding: '12px 14px', borderRadius: radius.large, boxShadow: shadow.dropdown,
        minWidth: 280, maxWidth: 380, pointerEvents: 'auto',
        animation: `${leaving ? 'trello-slide-out' : 'trello-slide-in'} .16s cubic-bezier(0.16,1,0.3,1) forwards`,
      }}
    >
      <Icon size={18} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, lineHeight: '20px' }}>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={dismiss}
        style={{
          display: 'inline-flex', border: 'none', background: 'transparent',
          color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: 2, borderRadius: radius.base,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const duration = opts.duration === undefined ? 4000 : opts.duration;
    setToasts((t) => [...t, { id, message, kind: opts.kind ?? 'info', duration }]);
    return id;
  }, []);

  const value = useMemo(() => ({
    toast: push,
    push,
    dismiss: remove,
    success: (m, o) => push(m, { ...o, kind: 'success' }),
    error: (m, o) => push(m, { ...o, kind: 'error' }),
    info: (m, o) => push(m, { ...o, kind: 'info' }),
    warning: (m, o) => push(m, { ...o, kind: 'warning' }),
  }), [push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div style={{
          position: 'fixed', top: space.lg, right: space.lg, zIndex: 2000,
          display: 'flex', flexDirection: 'column', gap: space.sm,
          pointerEvents: 'none',
        }}>
          {toasts.map((t) => <ToastItem key={t.id} toast={t} onClose={remove} />)}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* ------------------------------------------------------------- ConfirmDialog */

export function ConfirmDialog({
  open, title = 'Are you sure?', message, confirmText = 'Confirm',
  cancelText = 'Cancel', danger = false, onConfirm, onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel} autoFocus>{cancelText}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmText}</Button>
        </>
      )}
    >
      {message && (
        <div style={{ fontFamily: font.text, fontSize: 14, lineHeight: '21px', color: color.textMuted }}>
          {message}
        </div>
      )}
    </Modal>
  );
}

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { opts, resolve }

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    setState({ opts, resolve });
  }), []);

  const close = useCallback((result) => {
    setState((s) => { s?.resolve(result); return null; });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!state}
        title={state?.opts.title}
        message={state?.opts.message}
        confirmText={state?.opts.confirmText}
        cancelText={state?.opts.cancelText}
        danger={state?.opts.danger}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

