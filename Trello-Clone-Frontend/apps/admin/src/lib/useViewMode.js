import { useCallback, useState } from 'react';

const KEY = (pageKey) => `admin.viewMode.${pageKey}`;
const VALID = new Set(['list', 'matrix', 'detail']);

export function useViewMode(pageKey, fallback = 'list') {
  const [mode, setModeState] = useState(() => {
    try {
      const v = localStorage.getItem(KEY(pageKey));
      return VALID.has(v) ? v : fallback;
    } catch {
      return fallback;
    }
  });

  const setMode = useCallback((next) => {
    if (!VALID.has(next)) return;
    setModeState(next);
    try { localStorage.setItem(KEY(pageKey), next); } catch { /* ignore */ }
  }, [pageKey]);

  return [mode, setMode];
}
