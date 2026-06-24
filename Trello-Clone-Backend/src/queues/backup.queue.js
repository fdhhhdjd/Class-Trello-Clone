import { Queue, Worker } from "bullmq";
import { queueConnection } from "./connection.js";
import { getRawSettings } from "../modules/backup/backup.settings.js";
import { createRun, executeRun, hasRunning } from "../modules/backup/backup.service.js";

export const BACKUP_QUEUE = "backup";
const JOB = "scheduled-backup";

export const backupQueue = new Queue(BACKUP_QUEUE, { connection: queueConnection });

// (Re)install the repeatable job from current settings. Idempotent.
export async function scheduleBackup(settings) {
  const s = settings ?? (await getRawSettings());
  // clear any existing schedule first
  const repeatables = await backupQueue.getRepeatableJobs().catch(() => []);
  for (const r of repeatables) {
    await backupQueue.removeRepeatableByKey(r.key).catch(() => undefined);
  }
  if (!s.enabled || !s.cronExpr) return;
  await backupQueue.add(
    JOB,
    {},
    {
      repeat: { pattern: s.cronExpr, tz: "Asia/Ho_Chi_Minh" },
      jobId: JOB,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
}

export function startBackupWorker() {
  const worker = new Worker(
    BACKUP_QUEUE,
    async () => {
      const s = await getRawSettings();
      if (!s.enabled) return { skipped: "disabled" };
      if (await hasRunning()) return { skipped: "busy" };
      const run = await createRun(
        "scheduled",
        { scopeDb: s.scopeDb, scopeUploads: s.scopeUploads, scopeConfigs: s.scopeConfigs },
        null,
      );
      await executeRun(run.id);
      return { runId: run.id };
    },
    { connection: queueConnection },
  );
  worker.on("failed", (job, err) => console.error("backup job failed:", job?.id, err.message));
  return worker;
}
