import { prisma } from "../../config/db.js";
import { NotFound, BadRequest } from "../../lib/errors.js";
import { assertWorkspaceAccess } from "../workspaces/workspaces.service.js";
import { assertBoardAccess } from "../boards/boards.service.js";
import { endPosition } from "../../lib/position.js";
import { emitToBoard } from "../../realtime/index.js";
import { notify } from "../notifications/notifications.service.js";

const CARD_SELECT = {
  id: true,
  listId: true,
  number: true,
  title: true,
  description: true,
  status: true,
  isTemplate: true,
  position: true,
  dueDate: true,
  startDate: true,
  coverUrl: true,
  archived: true,
  createdAt: true,
};

// Resolves a card to its board + workspace and asserts membership.
// Returns { card: {...CARD fields, boardId, workspaceId}, role }.
export async function assertCardAccess(userId, cardId, minRole) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { ...CARD_SELECT, list: { select: { boardId: true, board: { select: { workspaceId: true } } } } },
  });
  if (!card) throw NotFound("Card not found");
  const workspaceId = card.list.board.workspaceId;
  const role = await assertWorkspaceAccess(userId, workspaceId, minRole);
  const { list, ...rest } = card;
  return { card: { ...rest, boardId: list.boardId, workspaceId }, role };
}

async function listToBoard(listId) {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: { id: true, boardId: true, board: { select: { workspaceId: true } } },
  });
  if (!list) throw NotFound("List not found");
  return { boardId: list.boardId, workspaceId: list.board.workspaceId };
}

function withLabelsMembers(card) {
  return {
    ...stripJoins(card),
    labels: card.cardLabels.map((cl) => cl.label),
    members: card.members.map((m) => m.user),
    commentCount: card._count.comments,
  };
}

function stripJoins(card) {
  const { cardLabels, members, _count, ...rest } = card;
  return rest;
}

export async function listCards(userId, { boardId, listId }) {
  let resolvedBoardId = boardId;
  if (listId && !boardId) resolvedBoardId = (await listToBoard(listId)).boardId;
  if (!resolvedBoardId) throw BadRequest("boardId or listId required");

  const board = await prisma.board.findUnique({
    where: { id: resolvedBoardId },
    select: { workspaceId: true },
  });
  if (!board) throw NotFound("Board not found");
  await assertWorkspaceAccess(userId, board.workspaceId);

  const cards = await prisma.card.findMany({
    where: {
      isTemplate: false,
      list: { boardId: resolvedBoardId },
      ...(listId ? { listId } : {}),
    },
    orderBy: { position: "asc" },
    select: {
      ...CARD_SELECT,
      cardLabels: { select: { label: { select: { id: true, name: true, color: true } } } },
      members: { select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      _count: { select: { comments: true } },
    },
  });
  return cards.map(withLabelsMembers);
}

export async function createCard(userId, input) {
  const { boardId, workspaceId } = await listToBoard(input.listId);
  await assertWorkspaceAccess(userId, workspaceId, "ws_member");

  const list = await prisma.list.findUnique({ where: { id: input.listId }, select: { wipLimit: true } });
  if (list?.wipLimit && list.wipLimit > 0) {
    const count = await prisma.card.count({ where: { listId: input.listId, archived: false } });
    if (count >= list.wipLimit) throw BadRequest(`WIP limit reached (${list.wipLimit})`, "WIP_LIMIT");
  }

  let position = input.position;
  if (position == null) {
    const max = await prisma.card.aggregate({
      where: { listId: input.listId },
      _max: { position: true },
    });
    position = endPosition(max._max.position);
  }

  const card = await prisma.$transaction(async (tx) => {
    const seq = await tx.board.update({
      where: { id: boardId },
      data: { cardSeq: { increment: 1 } },
      select: { cardSeq: true },
    });
    return tx.card.create({
      data: { listId: input.listId, title: input.title, position, number: seq.cardSeq },
      select: CARD_SELECT,
    });
  });

  await prisma.activity.create({
    data: { boardId, cardId: card.id, actorId: userId, action: "card.created", metadata: { title: card.title } },
  });
  emitToBoard(boardId, "card:created", card);
  return card;
}

export async function getCardDetail(userId, cardId) {
  await assertCardAccess(userId, cardId);
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      ...CARD_SELECT,
      cardLabels: { select: { label: { select: { id: true, name: true, color: true } } } },
      members: { select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      watchers: { where: { userId }, select: { userId: true } },
      fieldValues: { select: { fieldId: true, value: true } },
      reactions: { select: { emoji: true, userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cardId: true,
          body: true,
          editedAt: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          reactions: { select: { emoji: true, userId: true } },
        },
      },
      checklists: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          cardId: true,
          title: true,
          position: true,
          items: {
            orderBy: { position: "asc" },
            select: { id: true, checklistId: true, text: true, done: true, position: true },
          },
        },
      },
    },
  });

  const { cardLabels, members, watchers, fieldValues, ...rest } = card;
  return {
    ...rest,
    labels: cardLabels.map((cl) => cl.label),
    members: members.map((m) => m.user),
    watching: watchers.length > 0,
    fieldValues,
  };
}

export async function updateCard(userId, cardId, input) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const data = { ...input };
  if (data.dueDate != null) data.dueDate = new Date(data.dueDate);
  if (data.startDate != null) data.startDate = new Date(data.startDate);

  const updated = await prisma.card.update({
    where: { id: cardId },
    data,
    select: CARD_SELECT,
  });
  await prisma.activity.create({
    data: {
      boardId: card.boardId,
      cardId,
      actorId: userId,
      action: "card.updated",
      metadata: { fields: Object.keys(input) },
    },
  });
  emitToBoard(card.boardId, "card:updated", updated);
  notifyWatchers(cardId, userId, "card.updated", {
    cardId,
    boardId: card.boardId,
    title: updated.title,
    fields: Object.keys(input),
  });
  return updated;
}

export async function moveCard(userId, cardId, input) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const dest = await listToBoard(input.listId);
  const crossBoard = dest.boardId !== card.boardId;
  if (crossBoard && dest.workspaceId !== card.workspaceId) {
    await assertWorkspaceAccess(userId, dest.workspaceId, "ws_member");
  }

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: { listId: input.listId, position: input.position },
    select: CARD_SELECT,
  });

  await prisma.activity.create({
    data: {
      boardId: dest.boardId,
      cardId,
      actorId: userId,
      action: "card.moved",
      metadata: {
        fromList: card.listId,
        toList: input.listId,
        fromBoard: card.boardId,
        toBoard: dest.boardId,
        position: input.position,
      },
    },
  });
  if (crossBoard) {
    emitToBoard(card.boardId, "card:deleted", { id: cardId, listId: card.listId });
    emitToBoard(dest.boardId, "card:created", updated);
  } else {
    emitToBoard(card.boardId, "card:moved", updated);
  }
  return updated;
}

// Clone a card. opts: { listId (target, same board), title, isTemplate }.
export async function duplicateCard(userId, cardId, opts = {}) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const src = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      listId: true,
      title: true,
      description: true,
      status: true,
      dueDate: true,
      startDate: true,
      coverUrl: true,
      cardLabels: { select: { labelId: true } },
      members: { select: { userId: true } },
      checklists: {
        select: {
          title: true,
          position: true,
          items: { select: { text: true, done: true, position: true } },
        },
      },
    },
  });

  const targetListId = opts.listId ?? src.listId;
  const max = await prisma.card.aggregate({
    where: { listId: targetListId },
    _max: { position: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const seq = await tx.board.update({ where: { id: card.boardId }, data: { cardSeq: { increment: 1 } }, select: { cardSeq: true } });
    return tx.card.create({
      data: {
        listId: targetListId,
        number: seq.cardSeq,
        title: opts.title ?? `${src.title} (copy)`,
        description: src.description,
        status: src.status,
        isTemplate: opts.isTemplate ?? false,
        dueDate: src.dueDate,
        startDate: src.startDate,
        coverUrl: src.coverUrl,
        position: endPosition(max._max.position),
        cardLabels: { create: src.cardLabels.map((l) => ({ labelId: l.labelId })) },
        members: { create: src.members.map((m) => ({ userId: m.userId })) },
        checklists: {
          create: src.checklists.map((cl) => ({
            title: cl.title,
            position: cl.position,
            items: { create: cl.items.map((it) => ({ text: it.text, done: it.done, position: it.position })) },
          })),
        },
      },
      select: CARD_SELECT,
    });
  });

  await prisma.activity.create({
    data: {
      boardId: card.boardId,
      cardId: created.id,
      actorId: userId,
      action: "card.created",
      metadata: { title: created.title, duplicatedFrom: cardId },
    },
  });
  emitToBoard(card.boardId, "card:created", created);
  return created;
}

// Board-scoped card templates (isTemplate=true). Returns light list.
export async function listCardTemplates(userId, boardId) {
  await assertBoardAccess(userId, boardId);
  const cards = await prisma.card.findMany({
    where: { isTemplate: true, list: { boardId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  return cards;
}

export async function setCardWatch(userId, cardId, watching) {
  await assertCardAccess(userId, cardId);
  if (watching) {
    await prisma.cardWatcher.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
  } else {
    await prisma.cardWatcher.deleteMany({ where: { cardId, userId } });
  }
  return { cardId, watching };
}

// Notify everyone watching a card except the actor.
export async function notifyWatchers(cardId, actorId, type, payload) {
  const watchers = await prisma.cardWatcher.findMany({
    where: { cardId, userId: { not: actorId } },
    select: { userId: true },
  });
  for (const w of watchers) notify(w.userId, type, payload);
}

export async function deleteCard(userId, cardId) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  await prisma.card.delete({ where: { id: cardId } });
  emitToBoard(card.boardId, "card:deleted", { id: cardId, listId: card.listId });
}

export async function addCardMember(userId, cardId, input) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  if (!target) throw NotFound("User not found", "USER_NOT_FOUND");
  // Target must have workspace access to be assignable.
  await assertWorkspaceAccess(target.id, card.workspaceId);

  const existing = await prisma.cardMember.findUnique({
    where: { cardId_userId: { cardId, userId: target.id } },
  });
  if (!existing) {
    await prisma.cardMember.create({ data: { cardId, userId: target.id } });
    if (target.id !== userId) {
      notify(target.id, "assigned", {
        cardId,
        boardId: card.boardId,
        title: card.title,
        assignedBy: userId,
      });
    }
  }
  emitToBoard(card.boardId, "card:member_added", { cardId, user: target });
  return { cardId, user: target };
}

export async function removeCardMember(userId, cardId, memberId) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  await prisma.cardMember.deleteMany({ where: { cardId, userId: memberId } });
  emitToBoard(card.boardId, "card:member_removed", { cardId, userId: memberId });
}
