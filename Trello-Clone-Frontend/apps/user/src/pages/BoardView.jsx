import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Plus, MoreHorizontal, Pencil, Image, Archive, ArchiveRestore, Trash2, AlertTriangle,
  Filter as FilterIcon, X, FileText, Tag as TagIcon, Users, SlidersHorizontal, CalendarDays,
  CheckSquare, MoveRight, Copy, Download, LayoutGrid, Table as TableIcon, LayoutTemplate,
} from 'lucide-react';
import {
  Button, Input, Textarea, Modal, Skeleton, EmptyState, IconButton, Dropdown, MenuItem, LabelChip, Avatar, useConfirm,
  color, font, radius, shadow, space, boardBackgrounds,
} from '@trello/ui';
import {
  useBoardData, useCreateList, useUpdateList, useDeleteList, useMoveList,
  useCreateCard, useMoveCard, useSortList, useBulkCardActions,
  useCopyList, useArchiveListCards, useMoveListToBoard,
} from '../lib/boardData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUpdateBoard, useDeleteBoard, useCopyBoard } from '../lib/wsData';
import { exportBoardCsv, exportBoardJson } from '../lib/exportBoard';
import { BoardTable } from '../components/BoardTable';
import { useBoardSocket } from '../lib/socket';
import { midpoint } from '../lib/position';
import { ListColumn } from '../components/ListColumn';
import { useHotkeys, isTyping } from '../lib/useHotkeys';
import { CardTile } from '../components/CardTile';
import { CardModal } from '../components/CardModal';
import { LabelsManager } from '../components/LabelsManager';
import { BoardMembers } from '../components/BoardMembers';
import { CustomFieldsManager } from '../components/CustomFieldsManager';
import { recordRecentBoard, removeRecentBoard } from '../lib/recentBoards';
import { getSavedFilters, saveFilter, deleteFilter } from '../lib/savedFilters';
import { Bookmark, Star } from 'lucide-react';

const EMPTY_FILTER = { text: '', labelIds: [], memberIds: [], due: '' };

function dueBucket(dueDate) {
  if (!dueDate) return 'none';
  const d = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (day < today) return 'overdue';
  if (day.getTime() === today.getTime()) return 'today';
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  if (day <= weekEnd) return 'week';
  return 'later';
}

function matchesFilter(card, f) {
  if (f.text && !card.title?.toLowerCase().includes(f.text.toLowerCase())) return false;
  if (f.labelIds.length) {
    const ids = new Set((card.labels ?? []).map((l) => l.id));
    if (!f.labelIds.some((id) => ids.has(id))) return false;
  }
  if (f.memberIds.length) {
    const ids = new Set((card.members ?? []).map((m) => m.id));
    if (!f.memberIds.some((id) => ids.has(id))) return false;
  }
  if (f.due) {
    const bucket = dueBucket(card.dueDate);
    if (f.due === 'none' && bucket !== 'none') return false;
    if (f.due === 'overdue' && bucket !== 'overdue') return false;
    if (f.due === 'today' && bucket !== 'today') return false;
    if (f.due === 'week' && !['overdue', 'today', 'week'].includes(bucket)) return false;
  }
  return true;
}

export function BoardView() {
  const { boardId = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  useBoardSocket(boardId);

  const { board, lists, cards, isLoading, isError, notFound } = useBoardData(boardId);
  const [filter, setFilter] = useState(EMPTY_FILTER);

  // Board deleted / no access: drop it from recents so it stops showing up.
  useEffect(() => { if (notFound && boardId) removeRecentBoard(boardId); }, [notFound, boardId]);
  const activeFilterCount =
    (filter.text ? 1 : 0) + filter.labelIds.length + filter.memberIds.length + (filter.due ? 1 : 0);

  const boardMembers = useMemo(() => {
    const m = new Map();
    cards.forEach((c) => (c.members ?? []).forEach((u) => m.set(u.id, u)));
    return [...m.values()];
  }, [cards]);

  const visibleCards = useMemo(
    () => (activeFilterCount ? cards.filter((c) => matchesFilter(c, filter)) : cards),
    [cards, filter, activeFilterCount],
  );
  const createList = useCreateList(boardId);
  const renameList = useUpdateList(boardId, { successMessage: 'List renamed.' });
  const archiveList = useUpdateList(boardId, { successMessage: 'List archived.' });
  const deleteList = useDeleteList(boardId);
  const moveList = useMoveList(boardId);
  const createCard = useCreateCard(boardId);
  const moveCard = useMoveCard(boardId);
  const sortList = useSortList(boardId);
  const copyList = useCopyList(boardId);
  const archiveListCards = useArchiveListCards(boardId);
  const setWip = useUpdateList(boardId, { successMessage: 'WIP limit updated.' });
  const moveListToBoard = useMoveListToBoard(boardId);
  const updateBoard = useUpdateBoard(board?.workspaceId);
  const deleteBoard = useDeleteBoard(board?.workspaceId);
  const copyBoard = useCopyBoard(board?.workspaceId);

  const [view, setView] = useState(() => {
    try { return localStorage.getItem(`board-view:${boardId}`) || 'board'; } catch { return 'board'; }
  });
  useEffect(() => {
    try { localStorage.setItem(`board-view:${boardId}`, view); } catch { /* ignore */ }
  }, [view, boardId]);

  useEffect(() => {
    if (board?.id) recordRecentBoard(board);
  }, [board?.id, board?.name, board?.background]);

  const [activeCard, setActiveCard] = useState(null);
  const [activeList, setActiveList] = useState(null);
  const [openCard, setOpenCard] = useState(null);
  const [addingList, setAddingList] = useState(false);
  const [listName, setListName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [bgOpen, setBgOpen] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileRef = useRef(null);
  const [descOpen, setDescOpen] = useState(false);
  const [boardDesc, setBoardDesc] = useState('');
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [composerListId, setComposerListId] = useState(null);
  const [moveListTarget, setMoveListTarget] = useState(null);
  const [tmplList, setTmplList] = useState(null);
  const qc = useQueryClient();
  const otherBoardsQ = useQuery({
    queryKey: ['boards', board?.workspaceId],
    queryFn: async () => (await api.get('/boards', { params: { workspaceId: board.workspaceId } })).data,
    enabled: !!moveListTarget && !!board?.workspaceId,
  });
  const cardTemplatesQ = useQuery({
    queryKey: ['card-templates', boardId],
    queryFn: async () => (await api.get(`/boards/${boardId}/card-templates`)).data,
    enabled: !!tmplList,
  });
  const useCardTemplate = async (templateId) => {
    try {
      await api.post(`/cards/${templateId}/duplicate`, { listId: tmplList.id });
      qc.invalidateQueries({ queryKey: ['board', boardId] });
      qc.invalidateQueries({ queryKey: ['cards', boardId] });
      setTmplList(null);
    } catch { /* toast handled globally */ }
  };
  const bulk = useBulkCardActions(boardId);

  useHotkeys((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping()) return;
    if (e.key === 'c' || e.key === 'C') {
      const first = lists[0];
      if (first) { e.preventDefault(); setComposerListId(first.id); }
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      document.querySelector('[data-board-filter]')?.click();
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      navigate('/');
    }
  });

  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelect = () => { setSelectMode(false); clearSelection(); };
  const selectedArr = useMemo(() => [...selectedIds], [selectedIds]);

  const bulkMove = (listId) => {
    const dest = cardsByList.get(listId) ?? [];
    const last = dest.length ? dest[dest.length - 1].position : null;
    bulk.mutate(
      { action: 'move', cardIds: selectedArr, listId, position: midpoint(last, null) },
      { onSuccess: exitSelect },
    );
  };
  const bulkLabel = (labelId) => bulk.mutate(
    { action: 'label', cardIds: selectedArr, labelId },
    { onSuccess: exitSelect },
  );
  const bulkArchive = async () => {
    const ok = await confirm({
      title: `Archive ${selectedArr.length} card${selectedArr.length > 1 ? 's' : ''}?`,
      message: 'Archived cards are hidden from the board.', confirmText: 'Archive',
    });
    if (ok) bulk.mutate({ action: 'archive', cardIds: selectedArr }, { onSuccess: exitSelect });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cardsByList = useMemo(() => {
    const map = new Map();
    lists.forEach((l) => map.set(l.id, []));
    visibleCards.forEach((c) => {
      const arr = map.get(c.listId) ?? [];
      arr.push(c);
      map.set(c.listId, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [lists, visibleCards]);

  // Open a card from the ?card=<id> query param (e.g. navigated from search).
  useEffect(() => {
    const cardId = searchParams.get('card');
    if (cardId && cards.length) {
      const c = cards.find((x) => x.id === cardId);
      if (c) {
        setOpenCard(c);
        searchParams.delete('card');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, cards, setSearchParams]);

  const findCard = (id) => cards.find((c) => c.id === id) ?? null;
  const listIdFromSortable = (id) => String(id).replace(/^list:/, '');

  const onDragStart = (e) => {
    const id = String(e.active.id);
    if (id.startsWith('list:')) {
      setActiveList(lists.find((l) => l.id === listIdFromSortable(id)) ?? null);
    } else {
      setActiveCard(findCard(id));
    }
  };

  const onDragEnd = (e) => {
    const wasList = !!activeList;
    setActiveCard(null);
    setActiveList(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);

    // List reorder.
    if (activeId.startsWith('list:')) {
      const fromId = listIdFromSortable(activeId);
      const overId = listIdFromSortable(String(over.id));
      if (fromId === overId) return;
      const ordered = lists.filter((l) => l.id !== fromId);
      let index = ordered.findIndex((l) => l.id === overId);
      if (index < 0) index = ordered.length;
      const before = index > 0 ? ordered[index - 1].position : null;
      const after = index < ordered.length ? ordered[index].position : null;
      moveList.mutate({ listId: fromId, position: midpoint(before, after) });
      return;
    }
    if (wasList) return;

    // Card move.
    const card = findCard(activeId);
    if (!card) return;
    const overData = over.data.current;
    const targetListId = overData?.listId ?? card.listId;
    const overCard = overData?.type === 'card' ? findCard(String(over.id)) : null;

    const dest = (cardsByList.get(targetListId) ?? []).filter((c) => c.id !== card.id);
    let index = dest.length;
    if (overCard) index = dest.findIndex((c) => c.id === overCard.id);
    if (index < 0) index = dest.length;

    const before = index > 0 ? dest[index - 1].position : null;
    const after = index < dest.length ? dest[index].position : null;
    const position = midpoint(before, after);

    if (card.listId === targetListId && card.position === position) return;
    moveCard.mutate({ cardId: card.id, listId: targetListId, position });
  };

  const submitList = (e) => {
    e.preventDefault();
    const name = listName.trim();
    if (!name) return;
    const last = lists.length ? lists[lists.length - 1].position : null;
    createList.mutate({ name, position: midpoint(last, null) });
    setListName('');
    setAddingList(false);
  };

  const addCard = (listId, title) => {
    const dest = cardsByList.get(listId) ?? [];
    const last = dest.length ? dest[dest.length - 1].position : null;
    createCard.mutate({ listId, title, position: midpoint(last, null) });
  };

  const onSortList = (listId, by) => sortList.mutate({ listId, by });
  const onCopyList = (listId) => copyList.mutate(listId);
  const onSetWip = (list) => {
    const cur = list.wipLimit ? String(list.wipLimit) : '';
    const v = window.prompt('Giới hạn số card (WIP). Để trống = bỏ giới hạn:', cur);
    if (v === null) return;
    const n = v.trim() === '' ? null : Math.max(0, parseInt(v, 10) || 0);
    setWip.mutate({ listId: list.id, patch: { wipLimit: n } });
  };
  const onMoveList = (list) => setMoveListTarget(list);
  const onArchiveListCards = async (list) => {
    const ok = await confirm({
      title: 'Archive all cards?', message: `All cards in "${list.name}" will be archived.`,
      confirmText: 'Archive',
    });
    if (ok) archiveListCards.mutate(list.id);
  };
  const onRenameList = (listId, name) => renameList.mutate({ listId, patch: { name } });
  const onArchiveList = (listId) => archiveList.mutate({ listId, patch: { archived: true } });
  const onDeleteList = async (list) => {
    const ok = await confirm({
      title: 'Delete list?', message: `"${list.name}" and its cards will be removed. This cannot be undone.`,
      confirmText: 'Delete', danger: true,
    });
    if (ok) deleteList.mutate(list.id);
  };

  const submitBoardRename = (e) => {
    e.preventDefault();
    const n = boardName.trim();
    if (n) updateBoard.mutate({ id: boardId, patch: { name: n } }, { onSuccess: () => setRenameOpen(false) });
  };
  const onArchiveBoard = () => updateBoard.mutate({ id: boardId, patch: { archived: !board?.archived } });
  const onDeleteBoard = async () => {
    const ok = await confirm({
      title: 'Delete board?', message: `"${board?.name}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete', danger: true,
    });
    if (ok) deleteBoard.mutate(boardId, { onSuccess: () => navigate('/') });
  };
  const onCopyBoard = () => {
    const name = window.prompt('Name for the copied board', `${board?.name ?? 'Board'} (copy)`);
    if (name == null) return;
    copyBoard.mutate({ id: boardId, name: name.trim() || undefined }, {
      onSuccess: (res) => { const id = res?.data?.id; if (id) navigate(`/b/${id}`); },
    });
  };
  const pickBg = (bg) => updateBoard.mutate({ id: boardId, patch: { background: bg } }, { onSuccess: () => setBgOpen(false) });
  const onPickBgImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setBgUploading(true);
    try {
      const { data } = await api.post(`/boards/${boardId}/background-image`, { filename: file.name, contentType: file.type });
      await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      pickBg(`url("${data.fileUrl}") center / cover no-repeat`);
    } finally {
      setBgUploading(false);
    }
  };
  const submitBoardDesc = (e) => {
    e.preventDefault();
    updateBoard.mutate({ id: boardId, patch: { description: boardDesc.trim() || null } }, { onSuccess: () => setDescOpen(false) });
  };

  const bg = board?.background || 'linear-gradient(135deg, #0079BF 0%, #5067C5 100%)';

  return (
    <div style={{ height: '100%', minHeight: '100%', background: bg, backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: space.base,
        background: 'rgba(0,0,0,0.18)', flexShrink: 0,
      }}>
        <Link to="/" style={{ color: '#fff', fontSize: 14, opacity: 0.9 }}>Boards</Link>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>/</span>
        <h1 style={{ fontFamily: font.display, fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
          {board?.name ?? 'Board'}
        </h1>
        <span style={{ flex: 1 }} />
        {board && (
          <Link to={`/b/${boardId}/calendar`} style={{ color: '#fff', textDecoration: 'none' }}>
            <Button variant="secondary" size="sm" leftIcon={<CalendarDays size={15} />}
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none' }}>
              Calendar
            </Button>
          </Link>
        )}
        {board && (
          <Button
            variant="secondary" size="sm" leftIcon={<CheckSquare size={15} />}
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            style={{ background: selectMode ? color.blue : 'rgba(255,255,255,0.18)', color: '#fff', border: 'none' }}
          >
            {selectMode ? 'Done' : 'Select'}
          </Button>
        )}
        {board && (
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.18)', borderRadius: radius.base, padding: 2 }}>
            <button onClick={() => setView('board')} aria-label="Board view" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', border: 'none',
              borderRadius: radius.base, cursor: 'pointer', fontFamily: font.text, fontSize: 13, color: '#fff',
              background: view === 'board' ? 'rgba(255,255,255,0.25)' : 'transparent',
            }}>
              <LayoutGrid size={14} /> Board
            </button>
            <button onClick={() => setView('table')} aria-label="Table view" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', border: 'none',
              borderRadius: radius.base, cursor: 'pointer', fontFamily: font.text, fontSize: 13, color: '#fff',
              background: view === 'table' ? 'rgba(255,255,255,0.25)' : 'transparent',
            }}>
              <TableIcon size={14} /> Table
            </button>
          </div>
        )}
        {board && (
          <FilterBar
            boardId={boardId}
            filter={filter}
            setFilter={setFilter}
            labels={board.labels ?? []}
            members={boardMembers}
            count={activeFilterCount}
            onClear={() => setFilter(EMPTY_FILTER)}
          />
        )}
        {board && (
          <Dropdown
            align="right" width={190}
            trigger={<IconButton label="Board actions" style={{ color: '#fff', background: 'rgba(255,255,255,0.18)' }}><MoreHorizontal size={18} /></IconButton>}
          >
            <MenuItem icon={<Pencil size={16} />} onClick={() => { setBoardName(board.name); setRenameOpen(true); }}>Rename</MenuItem>
            <MenuItem icon={<FileText size={16} />} onClick={() => { setBoardDesc(board.description ?? ''); setDescOpen(true); }}>Edit description</MenuItem>
            <MenuItem icon={<Image size={16} />} onClick={() => setBgOpen(true)}>Change background</MenuItem>
            <MenuItem icon={<TagIcon size={16} />} onClick={() => setLabelsOpen(true)}>Manage labels</MenuItem>
            <MenuItem icon={<Users size={16} />} onClick={() => setMembersOpen(true)}>Members</MenuItem>
            <MenuItem icon={<SlidersHorizontal size={16} />} onClick={() => setFieldsOpen(true)}>Custom fields</MenuItem>
            <MenuItem icon={<Copy size={16} />} onClick={onCopyBoard}>Copy board</MenuItem>
            <MenuItem icon={<LayoutTemplate size={16} />} onClick={() => updateBoard.mutate({ id: boardId, patch: { isTemplate: !board.isTemplate } })}>
              {board.isTemplate ? 'Remove from templates' : 'Save as template'}
            </MenuItem>
            <MenuItem icon={<Download size={16} />} onClick={() => exportBoardCsv(board, lists, cards)}>Export CSV</MenuItem>
            <MenuItem icon={<Download size={16} />} onClick={() => exportBoardJson(board, lists, cards)}>Export JSON</MenuItem>
            <MenuItem icon={board.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />} onClick={onArchiveBoard}>
              {board.archived ? 'Unarchive' : 'Archive'}
            </MenuItem>
            <MenuItem icon={<Trash2 size={16} />} danger onClick={onDeleteBoard}>Delete board</MenuItem>
          </Dropdown>
        )}
      </div>

      {isLoading && <BoardSkeleton />}

      {isError && !isLoading && (
        <EmptyState icon={<AlertTriangle size={36} />}
          title={notFound ? 'Board không tồn tại' : 'Could not load board'}
          description={notFound ? 'Board này đã bị xoá hoặc bạn không có quyền truy cập.' : 'The board may be unavailable or the backend is offline.'}
          style={{ color: '#fff' }}
          action={<Button onClick={() => navigate('/')}>Về Workspaces</Button>} />
      )}

      {!isLoading && !isError && view === 'table' && (
        <BoardTable lists={lists} cards={visibleCards} onCardClick={(c) => setOpenCard(c)} />
      )}

      {!isLoading && !isError && view === 'board' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div style={{
            display: 'flex', gap: space.base, padding: '20px 24px 24px',
            overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-start', flex: 1, minHeight: 0,
          }}>
            <SortableContext items={lists.map((l) => `list:${l.id}`)} strategy={horizontalListSortingStrategy}>
              {lists.map((l) => (
                <ListColumn
                  key={l.id}
                  list={l}
                  cards={cardsByList.get(l.id) ?? []}
                  onAddCard={addCard}
                  onCardClick={(c) => setOpenCard(c)}
                  onRename={onRenameList}
                  onArchive={onArchiveList}
                  onDelete={onDeleteList}
                  onSort={onSortList}
                  onCopy={onCopyList}
                  onArchiveCards={onArchiveListCards}
                  onSetWip={onSetWip}
                  onMove={onMoveList}
                  onAddFromTemplate={setTmplList}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  openComposer={composerListId === l.id}
                  onComposerHandled={() => setComposerListId(null)}
                />
              ))}
            </SortableContext>

            <div style={{ width: 296, flexShrink: 0 }}>
              {addingList ? (
                <form onSubmit={submitList} style={{
                  background: color.surface, borderRadius: radius.large, padding: space.md,
                  display: 'flex', flexDirection: 'column', gap: space.sm, boxShadow: shadow.base,
                }}>
                  <Input autoFocus placeholder="Enter list name…" value={listName} onChange={(e) => setListName(e.target.value)} />
                  <div style={{ display: 'flex', gap: space.sm }}>
                    <Button type="submit" size="sm" loading={createList.isPending}>Add list</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingList(false); setListName(''); }}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setAddingList(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: space.base, border: 'none', background: 'rgba(255,255,255,0.24)', color: '#fff',
                    borderRadius: radius.large, cursor: 'pointer', fontSize: 15, fontFamily: font.text, fontWeight: 600,
                  }}
                >
                  <Plus size={16} /> Add {lists.length ? 'another list' : 'a list'}
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeCard && <CardTile card={activeCard} overlay />}
            {activeList && (
              <div style={{
                width: 296, background: color.surfaceAlt, borderRadius: radius.large, padding: space.md,
                boxShadow: shadow.hover, fontFamily: font.text, fontWeight: 600, fontSize: 15, color: color.text,
              }}>
                {activeList.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <Modal
        open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename board" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button onClick={submitBoardRename} loading={updateBoard.isPending} disabled={!boardName.trim()}>Save</Button>
        </>}
      >
        <form onSubmit={submitBoardRename}>
          <Input label="Board name" autoFocus value={boardName} onChange={(e) => setBoardName(e.target.value)} />
        </form>
      </Modal>

      <Modal
        open={descOpen} onClose={() => setDescOpen(false)} title="Board description" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setDescOpen(false)}>Cancel</Button>
          <Button onClick={submitBoardDesc} loading={updateBoard.isPending}>Save</Button>
        </>}
      >
        <form onSubmit={submitBoardDesc}>
          <Textarea autoFocus value={boardDesc} onChange={(e) => setBoardDesc(e.target.value)}
            placeholder="Add a description for this board…" style={{ minHeight: 120 }} />
        </form>
      </Modal>

      <Modal open={bgOpen} onClose={() => setBgOpen(false)} title="Change background" size="sm">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: space.sm }}>
          {boardBackgrounds.map((b) => (
            <button key={b} onClick={() => pickBg(b)}
              style={{ height: 56, borderRadius: radius.large, background: b, border: `1px solid ${color.border}`, cursor: 'pointer' }}
              aria-label="Pick background" />
          ))}
        </div>
        <div style={{ marginTop: space.base, display: 'flex', alignItems: 'center', gap: space.sm }}>
          <Button variant="secondary" leftIcon={<Image size={16} />} loading={bgUploading} onClick={() => bgFileRef.current?.click()}>
            Tải ảnh của bạn
          </Button>
          {board?.background?.startsWith('url(') && (
            <Button variant="ghost" onClick={() => pickBg(boardBackgrounds[0])}>Bỏ ảnh</Button>
          )}
          <input ref={bgFileRef} type="file" accept="image/*" onChange={onPickBgImage} style={{ display: 'none' }} />
        </div>
        <p style={{ marginTop: space.sm, fontSize: 12, color: color.textMuted }}>PNG/JPG. Ảnh sẽ phủ kín nền board.</p>
      </Modal>

      <Modal open={!!moveListTarget} onClose={() => setMoveListTarget(null)} title={`Move "${moveListTarget?.name ?? ''}" to board`} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          {otherBoardsQ.isLoading && <Skeleton height={36} />}
          {(otherBoardsQ.data ?? []).filter((b) => b.id !== boardId).map((b) => (
            <button key={b.id} onClick={() => { moveListToBoard.mutate({ listId: moveListTarget.id, targetBoardId: b.id }); setMoveListTarget(null); }}
              style={{ textAlign: 'left', padding: '10px 12px', border: `1px solid ${color.border}`, borderRadius: radius.base, background: color.surface, cursor: 'pointer', fontSize: 14, color: color.text }}>
              {b.name}
            </button>
          ))}
          {otherBoardsQ.data && otherBoardsQ.data.filter((b) => b.id !== boardId).length === 0 && (
            <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>No other board in this workspace.</p>
          )}
        </div>
      </Modal>

      <Modal open={!!tmplList} onClose={() => setTmplList(null)} title={`Add card from template → ${tmplList?.name ?? ''}`} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          {cardTemplatesQ.isLoading && <Skeleton height={36} />}
          {(cardTemplatesQ.data ?? []).map((t) => (
            <button key={t.id} onClick={() => useCardTemplate(t.id)}
              style={{ textAlign: 'left', padding: '10px 12px', border: `1px solid ${color.border}`, borderRadius: radius.base, background: color.surface, cursor: 'pointer', fontSize: 14, color: color.text }}>
              {t.title}
            </button>
          ))}
          {cardTemplatesQ.data && cardTemplatesQ.data.length === 0 && (
            <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>No card templates. Open a card → "Save as template".</p>
          )}
        </div>
      </Modal>

      <LabelsManager open={labelsOpen} onClose={() => setLabelsOpen(false)} boardId={boardId} labels={board?.labels ?? []} />
      <BoardMembers open={membersOpen} onClose={() => setMembersOpen(false)} boardId={boardId} workspaceId={board?.workspaceId} />
      <CustomFieldsManager open={fieldsOpen} onClose={() => setFieldsOpen(false)} boardId={boardId} fields={board?.customFields ?? []} />

      {selectMode && selectedArr.length > 0 && (
        <BulkActionBar
          count={selectedArr.length}
          lists={lists}
          labels={board?.labels ?? []}
          busy={bulk.isPending}
          onMove={bulkMove}
          onLabel={bulkLabel}
          onArchive={bulkArchive}
          onClear={clearSelection}
        />
      )}

      <CardModal card={openCard} boardId={boardId} board={board} onClose={() => setOpenCard(null)} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div style={{ display: 'flex', gap: space.base, padding: '20px 24px 24px', flex: 1, minHeight: 0, alignItems: 'flex-start', overflow: 'hidden' }}>
      {[4, 2, 3].map((n, li) => (
        <div key={li} style={{ width: 296, flexShrink: 0, background: color.surface, borderRadius: radius.large, padding: space.md, display: 'flex', flexDirection: 'column', gap: space.sm }}>
          <Skeleton width="55%" height={16} style={{ marginBottom: space.xs }} />
          {Array.from({ length: n }).map((_, ci) => (
            <Skeleton key={ci} height={56} radius={radius.base} />
          ))}
        </div>
      ))}
      <div style={{ width: 296, flexShrink: 0 }}>
        <Skeleton height={44} radius={radius.large} style={{ background: 'rgba(255,255,255,0.5)' }} />
      </div>
    </div>
  );
}

function BulkActionBar({ count, lists, labels, busy, onMove, onLabel, onArchive, onClear }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 50,
      display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center',
      maxWidth: 'calc(100vw - 32px)', padding: '10px 14px', borderRadius: radius.large,
      background: color.surface, border: `1px solid ${color.border}`, boxShadow: shadow.hover,
    }}>
      <span style={{ fontFamily: font.text, fontSize: 14, fontWeight: 600, color: color.text }}>
        {count} selected
      </span>
      <Dropdown
        width={220}
        trigger={<Button variant="secondary" size="sm" leftIcon={<MoveRight size={15} />} disabled={busy}>Move to list</Button>}
      >
        {lists.length === 0 && <MenuItem disabled>No lists</MenuItem>}
        {lists.map((l) => (
          <MenuItem key={l.id} onClick={() => onMove(l.id)}>{l.name}</MenuItem>
        ))}
      </Dropdown>
      <Dropdown
        width={220}
        trigger={<Button variant="secondary" size="sm" leftIcon={<TagIcon size={15} />} disabled={busy}>Add label</Button>}
      >
        {labels.length === 0 && <MenuItem disabled>No labels</MenuItem>}
        {labels.map((l) => (
          <MenuItem key={l.id} onClick={() => onLabel(l.id)}>
            <LabelChip color={l.color} name={l.name} />
          </MenuItem>
        ))}
      </Dropdown>
      <Button variant="secondary" size="sm" leftIcon={<Archive size={15} />} loading={busy} onClick={onArchive}>
        Archive
      </Button>
      <Button variant="ghost" size="sm" leftIcon={<X size={15} />} onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

const DUE_OPTIONS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'Due this week' },
  { key: 'none', label: 'No due date' },
];

function FilterBar({ boardId, filter, setFilter, labels, members, count, onClear }) {
  const [saved, setSaved] = useState(() => getSavedFilters(boardId));
  const [savingName, setSavingName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const toggle = (field, id) => setFilter((f) => {
    const set = new Set(f[field]);
    if (set.has(id)) set.delete(id); else set.add(id);
    return { ...f, [field]: [...set] };
  });

  const onSave = () => {
    const name = savingName.trim();
    if (!name) return;
    setSaved(saveFilter(boardId, name, filter));
    setSavingName('');
    setShowSave(false);
  };
  const onApply = (f) => setFilter({ ...EMPTY_FILTER, ...f });
  const onDelete = (id) => setSaved(deleteFilter(boardId, id));

  const heading = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: color.textMuted, margin: '10px 0 6px' };

  return (
    <Dropdown
      align="right"
      width={280}
      trigger={
        <button data-board-filter style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
          border: 'none', borderRadius: radius.base, cursor: 'pointer', fontFamily: font.text, fontSize: 14,
          color: '#fff', background: count ? color.blue : 'rgba(255,255,255,0.18)',
        }}>
          <FilterIcon size={15} /> Filter
          {count > 0 && (
            <span style={{
              background: '#fff', color: color.blue, borderRadius: radius.pill, fontSize: 11,
              fontWeight: 700, padding: '0 6px', lineHeight: '16px',
            }}>{count}</span>
          )}
        </button>
      }
    >
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '4px 12px 12px', maxHeight: 420, overflowY: 'auto' }}>
        <div style={{ ...heading, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Bookmark size={12} /> Saved filters</span>
          {count > 0 && (
            <button onClick={() => setShowSave((v) => !v)} style={{
              border: 'none', background: 'transparent', color: color.blue, cursor: 'pointer',
              fontFamily: font.text, fontSize: 11, fontWeight: 700, padding: 0,
            }}>
              {showSave ? 'Cancel' : 'Save current'}
            </button>
          )}
        </div>
        {showSave && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <Input placeholder="Filter name" value={savingName} onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSave()} wrapStyle={{ flex: 1 }} />
            <Button size="sm" onClick={onSave} disabled={!savingName.trim()}>Save</Button>
          </div>
        )}
        {saved.length === 0 ? (
          <div style={{ fontSize: 12, color: color.textMuted, marginBottom: 4 }}>
            {count > 0 ? 'Click "Save current" to store this filter.' : 'No saved filters yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
            {saved.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => onApply(s.filter)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: space.sm, border: 'none', cursor: 'pointer',
                  background: 'transparent', borderRadius: radius.base, padding: '5px 6px',
                  fontFamily: font.text, fontSize: 13, color: color.text, textAlign: 'left',
                }}>
                  <Star size={13} color={color.textMuted} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </button>
                <IconButton label="Delete saved filter" size={24} onClick={() => onDelete(s.id)}><X size={13} /></IconButton>
              </div>
            ))}
          </div>
        )}

        <div style={heading}>Keyword</div>
        <Input placeholder="Filter cards…" value={filter.text} onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))} />

        {labels.length > 0 && (
          <>
            <div style={heading}>Labels</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {labels.map((l) => {
                const on = filter.labelIds.includes(l.id);
                return (
                  <button key={l.id} onClick={() => toggle('labelIds', l.id)} style={{
                    border: on ? `2px solid ${color.blue}` : `2px solid transparent`,
                    background: 'transparent', borderRadius: radius.base, padding: 0, cursor: 'pointer',
                  }}>
                    <LabelChip color={l.color} name={l.name} />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {members.length > 0 && (
          <>
            <div style={heading}>Members</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {members.map((m) => {
                const on = filter.memberIds.includes(m.id);
                return (
                  <button key={m.id} onClick={() => toggle('memberIds', m.id)} style={{
                    display: 'flex', alignItems: 'center', gap: space.sm, border: 'none', cursor: 'pointer',
                    background: on ? color.surfaceAlt : 'transparent', borderRadius: radius.base, padding: '4px 6px',
                    fontFamily: font.text, fontSize: 13, color: color.text, textAlign: 'left',
                  }}>
                    <input type="checkbox" readOnly checked={on} />
                    <Avatar name={m.name} email={m.email} src={m.avatarUrl} size={24} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.email}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={heading}>Due date</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {DUE_OPTIONS.map((o) => (
            <button key={o.key} onClick={() => setFilter((f) => ({ ...f, due: f.due === o.key ? '' : o.key }))} style={{
              display: 'flex', alignItems: 'center', gap: space.sm, border: 'none', cursor: 'pointer',
              background: filter.due === o.key ? color.surfaceAlt : 'transparent', borderRadius: radius.base,
              padding: '6px', fontFamily: font.text, fontSize: 13, color: color.text, textAlign: 'left',
            }}>
              <input type="radio" readOnly checked={filter.due === o.key} /> {o.label}
            </button>
          ))}
        </div>

        {count > 0 && (
          <Button variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={onClear} style={{ marginTop: 10, width: '100%' }}>
            Clear filters
          </Button>
        )}
      </div>
    </Dropdown>
  );
}
