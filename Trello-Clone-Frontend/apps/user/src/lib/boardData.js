import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@trello/ui';
import { api } from './api';

function unwrap(data) {
  if (Array.isArray(data)) return data;
  const items = data?.items ?? data?.data;
  return Array.isArray(items) ? items : [];
}

// GET /boards/:id returns the full nested payload {..., lists:[{...,cards:[]}], labels:[]}.
export function useBoard(boardId) {
  return useQuery({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const res = await api.get(`/boards/${boardId}`);
      return res.data ?? null;
    },
    enabled: !!boardId,
  });
}

// Derive flat lists + cards from the board payload, falling back to separate fetches.
export function useBoardData(boardId) {
  const boardQ = useBoard(boardId);
  const nested = Array.isArray(boardQ.data?.lists);

  const listsQ = useQuery({
    queryKey: ['lists', boardId],
    queryFn: async () => {
      const res = await api.get('/lists', { params: { boardId } });
      return unwrap(res.data);
    },
    enabled: !!boardId && !nested && !boardQ.isLoading,
  });

  const cardsQ = useQuery({
    queryKey: ['cards', boardId],
    queryFn: async () => {
      const res = await api.get('/cards', { params: { boardId } });
      return unwrap(res.data);
    },
    enabled: !!boardId && !nested && !boardQ.isLoading,
  });

  const { lists, cards } = useMemo(() => {
    if (nested) {
      const ls = [...boardQ.data.lists].sort((a, b) => a.position - b.position);
      const cs = [];
      ls.forEach((l) => (l.cards ?? []).forEach((c) => cs.push({ ...c, listId: c.listId ?? l.id })));
      return { lists: ls.map(({ cards: _c, ...l }) => l), cards: cs };
    }
    return {
      lists: [...(listsQ.data ?? [])].sort((a, b) => a.position - b.position),
      cards: [...(cardsQ.data ?? [])].sort((a, b) => a.position - b.position),
    };
  }, [nested, boardQ.data, listsQ.data, cardsQ.data]);

  return {
    board: boardQ.data,
    lists: lists.filter((l) => !l.archived),
    cards: cards.filter((c) => !c.archived),
    labels: boardQ.data?.labels ?? [],
    isLoading: boardQ.isLoading || (!nested && (listsQ.isLoading || cardsQ.isLoading)),
    isError: boardQ.isError || (!nested && (listsQ.isError || cardsQ.isError)),
    notFound: boardQ.error?.response?.status === 404 || boardQ.error?.response?.status === 403,
  };
}

function invalidateBoard(qc, boardId) {
  qc.invalidateQueries({ queryKey: ['board', boardId] });
  qc.invalidateQueries({ queryKey: ['lists', boardId] });
  qc.invalidateQueries({ queryKey: ['cards', boardId] });
}

/* --------------------------------------------------------------------- List */

export function useCreateList(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ name, position }) => api.post('/lists', { boardId, name, position }),
    onSuccess: () => { toast.success('List added.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not create list.'),
  });
}

export function useUpdateList(boardId, opts = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ listId, patch }) => api.patch(`/lists/${listId}`, patch),
    onSuccess: () => {
      if (opts.successMessage !== null) toast.success(opts.successMessage ?? 'List updated.');
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not update list.'),
  });
}

export function useDeleteList(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (listId) => api.delete(`/lists/${listId}`),
    onSuccess: () => { toast.success('List deleted.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not delete list.'),
  });
}

export function useMoveList(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ listId, position }) => api.patch(`/lists/${listId}`, { position }),
    onMutate: async ({ listId, position }) => {
      await qc.cancelQueries({ queryKey: ['board', boardId] });
      await qc.cancelQueries({ queryKey: ['lists', boardId] });
      const prevBoard = qc.getQueryData(['board', boardId]);
      const prevLists = qc.getQueryData(['lists', boardId]);
      const bump = (l) => (l.id === listId ? { ...l, position } : l);
      if (prevBoard?.lists) {
        qc.setQueryData(['board', boardId], (old) => ({ ...old, lists: old.lists.map(bump) }));
      }
      if (prevLists) qc.setQueryData(['lists', boardId], (old) => (old ?? []).map(bump));
      return { prevBoard, prevLists };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevBoard) qc.setQueryData(['board', boardId], ctx.prevBoard);
      if (ctx?.prevLists) qc.setQueryData(['lists', boardId], ctx.prevLists);
      toast.error('Could not reorder list.');
    },
    onSettled: () => invalidateBoard(qc, boardId),
  });
}

/* --------------------------------------------------------------------- Card */

export function useCreateCard(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ listId, title, position }) => api.post('/cards', { listId, title, position }),
    onSuccess: () => { toast.success('Card added.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not add card.'),
  });
}

export function useMoveCard(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ cardId, listId, position }) =>
      api.patch(`/cards/${cardId}/move`, { listId, position }),
    onMutate: async ({ cardId, listId, position }) => {
      await qc.cancelQueries({ queryKey: ['cards', boardId] });
      await qc.cancelQueries({ queryKey: ['board', boardId] });
      const prevCards = qc.getQueryData(['cards', boardId]);
      const prevBoard = qc.getQueryData(['board', boardId]);
      const patchCard = (c) => (c.id === cardId ? { ...c, listId, position } : c);
      if (prevCards) qc.setQueryData(['cards', boardId], (old) => (old ?? []).map(patchCard));
      if (prevBoard?.lists) {
        qc.setQueryData(['board', boardId], (old) => {
          const moved = old.lists.flatMap((l) => l.cards ?? []).find((c) => c.id === cardId);
          if (!moved) return old;
          const updated = { ...moved, listId, position };
          return {
            ...old,
            lists: old.lists.map((l) => ({
              ...l,
              cards: l.id === listId
                ? [...(l.cards ?? []).filter((c) => c.id !== cardId), updated]
                : (l.cards ?? []).filter((c) => c.id !== cardId),
            })),
          };
        });
      }
      return { prevCards, prevBoard };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevCards) qc.setQueryData(['cards', boardId], ctx.prevCards);
      if (ctx?.prevBoard) qc.setQueryData(['board', boardId], ctx.prevBoard);
      toast.error('Could not move card.');
    },
    onSettled: () => invalidateBoard(qc, boardId),
  });
}

export function useUpdateCard(boardId, opts = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ cardId, patch }) => api.patch(`/cards/${cardId}`, patch),
    onSuccess: () => {
      if (opts.successMessage !== null) toast.success(opts.successMessage ?? 'Card saved.');
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not save changes.'),
  });
}

export function useDeleteCard(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (cardId) => api.delete(`/cards/${cardId}`),
    onSuccess: () => { toast.success('Card deleted.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not delete card.'),
  });
}

export function useDuplicateCard(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (cardId) => api.post(`/cards/${cardId}/duplicate`),
    onSuccess: () => { toast.success('Card duplicated.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not duplicate card.'),
  });
}

export function useWatchCard(cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (watching) => api.put(`/cards/${cardId}/watch`, { watching }),
    onSuccess: (_r, watching) => {
      toast.success(watching ? 'Watching card.' : 'Stopped watching.');
      qc.invalidateQueries({ queryKey: ['card', cardId] });
    },
    onError: () => toast.error('Could not update watch.'),
  });
}

// Apply one of {move, label, archive} across many cards via existing endpoints.
export function useBulkCardActions(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({ action, cardIds, listId, position, labelId }) => {
      const run = (id) => {
        if (action === 'move') return api.patch(`/cards/${id}/move`, { listId, position });
        if (action === 'label') return api.post(`/cards/${id}/labels`, { labelId });
        if (action === 'archive') return api.patch(`/cards/${id}`, { archived: true });
        return Promise.reject(new Error('unknown action'));
      };
      const results = await Promise.allSettled(cardIds.map(run));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      return { ok, total: cardIds.length };
    },
    onSuccess: ({ ok, total }) => {
      toast[ok === total ? 'success' : 'error'](`${ok}/${total} card${total > 1 ? 's' : ''} updated.`);
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Bulk action failed.'),
  });
}

export function useCopyList(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (listId) => api.post(`/lists/${listId}/copy`),
    onSuccess: () => { toast.success('List copied.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not copy list.'),
  });
}

export function useArchiveListCards(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (listId) => api.post(`/lists/${listId}/archive-cards`),
    onSuccess: () => { toast.success('Cards archived.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not archive cards.'),
  });
}

export function useMoveListToBoard(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ listId, targetBoardId }) => api.post(`/lists/${listId}/move`, { targetBoardId }),
    onSuccess: () => { toast.success('List moved.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not move list.'),
  });
}

export function useSortList(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ listId, by }) => api.post(`/lists/${listId}/sort`, { by }),
    onSuccess: () => { toast.success('List sorted.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not sort list.'),
  });
}

export function useCardDetail(cardId) {
  return useQuery({
    queryKey: ['card', cardId],
    queryFn: async () => {
      const res = await api.get(`/cards/${cardId}`);
      return res.data ?? null;
    },
    enabled: !!cardId,
  });
}

/* ------------------------------------------------------------------ Comments */

export function useComments(cardId) {
  return useQuery({
    queryKey: ['comments', cardId],
    queryFn: async () => {
      const res = await api.get(`/cards/${cardId}/comments`);
      return unwrap(res.data);
    },
    enabled: !!cardId,
  });
}

export function useAddComment(cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ body, mentions }) => api.post(`/cards/${cardId}/comments`, { body, mentions }),
    onSuccess: () => { toast.success('Comment added.'); qc.invalidateQueries({ queryKey: ['comments', cardId] }); },
    onError: () => toast.error('Could not add comment.'),
  });
}

export function useEditComment(cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ commentId, body }) => api.patch(`/comments/${commentId}`, { body }),
    onSuccess: () => { toast.success('Comment updated.'); qc.invalidateQueries({ queryKey: ['comments', cardId] }); },
    onError: () => toast.error('Could not edit comment.'),
  });
}

export function useDeleteComment(cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (commentId) => api.delete(`/comments/${commentId}`),
    onSuccess: () => { toast.success('Comment deleted.'); qc.invalidateQueries({ queryKey: ['comments', cardId] }); },
    onError: () => toast.error('Could not delete comment.'),
  });
}

/* ---------------------------------------------------------------- Checklist */

export function useToggleChecklistItem(cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ itemId, done }) => api.patch(`/checklist-items/${itemId}`, { done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card', cardId] }),
    onError: () => toast.error('Could not update item.'),
  });
}

export function useAddChecklistItem(cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ checklistId, text }) => api.post(`/checklists/${checklistId}/items`, { text }),
    onSuccess: () => { toast.success('Item added.'); qc.invalidateQueries({ queryKey: ['card', cardId] }); },
    onError: () => toast.error('Could not add item.'),
  });
}

export function useDeleteChecklistItem(cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (itemId) => api.delete(`/checklist-items/${itemId}`),
    onSuccess: () => { toast.success('Item deleted.'); qc.invalidateQueries({ queryKey: ['card', cardId] }); },
    onError: () => toast.error('Could not delete item.'),
  });
}

export function useConvertChecklistItem(cardId, boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (itemId) => api.post(`/checklist-items/${itemId}/convert-to-card`),
    onSuccess: () => {
      toast.success('Converted to card.');
      qc.invalidateQueries({ queryKey: ['card', cardId] });
      if (boardId) invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not convert item.'),
  });
}

export function useToggleReaction(cardId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId: cId, commentId, emoji }) => api.post('/reactions/toggle', { cardId: cId, commentId, emoji }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] });
      qc.invalidateQueries({ queryKey: ['comments', cardId] });
    },
  });
}

/* -------------------------------------------------------------- Attachments */

export function useAttachments(cardId) {
  return useQuery({
    queryKey: ['attachments', cardId],
    queryFn: async () => {
      const res = await api.get(`/cards/${cardId}/attachments`);
      return unwrap(res.data);
    },
    enabled: !!cardId,
  });
}

// Presign -> PUT to MinIO -> create row. Reports via toast.
export function useUploadAttachment(boardId, cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (file) => {
      const presignRes = await api.post(`/cards/${cardId}/attachments/presign`, {
        filename: file.name, contentType: file.type, size: file.size,
      });
      const { uploadUrl, key, fileUrl } = presignRes.data;
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: file.type ? { 'Content-Type': file.type } : {},
        body: file,
      });
      const res = await api.post(`/cards/${cardId}/attachments`, {
        key, filename: file.name, size: file.size, mime: file.type, fileUrl,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Attachment uploaded.');
      qc.invalidateQueries({ queryKey: ['attachments', cardId] });
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not upload attachment.'),
  });
}

export function useDeleteAttachment(boardId, cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (attachmentId) => api.delete(`/attachments/${attachmentId}`),
    onSuccess: () => {
      toast.success('Attachment removed.');
      qc.invalidateQueries({ queryKey: ['attachments', cardId] });
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not remove attachment.'),
  });
}

export function useDownloadAttachment() {
  const toast = useToast();
  return useMutation({
    mutationFn: (attachmentId) => api.get(`/attachments/${attachmentId}/download`),
    onSuccess: (res) => {
      const url = res.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
    },
    onError: () => toast.error('Could not download attachment.'),
  });
}

/* ----------------------------------------------------------------- Activity */

export function useCardActivity(cardId) {
  return useQuery({
    queryKey: ['activity', cardId],
    queryFn: async () => {
      const res = await api.get(`/cards/${cardId}/activity`);
      return unwrap(res.data);
    },
    enabled: !!cardId,
  });
}

/* ------------------------------------------------------------------- Labels */

export function useAddCardLabel(boardId, cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (labelId) => api.post(`/cards/${cardId}/labels`, { labelId }),
    onSuccess: () => {
      toast.success('Label added.');
      qc.invalidateQueries({ queryKey: ['card', cardId] });
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not add label.'),
  });
}

export function useRemoveCardLabel(boardId, cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (labelId) => api.delete(`/cards/${cardId}/labels/${labelId}`),
    onSuccess: () => {
      toast.success('Label removed.');
      qc.invalidateQueries({ queryKey: ['card', cardId] });
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not remove label.'),
  });
}

/* ------------------------------------------------------------ Board members */

export function useBoardMembers(boardId) {
  return useQuery({
    queryKey: ['board-members', boardId],
    queryFn: async () => unwrap((await api.get(`/boards/${boardId}/members`)).data),
    enabled: !!boardId,
  });
}

export function useWorkspaceMembers(workspaceId) {
  return useQuery({
    queryKey: ['ws-members', workspaceId],
    queryFn: async () => unwrap((await api.get(`/workspaces/${workspaceId}/members`)).data),
    enabled: !!workspaceId,
  });
}

export function useAddBoardMember(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ userId, role }) => api.post(`/boards/${boardId}/members`, { userId, role }),
    onSuccess: () => { toast.success('Member added.'); qc.invalidateQueries({ queryKey: ['board-members', boardId] }); },
    onError: () => toast.error('Could not add member.'),
  });
}

export function useUpdateBoardMember(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ userId, role }) => api.patch(`/boards/${boardId}/members/${userId}`, { role }),
    onSuccess: () => { toast.success('Role updated.'); qc.invalidateQueries({ queryKey: ['board-members', boardId] }); },
    onError: () => toast.error('Could not update role.'),
  });
}

export function useRemoveBoardMember(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (userId) => api.delete(`/boards/${boardId}/members/${userId}`),
    onSuccess: () => { toast.success('Member removed.'); qc.invalidateQueries({ queryKey: ['board-members', boardId] }); },
    onError: () => toast.error('Could not remove member.'),
  });
}

/* ------------------------------------------------------------- Card members */

export function useAddCardMember(boardId, cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (userId) => api.post(`/cards/${cardId}/members`, { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] });
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not add member.'),
  });
}

export function useRemoveCardMember(boardId, cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (userId) => api.delete(`/cards/${cardId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] });
      invalidateBoard(qc, boardId);
    },
    onError: () => toast.error('Could not remove member.'),
  });
}

/* ------------------------------------------------------------- Custom fields */

export function useCreateField(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input) => api.post(`/boards/${boardId}/custom-fields`, input),
    onSuccess: () => { toast.success('Field created.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not create field.'),
  });
}

export function useUpdateField(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ fieldId, patch }) => api.patch(`/custom-fields/${fieldId}`, patch),
    onSuccess: () => { toast.success('Field updated.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not update field.'),
  });
}

export function useDeleteField(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (fieldId) => api.delete(`/custom-fields/${fieldId}`),
    onSuccess: () => { toast.success('Field deleted.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not delete field.'),
  });
}

export function useSetCardFieldValue(boardId, cardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ fieldId, value }) => api.put(`/cards/${cardId}/fields/${fieldId}`, { value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['card', cardId] }); },
    onError: () => toast.error('Could not save field value.'),
  });
}

export function useCreateBoardLabel(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ name, color }) => api.post(`/boards/${boardId}/labels`, { name, color }),
    onSuccess: () => { toast.success('Label created.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not create label.'),
  });
}

export function useUpdateBoardLabel(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ labelId, patch }) => api.patch(`/labels/${labelId}`, patch),
    onSuccess: () => { toast.success('Label updated.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not update label.'),
  });
}

export function useDeleteBoardLabel(boardId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (labelId) => api.delete(`/labels/${labelId}`),
    onSuccess: () => { toast.success('Label deleted.'); invalidateBoard(qc, boardId); },
    onError: () => toast.error('Could not delete label.'),
  });
}
