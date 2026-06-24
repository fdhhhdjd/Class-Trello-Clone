import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { redis } from "./config/redis.js";
import { initRealtime } from "./realtime/index.js";
import { startWorkers } from "./queues/index.js";

const app = createApp();
const server = http.createServer(app);
const io = initRealtime(server);

const workers = [];
server.listen(env.PORT, async () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
  const started = await startWorkers().catch((e) => {
    console.error("startWorkers failed:", e.message);
    return [];
  });
  workers.push(...started);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  io.close();
  server.close();
  await Promise.allSettled([
    ...workers.map((w) => w.close()),
    prisma.$disconnect(),
    redis.quit(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
