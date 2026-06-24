import IORedis from "ioredis";
import { env } from "../config/env.js";

// BullMQ requires maxRetriesPerRequest: null on its blocking connection,
// so it gets its own client separate from config/redis.js.
export const queueConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

queueConnection.on("error", (err) => console.error("Queue redis error:", err.message));
