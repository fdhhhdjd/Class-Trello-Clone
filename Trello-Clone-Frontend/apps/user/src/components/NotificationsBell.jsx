import { useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import {
  IconButton, Dropdown, Spinner, EmptyState, useToast,
  color, font, space, radius,
} from '@trello/ui';
import {
  useNotifications, useUnreadCount, useMarkNotificationRead,
  useMarkAllRead, useDeleteNotification,
} from '../lib/userData';
import { useUserSocket } from '../lib/socket';

function notifText(n) {
  const p = n.payload ?? {};
  const title = p.title ? `"${p.title}"` : 'a card';
  switch (n.type) {
    case 'mention': return `You were mentioned on ${title}`;
    case 'comment': return `New comment on ${title}`;
    case 'assigned': return `You were assigned to ${title}`;
    case 'due_soon': return `${title} is due soon`;
    case 'invite': return 'You were invited to a workspace';
    case 'card.updated': return `${title} was updated`;
    default: break;
  }
  if (p.message) return p.message;
  if (p.title) return p.title;
  return (n.type || 'notification').replace(/[:_.]/g, ' ');
}

export function NotificationsBell({ enabled }) {
  const toast = useToast();
  const { data, isLoading } = useNotifications();
  const countQ = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const remove = useDeleteNotification();

  const onNew = useCallback((n) => {
    toast.info(notifText(n), { duration: 3000 });
  }, [toast]);
  useUserSocket(enabled, onNew);

  const items = data?.items ?? [];
  const unread = countQ.data ?? data?.unreadCount ?? 0;

  return (
    <Dropdown
      align="right"
      width={340}
      trigger={
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconButton label="Notifications"><Bell size={18} /></IconButton>
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16,
              padding: '0 4px', borderRadius: radius.pill, background: color.danger,
              color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: font.text,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{unread > 99 ? '99+' : unread}</span>
          )}
        </span>
      }
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: `1px solid ${color.border}`,
        }}>
          <span style={{ fontFamily: font.display, fontWeight: 600, fontSize: 15, color: color.text }}>
            Notifications
          </span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none',
                background: 'transparent', cursor: 'pointer', color: color.blue,
                fontFamily: font.text, fontSize: 12,
              }}
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>

        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: space.lg }}>
              <Spinner size={20} />
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <EmptyState icon={<Bell size={32} />} title="No notifications" description="You are all caught up." />
          )}
          {!isLoading && items.map((n) => (
            <div
              key={n.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: space.sm, padding: '10px 12px',
                background: n.read ? 'transparent' : color.primaryBadgeBg,
                borderBottom: `1px solid ${color.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: font.text, fontSize: 13, color: color.text, lineHeight: '18px' }}>
                  {notifText(n)}
                </div>
                {n.createdAt && (
                  <div style={{ fontFamily: font.text, fontSize: 11, color: color.textMuted, marginTop: 2 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
              {!n.read && (
                <IconButton label="Mark read" size={26} onClick={() => markRead.mutate(n.id)}>
                  <Check size={14} />
                </IconButton>
              )}
              <IconButton label="Delete" size={26} onClick={() => remove.mutate(n.id)}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      </div>
    </Dropdown>
  );
}
