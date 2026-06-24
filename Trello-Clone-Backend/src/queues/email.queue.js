import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";

export const EMAIL_QUEUE = "email";

export const emailQueue = new Queue(EMAIL_QUEUE, { connection: queueConnection });

// Enqueue an email job. Never throws to the caller (best-effort).
export async function enqueueEmail(payload) {
  try {
    await emailQueue.add("send", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  } catch (e) {
    console.error("enqueueEmail failed:", e.message);
  }
}
