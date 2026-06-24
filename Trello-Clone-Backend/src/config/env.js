import { z } from "zod";

// Proper boolean env parser: "false"/"0"/"no" -> false (z.coerce.boolean treats any
// non-empty string as true, which breaks SEED_SUPER_ADMIN=false etc.).
const boolish = (def) =>
  z.preprocess(
    (v) => (typeof v === "string" ? ["1", "true", "yes", "on"].includes(v.trim().toLowerCase()) : v),
    z.boolean(),
  ).default(def);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  // Observability
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SERVICE_VERSION: z.string().default("0.0.0"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(""),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  // Set true only when served over HTTPS (e.g. behind TLS/Cloudflare). Over plain
  // HTTP (IP access) keep false or the refresh cookie won't be sent.
  COOKIE_SECURE: boolish(false),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  MINIO_ENDPOINT: z.string().default("minio"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("trello"),
  // Browser-reachable MinIO base URL (presign host + public file URLs). e.g. http://<vps-ip>:9000
  MINIO_PUBLIC_URL: z.string().default("http://localhost:9000"),
  SEED_ADMIN_EMAIL: z.string().email().default("admin@trello.local"),
  SEED_ADMIN_PASSWORD: z.string().default("Admin@12345"),
  // When false (e.g. Prod), the seed does NOT create a super_admin user, so the
  // one-time first-run setup page is shown to create it.
  SEED_SUPER_ADMIN: boolish(true),
  APP_URL: z.string().default("http://localhost:5173"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: boolish(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("Trello Clone <no-reply@trello.local>"),
  ENABLE_WORKERS: boolish(true),
  // Zalo bot + DeepSeek chatbot (set in server .env, never commit)
  DEEPSEEK_API_KEY: z.string().default(""),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  ZALO_BOT_TOKEN: z.string().default(""),
  ZALO_CHAT_ID: z.string().default(""),
  ZALO_WEBHOOK_SECRET: z.string().default("trello-clone-zalo-secret"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
