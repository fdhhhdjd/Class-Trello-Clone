import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { dbHealthy } from "./config/db.js";
import { redisHealthy } from "./config/redis.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { sanitizeBody } from "./middleware/sanitize.js";
import { metricsMiddleware, metricsHandler } from "./observability/metrics.js";
import { httpLogger } from "./observability/httpLogger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes.js";
import { boardsRouter } from "./modules/boards/boards.routes.js";
import { listsRouter } from "./modules/lists/lists.routes.js";
import { cardsRouter } from "./modules/cards/cards.routes.js";
import { commentsRouter } from "./modules/comments/comments.routes.js";
import { labelsRouter } from "./modules/labels/labels.routes.js";
import {
  checklistsRouter,
  checklistItemsRouter,
} from "./modules/checklists/checklists.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { meRouter } from "./modules/me/me.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { attachmentsRouter } from "./modules/attachments/attachments.routes.js";
import { searchRouter } from "./modules/search/search.routes.js";
import { customFieldsRouter } from "./modules/customFields/customFields.routes.js";
import { landingPublicRouter } from "./modules/landing/landing.public.routes.js";
import { backupRouter, backupPublicRouter } from "./modules/backup/backup.routes.js";
import { reactionsRouter } from "./modules/reactions/reactions.routes.js";
import { zaloRouter } from "./modules/zalo/zalo.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);
  app.get("/metrics", metricsHandler);
  app.use(metricsMiddleware);
  app.use(httpLogger);
  app.use(express.json({ limit: "1mb" }));
  app.use(sanitizeBody);
  app.use(cookieParser());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  app.get("/health", async (_req, res) => {
    const [db, redis] = await Promise.all([dbHealthy(), redisHealthy()]);
    const ok = db && redis;
    res
      .status(ok ? 200 : 503)
      .json({ status: ok ? "ok" : "degraded", db, redis });
  });

  app.use("/api/landing", landingPublicRouter);
  app.use("/api/backup", backupPublicRouter);
  app.use("/api/zalo", zaloRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", usersRouter);
  app.use("/api/me", meRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/workspaces", workspacesRouter);
  app.use("/api/boards", boardsRouter);
  app.use("/api/lists", listsRouter);
  app.use("/api/cards", cardsRouter);
  app.use("/api/comments", commentsRouter);
  app.use("/api/labels", labelsRouter);
  app.use("/api/checklists", checklistsRouter);
  app.use("/api/checklist-items", checklistItemsRouter);
  app.use("/api/custom-fields", customFieldsRouter);
  app.use("/api/attachments", attachmentsRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/reactions", reactionsRouter);
  app.use("/api/admin/backup", backupRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
