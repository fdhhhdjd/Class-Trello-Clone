import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
    });
  }
  return socket;
}

// Join board room and invalidate react-query cache on realtime events.
// Degrades gracefully when the socket server is absent.
export function useBoardSocket(boardId) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!boardId) return undefined;
    const s = getSocket();

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] });
      qc.invalidateQueries({ queryKey: ['lists', boardId] });
      qc.invalidateQueries({ queryKey: ['cards', boardId] });
    };
    const events = [
      'card:created', 'card:updated', 'card:moved', 'card:deleted',
      'list:created', 'list:updated', 'list:deleted', 'comment:created',
      'attachment:created', 'attachment:deleted',
    ];

    const join = () => s.emit('board:join', { boardId });
    if (s.connected) join();
    s.on('connect', join);
    events.forEach((ev) => s.on(ev, invalidate));

    return () => {
      s.emit('board:leave', { boardId });
      s.off('connect', join);
      events.forEach((ev) => s.off(ev, invalidate));
    };
  }, [boardId, qc]);
}

// Listen for `notification:new` (server auto-joins the user:<id> room on connect).
// Live-updates the notifications list + unread badge, optional subtle toast.
export function useUserSocket(enabled, onNew) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;
    const s = getSocket();

    const handle = (notification) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      onNew?.(notification);
    };

    s.on('notification:new', handle);
    return () => { s.off('notification:new', handle); };
  }, [enabled, qc, onNew]);
}
