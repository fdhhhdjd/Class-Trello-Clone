const KEY = 'recent-boards';
const CAP = 8;

export function getRecentBoards() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setRecentBoards(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(Array.isArray(arr) ? arr : [])); } catch { /* ignore */ }
}

export function removeRecentBoard(id) {
  try { setRecentBoards(getRecentBoards().filter((b) => b.id !== id)); } catch { /* ignore */ }
}

export function recordRecentBoard(board) {
  if (!board?.id) return;
  try {
    const entry = {
      id: board.id,
      name: board.name ?? 'Board',
      workspaceId: board.workspaceId ?? null,
      background: board.background ?? null,
      at: Date.now(),
    };
    const next = [entry, ...getRecentBoards().filter((b) => b.id !== board.id)].slice(0, CAP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
