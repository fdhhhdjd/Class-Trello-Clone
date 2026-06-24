// Client-side board export to CSV / JSON via Blob download.

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function slug(name) {
  return (name || 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
}

// One row per card: list, title, description, labels, members, due, checklist done/total.
export function exportBoardCsv(board, lists, cards) {
  const listName = new Map(lists.map((l) => [l.id, l.name]));
  const header = ['List', 'Title', 'Description', 'Labels', 'Members', 'Due', 'Checklist'];
  const rows = cards.map((c) => {
    const labels = (c.labels ?? []).map((l) => l.name || l.color).join('; ');
    const members = (c.members ?? []).map((m) => m.name || m.email).join('; ');
    const due = c.dueDate ? new Date(c.dueDate).toISOString() : '';
    const cl = c.checklistSummary ?? c.checklist ?? { done: 0, total: 0 };
    const checklist = cl.total ? `${cl.done}/${cl.total}` : '';
    return [listName.get(c.listId) ?? '', c.title ?? '', c.description ?? '', labels, members, due, checklist];
  });
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  download(`${slug(board?.name)}.csv`, csv, 'text/csv;charset=utf-8');
}

// Full board structure as loaded (lists with nested cards).
export function exportBoardJson(board, lists, cards) {
  const byList = new Map(lists.map((l) => [l.id, []]));
  cards.forEach((c) => (byList.get(c.listId) ?? []).push(c));
  const payload = {
    id: board?.id,
    name: board?.name,
    description: board?.description ?? null,
    background: board?.background ?? null,
    labels: board?.labels ?? [],
    lists: lists.map((l) => ({ ...l, cards: byList.get(l.id) ?? [] })),
    exportedAt: new Date().toISOString(),
  };
  download(`${slug(board?.name)}.json`, JSON.stringify(payload, null, 2), 'application/json');
}
