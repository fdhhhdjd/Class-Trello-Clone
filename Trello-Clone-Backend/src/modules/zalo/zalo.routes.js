import { Router } from "express";
import { ah } from "../../middleware/errorHandler.js";
import { handleUpdate, setWebhook, getWebhookInfo } from "./zalo.service.js";

// Public, unauthenticated. Mounted at /api/zalo.
export const zaloRouter = Router();

// Zalo posts incoming messages here. Reply 200 immediately; process async.
zaloRouter.post(
  "/webhook",
  ah(async (req, res) => {
    console.log("[zalo] webhook recv:", JSON.stringify(req.body).slice(0, 600));
    res.json({ ok: true });
    setImmediate(() => handleUpdate(req.body));
  }),
);

// Helper to (re)register the webhook from the running server.
zaloRouter.get(
  "/set-webhook",
  ah(async (req, res) => {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const url = req.query.url || `${proto}://${host}/api/zalo/webhook`;
    res.json(await setWebhook(url));
  }),
);

zaloRouter.get(
  "/webhook-info",
  ah(async (_req, res) => {
    res.json(await getWebhookInfo());
  }),
);
