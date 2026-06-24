import { prisma } from "../../config/db.js";
import { assertCardAccess } from "../cards/cards.service.js";

export async function listCardActivity(userId, cardId) {
  await assertCardAccess(userId, cardId);
  const rows = await prisma.activity.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return rows;
}
