import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

import { prisma } from "../../config/db.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { minio, MINIO_BUCKET } from "../../config/minio.js";
import { logAudit } from "../rbac/audit.js";
import { getRawSettings, saveSettings, getSettings, DEFAULTS } from "./backup.settings.js";
import { buildAuthUrl, exchangeCode, uploadDir, applyRetention, revoke } from "./backup.gdrive.js";

const STATE_TTL = 600; // 10 min
const RUN_TIMEOUT_MS = 60 * 60 * 1000;

const stamp = () =>
  new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");

function mapRun(r) {
  return { ...r, sizeBytes: Number(r.sizeBytes) };
}

/* ----------------------------------------------------------- run history */

export async function listRuns(limit = 7) {
  const rows = await prisma.backupRun.findMany({
    orderBy: { startedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(mapRun);
}

export async function getRun(id) {
  const r = await prisma.backupRun.findUnique({ where: { id } });
  return r ? mapRun(r) : null;
}

export async function deleteRun(id) {
  await prisma.backupRun.deleteMany({ where: { id } });
}

export async function hasRunning() {
  const n = await prisma.backupRun.count({ where: { status: { in: ["pending", "running"] } } });
  return n > 0;
}

/* ----------------------------------------------------------- shell tools */

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts });
    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`)),
    );
  });
}

async function dumpDatabase(outFile) {
  const child = spawn("pg_dump", ["--clean", "--if-exists", "--no-owner", env.DATABASE_URL]);
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));
  try {
    await pipeline(child.stdout, createGzip(), fs.createWriteStream(outFile));
  } catch (e) {
    throw new Error(`pg_dump failed: ${stderr.slice(-2000) || e.message}`);
  }
}

async function exportUploads(stageDir, outFile) {
  const upDir = path.join(stageDir, "uploads");
  fs.mkdirSync(upDir, { recursive: true });
  const stream = minio.listObjectsV2(MINIO_BUCKET, "", true);
  await new Promise((resolve, reject) => {
    const tasks = [];
    stream.on("data", (obj) => {
      if (!obj.name) return;
      const dest = path.join(upDir, obj.name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      tasks.push(minio.fGetObject(MINIO_BUCKET, obj.name, dest));
    });
    stream.on("error", reject);
    stream.on("end", () => Promise.all(tasks).then(resolve, reject));
  });
  await run("tar", ["-czf", outFile, "-C", stageDir, "uploads"]);
  fs.rmSync(upDir, { recursive: true, force: true });
}

async function exportConfigs(outFile) {
  const settings = await prisma.setting.findMany();
  fs.writeFileSync(outFile, JSON.stringify(settings, null, 2));
}

/* ----------------------------------------------------------- orchestrate */

export async function createRun(kind, scopes, triggeredBy) {
  return prisma.backupRun.create({
    data: {
      kind,
      status: "pending",
      scopeDb: scopes.scopeDb,
      scopeUploads: scopes.scopeUploads,
      scopeConfigs: scopes.scopeConfigs,
      triggeredBy: triggeredBy ?? null,
    },
  });
}

// Run the backup for an existing run row. Never throws — records failure on the row.
export async function executeRun(runId) {
  const s = await getRawSettings();
  const work = path.join(os.tmpdir(), `backup-${runId}`);
  const log = [];
  const tap = (m) => {
    log.push(`[${new Date().toISOString()}] ${m}`);
  };

  const timeout = setTimeout(() => tap("timeout reached"), RUN_TIMEOUT_MS);
  try {
    fs.mkdirSync(work, { recursive: true });
    await prisma.backupRun.update({ where: { id: runId }, data: { status: "running" } });

    if (s.scopeDb) {
      tap("dumping database");
      await dumpDatabase(path.join(work, "db.sql.gz"));
    }
    if (s.scopeUploads) {
      tap("exporting uploads from MinIO");
      await exportUploads(work, path.join(work, "uploads.tar.gz"));
    }
    if (s.scopeConfigs) {
      tap("exporting configs");
      await exportConfigs(path.join(work, "configs.json"));
    }

    if (!s.gdriveRefreshToken) throw new Error("Google Drive not connected");
    tap("uploading to Google Drive");
    const folder = stamp();
    // redirect_uri is irrelevant for refresh-token based access (only used at code exchange).
    const { remotePath, sizeBytes } = await uploadDir(s, "", work, folder);

    tap("applying retention");
    await applyRetention(s, "", s.retentionCount).catch((e) => tap(`retention skipped: ${e.message}`));

    tap("done");
    await prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: "success",
        finishedAt: new Date(),
        sizeBytes,
        remotePath,
        logTail: log.join("\n").slice(-4000),
      },
    });
  } catch (e) {
    tap(`ERROR: ${e.message}`);
    await prisma.backupRun
      .update({
        where: { id: runId },
        data: {
          status: "failed",
          finishedAt: new Date(),
          error: e.message.slice(0, 1000),
          logTail: log.join("\n").slice(-4000),
        },
      })
      .catch(() => undefined);
  } finally {
    clearTimeout(timeout);
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Trigger a manual backup. Returns the created run, kicks execution async.
export async function triggerManual(actorId, ctx) {
  if (await hasRunning()) {
    const err = new Error("A backup is already running");
    err.statusCode = 409;
    err.code = "BACKUP_BUSY";
    throw err;
  }
  const s = await getRawSettings();
  const run = await createRun(
    "manual",
    { scopeDb: s.scopeDb, scopeUploads: s.scopeUploads, scopeConfigs: s.scopeConfigs },
    actorId,
  );
  logAudit({
    actorId,
    targetId: null,
    action: "admin.backup.run",
    metadata: { runId: run.id },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  setImmediate(() => executeRun(run.id));
  return mapRun(run);
}

/* ----------------------------------------------------------- settings api */

export { getSettings, DEFAULTS };

const EDITABLE = ["enabled", "cronExpr", "retentionCount", "scopeDb", "scopeUploads", "scopeConfigs", "remoteFolder"];

export async function updateSettings(actorId, patch, ctx) {
  const clean = {};
  for (const k of EDITABLE) if (k in patch) clean[k] = patch[k];
  const next = await saveSettings(clean);
  logAudit({
    actorId,
    targetId: null,
    action: "admin.backup.settings",
    metadata: { keys: Object.keys(clean) },
    ipAddress: ctx?.ip,
    userAgent: ctx?.userAgent,
  });
  // reschedule the cron job to reflect new enabled/cronExpr
  const { scheduleBackup } = await import("../../queues/backup.queue.js");
  await scheduleBackup(next).catch(() => undefined);
  return getSettings();
}

export async function setGdriveCreds(actorId, clientId, clientSecret) {
  await saveSettings({ gdriveClientId: clientId, gdriveClientSecret: clientSecret });
  return getSettings();
}

export async function startOAuth(actorId, redirectUri) {
  const s = await getRawSettings();
  if (!s.gdriveClientId || !s.gdriveClientSecret) {
    const err = new Error("Set Client ID and Secret first");
    err.statusCode = 400;
    throw err;
  }
  const state = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await redis.set(`backup_oauth:${state}`, JSON.stringify({ actorId, redirectUri }), "EX", STATE_TTL);
  return { authUrl: buildAuthUrl(s, redirectUri, state), redirectUri };
}

// Called from the PUBLIC callback. Returns the connected email or throws.
export async function completeOAuth(code, state) {
  const raw = await redis.getdel(`backup_oauth:${state}`);
  if (!raw) throw new Error("Invalid or expired state");
  const { redirectUri } = JSON.parse(raw);
  const s = await getRawSettings();
  const { refreshToken, email } = await exchangeCode(s, redirectUri, code);
  if (!refreshToken) throw new Error("No refresh token returned (re-consent required)");
  await saveSettings({ gdriveRefreshToken: refreshToken, gdriveAccountEmail: email });
  return email;
}

export async function disconnectGdrive(actorId) {
  const s = await getRawSettings();
  await revoke(s, "").catch(() => undefined);
  await saveSettings({ gdriveRefreshToken: "", gdriveAccountEmail: "" });
  return getSettings();
}
