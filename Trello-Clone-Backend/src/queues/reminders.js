import { Queue, Worker } from "bullmq";
import { queueConnection } from "./connection.js";
import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import { notify } from "../modules/notifications/notifications.service.js";
import { enqueueEmail } from "./email.queue.js";
import { emailEnabled } from "../lib/notifyPrefs.js";

export const REMINDERS_QUEUE = "reminders";

export const remindersQueue = new Queue(REMINDERS_QUEUE, { connection: queueConnection });

// Schedule the recurring "scan due cards" job (every hour, idempotent).
export async function scheduleReminders() {
  await remindersQueue.add(
    "scan-due",
    {},
    { repeat: { every: 60 * 60 * 1000 }, jobId: "scan-due", removeOnComplete: true, removeOnFail: true },
  );
}

// Find cards due within the next 24h and remind their members + watchers once.
async function scanDueCards() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const cards = await prisma.card.findMany({
    where: { archived: false, dueDate: { gte: now, lte: in24h } },
    select: {
      id: true,
      title: true,
      dueDate: true,
      list: { select: { boardId: true } },
      members: { select: { userId: true } },
      watchers: { select: { userId: true } },
    },
  });

  for (const card of cards) {
    const flag = `reminded:${card.id}`;
    if (await redis.get(flag)) continue;
    const ttl = Math.max(60, Math.ceil((new Date(card.dueDate).getTime() - now.getTime()) / 1000) + 3600);
    await redis.set(flag, "1", "EX", ttl);

    const userIds = new Set([
      ...card.members.map((m) => m.userId),
      ...card.watchers.map((w) => w.userId),
    ]);
    const boardId = card.list.boardId;
    for (const userId of userIds) {
      notify(userId, "due_soon", { cardId: card.id, boardId, title: card.title, dueDate: card.dueDate });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, settings: true } });
      if (user?.email && emailEnabled(user.settings, "due_soon")) {
        enqueueEmail({ to: user.email, kind: "due_soon", data: { cardId: card.id, boardId, title: card.title, dueLabel: "within 24h" } });
      }
    }
  }
  return { scanned: cards.length };
}

export function startRemindersWorker() {
  const worker = new Worker(REMINDERS_QUEUE, async () => scanDueCards(), {
    connection: queueConnection,
  });
  worker.on("failed", (job, err) => console.error("reminders job failed:", job?.id, err.message));
  return worker;
}
