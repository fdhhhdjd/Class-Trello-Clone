import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// When SMTP_HOST is empty, fall back to a JSON transport that just logs the
// message — keeps Dev usable without a real mail server.
let transport;
export function getTransport() {
  if (transport) return transport;
  transport = env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });
  return transport;
}

export async function sendMail({ to, subject, html, text }) {
  const info = await getTransport().sendMail({ from: env.SMTP_FROM, to, subject, html, text });
  if (!env.SMTP_HOST) console.log("[mailer:dev]", subject, "->", to);
  return info;
}
