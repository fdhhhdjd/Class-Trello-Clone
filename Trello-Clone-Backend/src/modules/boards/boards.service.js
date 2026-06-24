import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../../config/db.js";
import { NotFound } from "../../lib/errors.js";
import { assertWorkspaceAccess } from "../workspaces/workspaces.service.js";
import { minioPublic, MINIO_BUCKET, publicUrl } from "../../config/minio.js";

const MEMBER_USER = { id: true, name: true, email: true, avatarUrl: true };

// Presigned PUT for a custom board background image (ws_member). Mirrors logo/avatar.
export async function createBoardBgUpload(userId, boardId, { filename, contentType }) {
  await assertBoardAccess(userId, boardId, "ws_member");
  const ext = path.extname(filename || "").slice(0, 16);
  const key = `board-bg/${boardId}/${crypto.randomUUID()}${ext}`;
  const uploadUrl = await minioPublic.presignedPutObject(MINIO_BUCKET, key, 5 * 60);
  return { uploadUrl, key, fileUrl: publicUrl(key), contentType };
}

// Board access derives from its workspace membership (MVP rule).
// Returns { board, role } or throws 404/403.
export async function assertBoardAccess(userId, boardId, minRole) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, workspaceId: true },
  });
  if (!board) throw NotFound("Board not found");
  const role = await assertWorkspaceAccess(userId, board.workspaceId, minRole);
  return { board, role };
}

export async function listBoards(userId, workspaceId, onlyTemplates = false) {
  await assertWorkspaceAccess(userId, workspaceId);
  const boards = await prisma.board.findMany({
    where: { workspaceId, isTemplate: onlyTemplates },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      background: true,
      visibility: true,
      archived: true,
      isTemplate: true,
      createdAt: true,
      stars: { where: { userId }, select: { userId: true } },
    },
  });
  return boards.map(({ stars, ...b }) => ({ ...b, starred: stars.length > 0 }));
}

/* ---------------------------------------------------------- Board members */

export async function listBoardMembers(userId, boardId) {
  await assertBoardAccess(userId, boardId);
  const members = await prisma.boardMember.findMany({
    where: { boardId },
    orderBy: { createdAt: "asc" },
    select: { role: true, user: { select: MEMBER_USER } },
  });
  return members.map((m) => ({ ...m.user, role: m.role }));
}

export async function addBoardMember(userId, boardId, targetId, role) {
  await assertBoardAccess(userId, boardId, "ws_member");
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: MEMBER_USER });
  if (!target) throw NotFound("User not found", "USER_NOT_FOUND");
  const { board } = await assertBoardAccess(userId, boardId);
  await assertWorkspaceAccess(target.id, board.workspaceId); // must belong to the workspace
  const m = await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId: targetId } },
    create: { boardId, userId: targetId, role: role ?? "member" },
    update: role ? { role } : {},
    select: { role: true, user: { select: MEMBER_USER } },
  });
  return { ...m.user, role: m.role };
}

export async function updateBoardMember(userId, boardId, targetId, role) {
  await assertBoardAccess(userId, boardId, "ws_member");
  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: targetId } },
  });
  if (!existing) throw NotFound("Board member not found");
  const m = await prisma.boardMember.update({
    where: { boardId_userId: { boardId, userId: targetId } },
    data: { role },
    select: { role: true, user: { select: MEMBER_USER } },
  });
  return { ...m.user, role: m.role };
}

export async function removeBoardMember(userId, boardId, targetId) {
  await assertBoardAccess(userId, boardId, "ws_member");
  await prisma.boardMember.deleteMany({ where: { boardId, userId: targetId } });
}

export async function setBoardStar(userId, boardId, starred) {
  await assertBoardAccess(userId, boardId);
  if (starred) {
    await prisma.boardStar.upsert({
      where: { boardId_userId: { boardId, userId } },
      create: { boardId, userId },
      update: {},
    });
  } else {
    await prisma.boardStar.deleteMany({ where: { boardId, userId } });
  }
  return { boardId, starred };
}

export async function createBoard(userId, input) {
  await assertWorkspaceAccess(userId, input.workspaceId, "ws_member");
  return prisma.board.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      background: input.background,
      visibility: input.visibility ?? "workspace",
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      background: true,
      visibility: true,
      archived: true,
      createdAt: true,
    },
  });
}

// Deep clone a board into the same workspace.
// Copies labels, lists, cards, card<->label links, checklists + items.
// Does NOT copy comments, attachments, members, activity.
export async function copyBoard(userId, boardId, name) {
  const { board: src } = await assertBoardAccess(userId, boardId, "ws_member");

  const full = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      name: true,
      description: true,
      background: true,
      visibility: true,
      labels: { select: { id: true, name: true, color: true } },
      lists: {
        orderBy: { position: "asc" },
        select: {
          name: true,
          position: true,
          archived: true,
          cards: {
            orderBy: { position: "asc" },
            select: {
              title: true,
              description: true,
              position: true,
              dueDate: true,
              startDate: true,
              coverUrl: true,
              archived: true,
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
      },
    },
  });
  if (!full) throw NotFound("Board not found");

  return prisma.$transaction(async (tx) => {
    const newBoard = await tx.board.create({
      data: {
        workspaceId: src.workspaceId,
        name: name?.trim() || `${full.name} (copy)`,
        description: full.description,
        background: full.background,
        visibility: full.visibility,
      },
      select: {
        id: true, workspaceId: true, name: true, description: true,
        background: true, visibility: true, archived: true, createdAt: true,
      },
    });

    const labelMap = new Map();
    for (const lb of full.labels) {
      const created = await tx.label.create({
        data: { boardId: newBoard.id, name: lb.name, color: lb.color },
        select: { id: true },
      });
      labelMap.set(lb.id, created.id);
    }

    for (const list of full.lists) {
      const newList = await tx.list.create({
        data: {
          boardId: newBoard.id,
          name: list.name,
          position: list.position,
          archived: list.archived,
        },
        select: { id: true },
      });
      for (const card of list.cards) {
        await tx.card.create({
          data: {
            listId: newList.id,
            title: card.title,
            description: card.description,
            position: card.position,
            dueDate: card.dueDate,
            startDate: card.startDate,
            coverUrl: card.coverUrl,
            archived: card.archived,
            cardLabels: {
              create: card.cardLabels
                .filter((cl) => labelMap.has(cl.labelId))
                .map((cl) => ({ labelId: labelMap.get(cl.labelId) })),
            },
            checklists: {
              create: card.checklists.map((cl) => ({
                title: cl.title,
                position: cl.position,
                items: {
                  create: cl.items.map((it) => ({
                    text: it.text, done: it.done, position: it.position,
                  })),
                },
              })),
            },
          },
        });
      }
    }
    return newBoard;
  });
}

export async function updateBoard(userId, boardId, input) {
  await assertBoardAccess(userId, boardId, "ws_member");
  return prisma.board.update({
    where: { id: boardId },
    data: input,
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      background: true,
      visibility: true,
      archived: true,
      isTemplate: true,
      createdAt: true,
    },
  });
}

export async function deleteBoard(userId, boardId) {
  await assertBoardAccess(userId, boardId, "ws_admin");
  await prisma.board.delete({ where: { id: boardId } });
}

// Full nested board payload for the board view.
export async function getBoardDetail(userId, boardId) {
  await assertBoardAccess(userId, boardId);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      background: true,
      visibility: true,
      archived: true,
      isTemplate: true,
      createdAt: true,
      stars: { where: { userId }, select: { userId: true } },
      customFields: {
        orderBy: { position: "asc" },
        select: { id: true, boardId: true, name: true, type: true, options: true, position: true },
      },
      labels: { select: { id: true, name: true, color: true, boardId: true } },
      lists: {
        where: { archived: false },
        orderBy: { position: "asc" },
        select: {
          id: true,
          boardId: true,
          name: true,
          position: true,
          wipLimit: true,
          archived: true,
          cards: {
            where: { archived: false, isTemplate: false },
            orderBy: { position: "asc" },
            select: {
              id: true,
              listId: true,
              number: true,
              title: true,
              description: true,
              status: true,
              position: true,
              dueDate: true,
              startDate: true,
              coverUrl: true,
              archived: true,
              createdAt: true,
              updatedAt: true,
              cardLabels: { select: { label: { select: { id: true, name: true, color: true } } } },
              members: {
                select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
              },
              _count: { select: { comments: true, attachments: true } },
              checklists: { select: { items: { select: { done: true } } } },
            },
          },
        },
      },
    },
  });
  if (!board) throw NotFound("Board not found");

  const lists = board.lists.map((l) => ({
    id: l.id,
    boardId: l.boardId,
    name: l.name,
    position: l.position,
    wipLimit: l.wipLimit,
    archived: l.archived,
    cards: l.cards.map((card) => {
      let done = 0;
      let total = 0;
      for (const cl of card.checklists) {
        for (const it of cl.items) {
          total += 1;
          if (it.done) done += 1;
        }
      }
      return {
        id: card.id,
        listId: card.listId,
        number: card.number,
        title: card.title,
        description: card.description,
        status: card.status,
        position: card.position,
        dueDate: card.dueDate,
        startDate: card.startDate,
        coverUrl: card.coverUrl,
        archived: card.archived,
        createdAt: card.createdAt,
        labels: card.cardLabels.map((cl) => cl.label),
        members: card.members.map((m) => m.user),
        commentCount: card._count.comments,
        attachmentCount: card._count.attachments,
        checklistSummary: { done, total },
        checklist: { done, total },
      };
    }),
  }));

  return {
    id: board.id,
    workspaceId: board.workspaceId,
    name: board.name,
    description: board.description,
    background: board.background,
    visibility: board.visibility,
    archived: board.archived,
    isTemplate: board.isTemplate,
    createdAt: board.createdAt,
    starred: board.stars.length > 0,
    labels: board.labels,
    customFields: board.customFields,
    lists,
  };
}
