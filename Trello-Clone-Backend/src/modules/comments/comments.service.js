import { prisma } from "../../config/db.js";
import { NotFound, Forbidden } from "../../lib/errors.js";
import { assertCardAccess } from "../cards/cards.service.js";
import { assertWorkspaceAccess } from "../workspaces/workspaces.service.js";
import { emitToBoard } from "../../realtime/index.js";
import { notify } from "../notifications/notifications.service.js";

const COMMENT_SELECT = {
  id: true,
  cardId: true,
  body: true,
  editedAt: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  reactions: { select: { emoji: true, userId: true } },
};

export async function listComments(userId, cardId) {
  await assertCardAccess(userId, cardId);
  return prisma.comment.findMany({
    where: { cardId },
    orderBy: { createdAt: "asc" },
    select: COMMENT_SELECT,
  });
}

export async function createComment(userId, cardId, input) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const comment = await prisma.comment.create({
    data: { cardId, authorId: userId, body: input.body },
    select: COMMENT_SELECT,
  });
  await prisma.activity.create({
    data: { boardId: card.boardId, cardId, actorId: userId, action: "comment.created" },
  });
  emitToBoard(card.boardId, "comment:created", comment);

  const base = {
    cardId,
    boardId: card.boardId,
    commentId: comment.id,
    authorId: userId,
    body: input.body.slice(0, 280),
  };

  // Mentioned users must have workspace access; notify them with "mention".
  const mentioned = new Set();
  for (const mid of input.mentions ?? []) {
    if (mid === userId || mentioned.has(mid)) continue;
    const ok = await assertWorkspaceAccess(mid, card.workspaceId).then(() => true).catch(() => false);
    if (ok) {
      mentioned.add(mid);
      notify(mid, "mention", base);
    }
  }

  // Notify card members (except the author and anyone already mentioned).
  const members = await prisma.cardMember.findMany({
    where: { cardId, userId: { not: userId } },
    select: { userId: true },
  });
  for (const m of members) {
    if (mentioned.has(m.userId)) continue;
    notify(m.userId, "comment", base);
  }
  return comment;
}

async function loadCommentWithScope(commentId) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      cardId: true,
      card: { select: { list: { select: { boardId: true, board: { select: { workspaceId: true } } } } } },
    },
  });
  if (!comment) throw NotFound("Comment not found");
  return comment;
}

export async function updateComment(userId, commentId, input) {
  const comment = await loadCommentWithScope(commentId);
  await assertWorkspaceAccess(userId, comment.card.list.board.workspaceId);
  if (comment.authorId !== userId) throw Forbidden("Only the author can edit this comment");

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body: input.body, editedAt: new Date() },
    select: COMMENT_SELECT,
  });
  emitToBoard(comment.card.list.boardId, "comment:updated", updated);
  return updated;
}

export async function deleteComment(userId, commentId) {
  const comment = await loadCommentWithScope(commentId);
  const role = await assertWorkspaceAccess(userId, comment.card.list.board.workspaceId);
  const isAdmin = role === "ws_admin" || role === "ws_owner";
  if (comment.authorId !== userId && !isAdmin) {
    throw Forbidden("Only the author or an admin can delete this comment");
  }
  await prisma.comment.delete({ where: { id: commentId } });
  emitToBoard(comment.card.list.boardId, "comment:deleted", { id: commentId, cardId: comment.cardId });
}
