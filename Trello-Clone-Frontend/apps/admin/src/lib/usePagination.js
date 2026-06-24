import { useCallback, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const KEY = (pageKey) => `admin.pageSize.${pageKey}`;

function readSize(pageKey, fallback) {
  try {
    const v = Number(localStorage.getItem(KEY(pageKey)));
    return PAGE_SIZE_OPTIONS.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function usePagination(pageKey, defaultSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(() => readSize(pageKey, defaultSize));

  const setPageSize = useCallback((next) => {
    const n = Number(next);
    if (!PAGE_SIZE_OPTIONS.includes(n)) return;
    setPageSizeState(n);
    setPage(1);
    try { localStorage.setItem(KEY(pageKey), String(n)); } catch { /* ignore */ }
  }, [pageKey]);

  const reset = useCallback(() => setPage(1), []);

  return { page, setPage, pageSize, setPageSize, reset };
}
