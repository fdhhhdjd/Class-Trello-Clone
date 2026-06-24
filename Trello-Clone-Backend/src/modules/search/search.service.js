import { prisma } from "../../config/db.js";

const WS_ROLE_KEYS = ["ws_guest", "ws_member", "ws_admin", "ws_owner"];

// All workspace IDs the user can access (owned + role-granted, non-expired).
async function accessibleWorkspaceIds(userId) {
  const now = new Date();
  const [owned, roles] = await Promise.all([
    prisma.workspace.findMany({ where: { ownerId: userId }, select: { id: true } }),
    prisma.userRole.findMany({
      where: {
        userId,
        tenantId: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: { key: { in: WS_ROLE_KEYS } },
      },
      select: { tenantId: true },
    }),
  ]);
  return [...new Set([...owned.map((w) => w.id), ...roles.map((r) => r.tenantId)])];
}

export async function search(userId, q) {
  const term = (q ?? "").trim();
  if (!term) return { cards: [], boards: [] };
  const wsIds = await accessibleWorkspaceIds(userId);
  if (wsIds.length === 0) return { cards: [], boards: [] };

  const [boards, cards] = await Promise.all([
    prisma.board.findMany({
      where: { workspaceId: { in: wsIds }, name: { contains: term, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, workspaceId: true },
    }),
    prisma.card.findMany({
      where: {
        list: { board: { workspaceId: { in: wsIds } } },
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { members: { some: { user: { OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ] } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        list: { select: { name: true, boardId: true, board: { select: { name: true } } } },
        members: { select: { user: { select: { name: true, avatarUrl: true } } } },
      },
    }),
  ]);

  return {
    boards: boards.map((b) => ({ id: b.id, name: b.name, workspaceId: b.workspaceId })),
    cards: cards.map((c) => ({
      id: c.id,
      title: c.title,
      boardId: c.list.boardId,
      boardName: c.list.board.name,
      listName: c.list.name,
      members: c.members.map((m) => m.user),
    })),
  };
}
