import { prisma } from "../../config/db.js";
import { NotFound, BadRequest } from "../../lib/errors.js";
import { assertCardAccess } from "../cards/cards.service.js";
import { emitToBoard } from "../../realtime/index.js";

// Toggle an emoji reaction on a card or a comment. Returns the target's
// updated reaction list. Any workspace member of the card's board may react.
export async function toggleReaction(userId, { cardId, commentId, emoji }) {
  if (!emoji || (!cardId && !commentId)) throw BadRequest("emoji and cardId or commentId required");

  let resolvedCardId = cardId ?? null;
  if (commentId) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { cardId: true } });
    if (!comment) throw NotFound("Comment not found");
    resolvedCardId = comment.cardId;
  }
  const { card } = await assertCardAccess(userId, resolvedCardId);

  const where = commentId
    ? { commentId, userId, emoji }
    : { cardId, userId, emoji };
  const existing = await prisma.reaction.findFirst({ where, select: { id: true } });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { cardId: cardId ?? null, commentId: commentId ?? null, userId, emoji } });
  }

  const reactions = await prisma.reaction.findMany({
    where: commentId ? { commentId } : { cardId },
    select: { emoji: true, userId: true },
  });
  emitToBoard(card.boardId, "card:reaction", { cardId: resolvedCardId, commentId: commentId ?? null });
  return { cardId: cardId ?? null, commentId: commentId ?? null, reactions };
}
