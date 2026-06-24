import { prisma } from "../../config/db.js";
import { NotFound } from "../../lib/errors.js";
import { emitToUser } from "../../realtime/index.js";
import { enqueueEmail } from "../../queues/email.queue.js";
import { emailEnabled } from "../../lib/notifyPrefs.js";

const NOTIF_SELECT = {
  id: true,
  type: true,
  payload: true,
  read: true,
  createdAt: true,
};

// Notification types that also trigger an email (when the user hasn't opted out).
const EMAIL_TYPES = new Set(["assigned", "invite"]);

// Best-effort: create a notification, push it over the socket, and optionally
// enqueue an email. Never throws to caller.
export async function notify(userId, type, payload) {
  if (!userId) return;
  try {
    const n = await prisma.notification.create({
      data: { userId, type, payload },
      select: NOTIF_SELECT,
    });
    emitToUser(userId, "notification:new", n);

    if (EMAIL_TYPES.has(type)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, settings: true },
      });
      if (user?.email && emailEnabled(user.settings, type)) {
        enqueueEmail({ to: user.email, kind: type, data: payload ?? {} });
      }
    }
  } catch (e) {
    console.error("notify failed:", e);
  }
}

export async function listNotifications(userId, { unread, page, pageSize }) {
  const where = { userId, ...(unread ? { read: false } : {}) };
  const [data, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: NOTIF_SELECT,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { data, total, unreadCount };
}

export async function unreadCount(userId) {
  const count = await prisma.notification.count({ where: { userId, read: false } });
  return { count };
}

export async function markRead(userId, id) {
  const n = await prisma.notification.findUnique({ where: { id }, select: { userId: true } });
  if (!n || n.userId !== userId) throw NotFound("Notification not found");
  return prisma.notification.update({ where: { id }, data: { read: true }, select: NOTIF_SELECT });
}

export async function markAllRead(userId) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return { updated: count };
}

export async function deleteNotification(userId, id) {
  const n = await prisma.notification.findUnique({ where: { id }, select: { userId: true } });
  if (!n || n.userId !== userId) throw NotFound("Notification not found");
  await prisma.notification.delete({ where: { id } });
}
