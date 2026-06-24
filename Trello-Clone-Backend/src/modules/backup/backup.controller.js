import { z } from "zod";
import * as service from "./backup.service.js";

const ctxOf = (req) => ({ ip: req.ip, userAgent: req.headers["user-agent"] });

// The OAuth callback lives at /api/backup/oauth/callback. The redirect_uri must
// EXACTLY match what is registered in Google Cloud. Behind Cloudflare + gateway,
// req.protocol is http, so prefer the client-sent origin, then x-forwarded-proto,
// then default https for any non-localhost host.
const redirectUriOf = (req) => {
  const fromClient = req.query.origin;
  if (typeof fromClient === "string" && /^https?:\/\/[^/\s]+$/.test(fromClient)) {
    return `${fromClient.replace(/\/$/, "")}/api/backup/oauth/callback`;
  }
  const xf = req.headers["x-forwarded-proto"];
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost";
  const proto = xf ? xf.split(",")[0].trim() : host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}/api/backup/oauth/callback`;
};

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  cronExpr: z.string().min(1).max(50).optional(),
  retentionCount: z.coerce.number().int().min(1).max(365).optional(),
  scopeDb: z.boolean().optional(),
  scopeUploads: z.boolean().optional(),
  scopeConfigs: z.boolean().optional(),
  remoteFolder: z.string().min(1).max(200).optional(),
});

const credsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export const getSettings = async (_req, res) => {
  res.json(await service.getSettings());
};

export const updateSettings = async (req, res) => {
  const patch = settingsSchema.parse(req.body ?? {});
  res.json(await service.updateSettings(req.user.id, patch, ctxOf(req)));
};

export const runNow = async (req, res) => {
  res.json(await service.triggerManual(req.user.id, ctxOf(req)));
};

export const listRuns = async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(100).default(7).parse(req.query.limit ?? 7);
  res.json(await service.listRuns(limit));
};

export const getRun = async (req, res) => {
  const run = await service.getRun(req.params.id);
  if (!run) return res.status(404).json({ message: "Run not found" });
  res.json(run);
};

export const deleteRun = async (req, res) => {
  await service.deleteRun(req.params.id);
  res.status(204).end();
};

export const setCreds = async (req, res) => {
  const { clientId, clientSecret } = credsSchema.parse(req.body ?? {});
  res.json(await service.setGdriveCreds(req.user.id, clientId, clientSecret));
};

export const oauthStart = async (req, res) => {
  res.json(await service.startOAuth(req.user.id, redirectUriOf(req)));
};

export const disconnect = async (req, res) => {
  res.json(await service.disconnectGdrive(req.user.id));
};

// PUBLIC — Google redirects here without an auth header.
export const oauthCallback = async (req, res) => {
  const { code, state, error } = req.query;
  const html = (ok, msg) => `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;text-align:center">
<h3>${ok ? "Google Drive connected" : "Connection failed"}</h3><p>${msg}</p>
<script>try{window.opener&&window.opener.postMessage({type:"backup-oauth-result",ok:${ok},msg:${JSON.stringify(msg)}},"*")}catch(e){}setTimeout(function(){window.close()},1500)</script>
</body>`;
  if (error) return res.status(400).send(html(false, String(error)));
  try {
    const email = await service.completeOAuth(String(code), String(state));
    res.send(html(true, email || "Connected"));
  } catch (e) {
    res.status(400).send(html(false, e.message));
  }
};
