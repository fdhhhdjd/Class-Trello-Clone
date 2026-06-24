import {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
} from 'react';
import { Sun, Moon } from 'lucide-react';
import { font } from './tokens';
import { IconButton } from './components.jsx';

const STORAGE_KEY = 'trello-theme';

// CSS-var definitions per theme. Names match tokens.js `var(--...)`.
const LIGHT = {
  'c-navy-deep': '#091E42',
  'c-navy-medium': '#172B4D',
  'c-navy-light': '#505F79',
  'c-blue': '#1868DB',
  'c-blue-bright': '#357DE8',
  'c-blue-dark': '#1558BC',
  'c-purple': '#A855F7',
  'c-cyan': '#06B6D4',
  'c-danger': '#C9372C',
  'c-success': '#4C6B1F',
  'c-error-bg': '#FFF5F4',
  'c-success-bg': '#E8F5E9',
  'c-white': '#FFFFFF',
  'c-off-white': '#F1F2F4',
  'c-light-gray': '#DCDFE4',
  'c-border': '#DDDEE1',
  'c-medium-gray': '#A9ABAF',
  'c-dark-gray': '#505258',
  'c-primary-badge-bg': '#E0ECFF',
  'c-text': '#091E42',
  'c-text-muted': '#505F79',
  'c-surface': '#FFFFFF',
  'c-surface-alt': '#F1F2F4',
  's-subtle': 'rgba(9, 30, 66, 0.13) 0px 1px 1px 0px',
  's-base': 'rgba(9, 30, 66, 0.15) 0px 8px 16px 0px',
  's-hover': 'rgba(9, 30, 66, 0.20) 0px 12px 24px 0px',
  's-modal': 'rgba(9, 30, 66, 0.47) 0px 8px 16px 0px',
  's-dropdown': 'rgba(9, 30, 66, 0.25) 0px 4px 12px 0px',
  'focus-ring': '0px 0px 0px 3px rgba(24, 104, 219, 0.15)',
  'scrollbar-thumb': 'rgba(9,30,66,0.2)',
  'scrollbar-thumb-hover': 'rgba(9,30,66,0.32)',
};

// Atlassian-dark inspired palette.
const DARK = {
  'c-navy-deep': '#B6C2CF',
  'c-navy-medium': '#C7D1DB',
  'c-navy-light': '#9FADBC',
  'c-blue': '#1868DB',
  'c-blue-bright': '#4C9AFF',
  'c-blue-dark': '#357DE8',
  'c-purple': '#B388FF',
  'c-cyan': '#42B2D7',
  'c-danger': '#F87168',
  'c-success': '#7EE2B8',
  'c-error-bg': '#42221F',
  'c-success-bg': '#1C3329',
  'c-white': '#22272B',
  'c-off-white': '#282E33',
  'c-light-gray': '#38414A',
  'c-border': '#2C333A',
  'c-medium-gray': '#738496',
  'c-dark-gray': '#9FADBC',
  'c-primary-badge-bg': '#1C2B41',
  'c-text': '#C7D1DB',
  'c-text-muted': '#9FADBC',
  'c-surface': '#22272B',
  'c-surface-alt': '#282E33',
  's-subtle': 'rgba(3, 4, 4, 0.36) 0px 1px 1px 0px',
  's-base': 'rgba(3, 4, 4, 0.50) 0px 8px 16px 0px',
  's-hover': 'rgba(3, 4, 4, 0.56) 0px 12px 24px 0px',
  's-modal': 'rgba(3, 4, 4, 0.70) 0px 8px 16px 0px',
  's-dropdown': 'rgba(3, 4, 4, 0.50) 0px 4px 12px 0px',
  'focus-ring': '0px 0px 0px 3px rgba(76, 154, 255, 0.30)',
  'scrollbar-thumb': 'rgba(166,173,186,0.25)',
  'scrollbar-thumb-hover': 'rgba(166,173,186,0.40)',
};

const toCss = (vars) => Object.entries(vars).map(([k, val]) => `--${k}: ${val};`).join('\n  ');

const ThemeContext = createContext(null);

function systemPref() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored() {
  if (typeof localStorage === 'undefined') return 'system';
  const t = localStorage.getItem(STORAGE_KEY);
  return t === 'light' || t === 'dark' || t === 'system' ? t : 'system';
}

export function ThemeProvider({ children, defaultTheme = 'system' }) {
  const [theme, setThemeState] = useState(() => {
    const stored = readStored();
    return stored ?? defaultTheme;
  });
  const [sysResolved, setSysResolved] = useState(systemPref);

  const resolved = theme === 'system' ? sysResolved : theme;

  // Track OS preference changes for 'system'.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSysResolved(mq.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Apply resolved theme to <html>.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolved;
    }
  }, [resolved]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  // Safe fallback so components work without a provider (light mode).
  if (!ctx) {
    return {
      theme: 'light',
      resolved: 'light',
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

export function ThemeToggle({ size = 32, style, ...rest }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <IconButton
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      size={size}
      onClick={toggle}
      style={style}
      {...rest}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  );
}

export function GlobalStyles() {
  return (
    <style>{`
      :root {
  ${toCss(LIGHT)}
      }
      [data-theme="dark"] {
  ${toCss(DARK)}
      }
      *, *::before, *::after { box-sizing: border-box; }
      html, body, #root { margin: 0; height: 100%; }
      body {
        font-family: ${font.text};
        font-size: 15px;
        line-height: 1.5;
        color: var(--c-text);
        background: var(--c-surface-alt);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
        transition: background-color .2s ease, color .2s ease;
      }
      a { color: var(--c-blue); text-decoration: none; }
      a:hover { color: var(--c-blue-bright); }
      button { font-family: inherit; }
      input, textarea, select { font-family: inherit; }
      ::placeholder { color: var(--c-medium-gray); }
      ::-webkit-scrollbar { height: 10px; width: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
      ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); background-clip: padding-box; }
      @keyframes trello-spin { to { transform: rotate(360deg); } }
      @keyframes trello-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      @keyframes trello-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes trello-fade-out { from { opacity: 1; } to { opacity: 0; } }
      @keyframes trello-pop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes trello-pop-out { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.97) translateY(4px); } }
      @keyframes trello-menu-in { from { opacity: 0; transform: scale(0.97) translateY(-6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes trello-slide-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes trello-slide-out { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(16px); } }
      @keyframes trello-panel-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes trello-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      /* Smooth interactions across both apps */
      button, a, [role="button"], input, textarea, select {
        transition: background-color .14s ease, border-color .14s ease, box-shadow .14s ease, color .14s ease, transform .12s ease, opacity .14s ease;
      }
      button:not(:disabled):active, [role="button"]:active { transform: translateY(1px); }
      .trello-enter { animation: trello-fade-up .26s ease-out both; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
        }
      }
    `}</style>
  );
}
