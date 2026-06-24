import { prisma } from "../../config/db.js";

// Fire-and-forget audit write; never block the request path on a log failure.
export function logAudit(input) {
  prisma.accessAudit
    .create({
      data: {
        actorId: input.actorId,
        targetId: input.targetId ?? null,
        action: input.action,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
    .catch((e) => console.error("audit write failed:", e?.message));
}
