import { prisma } from "../../config/db.js";
import { NotFound } from "../../lib/errors.js";
import { assertBoardAccess } from "../boards/boards.service.js";
import { endPosition, POSITION_STEP } from "../../lib/position.js";
import { emitToBoard } from "../../realtime/index.js";

const LIST_SELECT = { id: true, boardId: true, name: true, position: true, wipLimit: true, archived: true };

async function loadList(listId) {
  const list = await prisma.list.findUnique({ where: { id: listId }, select: LIST_SELECT });
  if (!list) throw NotFound("List not found");
  return list;
}

export async function listLists(userId, boardId) {
  await assertBoardAccess(userId, boardId);
  return prisma.list.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: LIST_SELECT,
  });
}

export async function getList(userId, listId) {
  const list = await loadList(listId);
  await assertBoardAccess(userId, list.boardId);
  return list;
}

export async function createList(userId, input) {
  await assertBoardAccess(userId, input.boardId, "ws_member");
  let position = input.position;
  if (position == null) {
    const max = await prisma.list.aggregate({
      where: { boardId: input.boardId },
      _max: { position: true },
    });
    position = endPosition(max._max.position);
  }
  const list = await prisma.list.create({
    data: { boardId: input.boardId, name: input.name, position },
    select: LIST_SELECT,
  });
  emitToBoard(list.boardId, "list:created", list);
  return list;
}

export async function updateList(userId, listId, input) {
  const existing = await loadList(listId);
  await assertBoardAccess(userId, existing.boardId, "ws_member");
  const list = await prisma.list.update({ where: { id: listId }, data: input, select: LIST_SELECT });
  emitToBoard(list.boardId, "list:updated", list);
  return list;
}

export async function deleteList(userId, listId) {
  const existing = await loadList(listId);
  await assertBoardAccess(userId, existing.boardId, "ws_member");
  await prisma.list.delete({ where: { id: listId } });
  emitToBoard(existing.boardId, "list:deleted", { id: listId });
}

// Move a list (with its cards) to another board the user can also write to.
export async function moveList(userId, listId, targetBoardId) {
  const existing = await loadList(listId);
  await assertBoardAccess(userId, existing.boardId, "ws_member");
  if (targetBoardId === existing.boardId) return existing;
  await assertBoardAccess(userId, targetBoardId, "ws_member");

  const max = await prisma.list.aggregate({
    where: { boardId: targetBoardId },
    _max: { position: true },
  });
  const list = await prisma.list.update({
    where: { id: listId },
    data: { boardId: targetBoardId, position: endPosition(max._max.position) },
    select: LIST_SELECT,
  });
  emitToBoard(existing.boardId, "list:deleted", { id: listId });
  emitToBoard(targetBoardId, "list:created", list);
  return list;
}

// Copy a list (and its cards) into the same board.
export async function copyList(userId, listId) {
  const existing = await loadList(listId);
  await assertBoardAccess(userId, existing.boardId, "ws_member");

  const src = await prisma.list.findUnique({
    where: { id: listId },
    select: {
      name: true,
      cards: {
        where: { archived: false },
        orderBy: { position: "asc" },
        select: {
          title: true,
          description: true,
          position: true,
          dueDate: true,
          startDate: true,
          coverUrl: true,
          cardLabels: { select: { labelId: true } },
          checklists: {
            orderBy: { position: "asc" },
            select: {
              title: true,
              position: true,
              items: {
                orderBy: { position: "asc" },
                select: { text: true, done: true, position: true },
              },
            },
          },
        },
      },
    },
  });

  const max = await prisma.list.aggregate({
    where: { boardId: existing.boardId },
    _max: { position: true },
  });

  const list = await prisma.$transaction(async (tx) => {
    const newList = await tx.list.create({
      data: {
        boardId: existing.boardId,
        name: `${src.name} (copy)`,
        position: endPosition(max._max.position),
      },
      select: LIST_SELECT,
    });
    for (const card of src.cards) {
      await tx.card.create({
        data: {
          listId: newList.id,
          title: card.title,
          description: card.description,
          position: card.position,
          dueDate: card.dueDate,
          startDate: card.startDate,
          coverUrl: card.coverUrl,
          cardLabels: { create: card.cardLabels.map((cl) => ({ labelId: cl.labelId })) },
          checklists: {
            create: card.checklists.map((cl) => ({
              title: cl.title,
              position: cl.position,
              items: {
                create: cl.items.map((it) => ({ text: it.text, done: it.done, position: it.position })),
              },
            })),
          },
        },
      });
    }
    return newList;
  });

  emitToBoard(list.boardId, "list:created", list);
  return list;
}

export async function archiveListCards(userId, listId) {
  const existing = await loadList(listId);
  await assertBoardAccess(userId, existing.boardId, "ws_member");
  const result = await prisma.card.updateMany({
    where: { listId, archived: false },
    data: { archived: true },
  });
  emitToBoard(existing.boardId, "list:cards_archived", { listId });
  return { listId, archived: result.count };
}

const SORT_CMP = {
  name: (a, b) => a.title.localeCompare(b.title),
  due: (a, b) =>
    (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity),
  created: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
};

export async function sortListCards(userId, listId, by) {
  const list = await loadList(listId);
  await assertBoardAccess(userId, list.boardId, "ws_member");
  const cards = await prisma.card.findMany({
    where: { listId, archived: false },
    select: { id: true, title: true, dueDate: true, createdAt: true },
  });
  const sorted = [...cards].sort(SORT_CMP[by]);
  await prisma.$transaction(
    sorted.map((c, i) => prisma.card.update({ where: { id: c.id }, data: { position: (i + 1) * POSITION_STEP } })),
  );
  emitToBoard(list.boardId, "list:sorted", { listId, by });
  return { listId, by, count: sorted.length };
}
