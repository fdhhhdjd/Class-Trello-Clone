import { Worker } from "bullmq";
import { queueConnection } from "./connection.js";
import { EMAIL_QUEUE } from "./email.queue.js";
import { sendMail } from "../lib/mailer.js";
import { renderEmail } from "../lib/emailTemplates.js";

// job.data: { to, kind, data } | { to, subject, html, text }
export function startEmailWorker() {
  const worker = new Worker(
    EMAIL_QUEUE,
    async (job) => {
      const { to, kind, data, subject, html, text } = job.data;
      if (!to) return;
      const msg = kind ? renderEmail(kind, data) : { subject, html, text };
      await sendMail({ to, ...msg });
    },
    { connection: queueConnection, concurrency: 5 },
  );
  worker.on("failed", (job, err) => console.error("email job failed:", job?.id, err.message));
  return worker;
}
