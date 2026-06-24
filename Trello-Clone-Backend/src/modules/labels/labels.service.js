import { prisma } from "../../config/db.js";
import { NotFound, Conflict } from "../../lib/errors.js";
import { assertBoardAccess } from "../boards/boards.service.js";
import { assertCardAccess } from "../cards/cards.service.js";

export async function listLabels(userId, boardId) {
  await assertBoardAccess(userId, boardId);
  return prisma.label.findMany({
    where: { boardId },
    select: { id: true, boardId: true, name: true, color: true },
  });
}

export async function createLabel(userId, boardId, input) {
  await assertBoardAccess(userId, boardId, "ws_member");
  return prisma.label.create({
    data: { boardId, name: input.name ?? null, color: input.color },
    select: { id: true, boardId: true, name: true, color: true },
  });
}

export async function updateLabel(userId, labelId, input) {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { boardId: true },
  });
  if (!label) throw NotFound("Label not found");
  await assertBoardAccess(userId, label.boardId, "ws_member");
  return prisma.label.update({
    where: { id: labelId },
    data: input,
    select: { id: true, boardId: true, name: true, color: true },
  });
}

export async function deleteLabel(userId, labelId) {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { boardId: true },
  });
  if (!label) throw NotFound("Label not found");
  await assertBoardAccess(userId, label.boardId, "ws_member");
  await prisma.label.delete({ where: { id: labelId } });
}

export async function attachLabel(userId, cardId, labelId) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { boardId: true },
  });
  if (!label || label.boardId !== card.boardId) {
    throw NotFound("Label not found on this board");
  }
  const existing = await prisma.cardLabel.findUnique({
    where: { cardId_labelId: { cardId, labelId } },
  });
  if (existing) throw Conflict("Label already attached");
  await prisma.cardLabel.create({ data: { cardId, labelId } });
  return { cardId, labelId };
}

export async function detachLabel(userId, cardId, labelId) {
  await assertCardAccess(userId, cardId, "ws_member");
  await prisma.cardLabel.deleteMany({ where: { cardId, labelId } });
}
