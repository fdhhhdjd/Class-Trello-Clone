const key = (boardId) => `saved-filters:${boardId}`;

export function getSavedFilters(boardId) {
  if (!boardId) return [];
  try {
    const arr = JSON.parse(localStorage.getItem(key(boardId)) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveFilter(boardId, name, filter) {
  if (!boardId || !name) return getSavedFilters(boardId);
  const entry = { id: `${Date.now()}`, name, filter };
  const next = [...getSavedFilters(boardId), entry];
  try { localStorage.setItem(key(boardId), JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

export function deleteFilter(boardId, id) {
  const next = getSavedFilters(boardId).filter((f) => f.id !== id);
  try { localStorage.setItem(key(boardId), JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}
