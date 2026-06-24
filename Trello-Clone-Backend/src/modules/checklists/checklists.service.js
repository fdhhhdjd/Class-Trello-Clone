import { prisma } from "../../config/db.js";
import { NotFound } from "../../lib/errors.js";
import { assertCardAccess } from "../cards/cards.service.js";
import { assertWorkspaceAccess } from "../workspaces/workspaces.service.js";
import { endPosition } from "../../lib/position.js";
import { emitToBoard } from "../../realtime/index.js";

const CHECKLIST_SELECT = { id: true, cardId: true, title: true, position: true };
const ITEM_SELECT = { id: true, checklistId: true, text: true, done: true, position: true };

export async function createChecklist(userId, cardId, input) {
  await assertCardAccess(userId, cardId, "ws_member");
  const max = await prisma.checklist.aggregate({
    where: { cardId },
    _max: { position: true },
  });
  return prisma.checklist.create({
    data: { cardId, title: input.title, position: endPosition(max._max.position) },
    select: CHECKLIST_SELECT,
  });
}

async function loadChecklistScope(checklistId) {
  const cl = await prisma.checklist.findUnique({
    where: { id: checklistId },
    select: {
      id: true,
      cardId: true,
      card: { select: { list: { select: { board: { select: { workspaceId: true } } } } } },
    },
  });
  if (!cl) throw NotFound("Checklist not found");
  return cl;
}

export async function updateChecklist(userId, checklistId, input) {
  const cl = await loadChecklistScope(checklistId);
  await assertWorkspaceAccess(userId, cl.card.list.board.workspaceId, "ws_member");
  return prisma.checklist.update({
    where: { id: checklistId },
    data: input,
    select: CHECKLIST_SELECT,
  });
}

export async function deleteChecklist(userId, checklistId) {
  const cl = await loadChecklistScope(checklistId);
  await assertWorkspaceAccess(userId, cl.card.list.board.workspaceId, "ws_member");
  await prisma.checklist.delete({ where: { id: checklistId } });
}

export async function createItem(userId, checklistId, input) {
  const cl = await loadChecklistScope(checklistId);
  await assertWorkspaceAccess(userId, cl.card.list.board.workspaceId, "ws_member");
  const max = await prisma.checklistItem.aggregate({
    where: { checklistId },
    _max: { position: true },
  });
  return prisma.checklistItem.create({
    data: { checklistId, text: input.text, position: endPosition(max._max.position) },
    select: ITEM_SELECT,
  });
}

async function loadItemScope(itemId) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      checklist: {
        select: { card: { select: { list: { select: { board: { select: { workspaceId: true } } } } } } },
      },
    },
  });
  if (!item) throw NotFound("Checklist item not found");
  return item;
}

export async function updateItem(userId, itemId, input) {
  const item = await loadItemScope(itemId);
  await assertWorkspaceAccess(userId, item.checklist.card.list.board.workspaceId, "ws_member");
  return prisma.checklistItem.update({ where: { id: itemId }, data: input, select: ITEM_SELECT });
}

export async function deleteItem(userId, itemId) {
  const item = await loadItemScope(itemId);
  await assertWorkspaceAccess(userId, item.checklist.card.list.board.workspaceId, "ws_member");
  await prisma.checklistItem.delete({ where: { id: itemId } });
}

// Turn a checklist item into a new card in the same list, then remove the item.
export async function convertItemToCard(userId, itemId) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      text: true,
      checklist: { select: { card: { select: { list: { select: { id: true, boardId: true, board: { select: { workspaceId: true } } } } } } } },
    },
  });
  if (!item) throw NotFound("Checklist item not found");
  const list = item.checklist.card.list;
  await assertWorkspaceAccess(userId, list.board.workspaceId, "ws_member");

  const max = await prisma.card.aggregate({ where: { listId: list.id }, _max: { position: true } });
  const card = await prisma.$transaction(async (tx) => {
    const seq = await tx.board.update({ where: { id: list.boardId }, data: { cardSeq: { increment: 1 } }, select: { cardSeq: true } });
    const c = await tx.card.create({
      data: { listId: list.id, title: item.text, position: endPosition(max._max.position), number: seq.cardSeq },
      select: { id: true, listId: true, number: true, title: true, description: true, position: true, dueDate: true, startDate: true, coverUrl: true, archived: true, createdAt: true },
    });
    await tx.activity.create({ data: { boardId: list.boardId, cardId: c.id, actorId: userId, action: "card.created", metadata: { title: c.title, from: "checklist" } } });
    await tx.checklistItem.delete({ where: { id: itemId } });
    return c;
  });
  emitToBoard(list.boardId, "card:created", card);
  return { card, deletedItemId: itemId };
}
