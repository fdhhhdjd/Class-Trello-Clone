import { Client } from "minio";
import { env } from "./env.js";

// Internal client — server-side ops (bucket, put/remove/stat) over the docker network.
export const minio = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: false,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

// Public client — signs presigned URLs with the browser-reachable host so the
// signature matches what the browser actually requests. Also used to build file URLs.
const pub = new URL(env.MINIO_PUBLIC_URL);
const publicSSL = pub.protocol === "https:";
const publicPort = pub.port ? Number(pub.port) : (publicSSL ? 443 : 80);

export const minioPublic = new Client({
  endPoint: pub.hostname,
  port: publicPort,
  useSSL: publicSSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export const MINIO_BUCKET = env.MINIO_BUCKET;
export const publicBase = env.MINIO_PUBLIC_URL.replace(/\/$/, "");

export function publicUrl(key) {
  return `${publicBase}/${MINIO_BUCKET}/${key}`;
}

// Allow anonymous GET so avatars/attachments load via <img src> with the public URL.
const READ_POLICY = (bucket) => JSON.stringify({
  Version: "2012-10-17",
  Statement: [{
    Effect: "Allow",
    Principal: { AWS: ["*"] },
    Action: ["s3:GetObject"],
    Resource: [`arn:aws:s3:::${bucket}/*`],
  }],
});

export async function ensureBucket() {
  const exists = await minio.bucketExists(MINIO_BUCKET).catch(() => false);
  if (!exists) await minio.makeBucket(MINIO_BUCKET);
  await minio.setBucketPolicy(MINIO_BUCKET, READ_POLICY(MINIO_BUCKET)).catch(() => {});
}
