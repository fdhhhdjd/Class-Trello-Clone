import { env } from "../config/env.js";

const wrap = (title, body) => `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#172b4d">
    <h2 style="color:#0079bf">${title}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #dfe1e6;margin:24px 0" />
    <p style="font-size:12px;color:#6b778c">Trello Clone</p>
  </div>`;

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#0079bf;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">${label}</a>`;

// Returns { subject, html, text } for a given notification/email kind.
export function renderEmail(kind, data = {}) {
  switch (kind) {
    case "password_reset": {
      const url = `${env.APP_URL}/reset-password?token=${data.token}`;
      return {
        subject: "Reset your password",
        html: wrap("Reset your password", `<p>We received a request to reset your password.</p><p>${btn(url, "Reset password")}</p><p style="font-size:12px;color:#6b778c">This link expires in 1 hour. If you didn't request it, ignore this email.</p>`),
        text: `Reset your password: ${url}`,
      };
    }
    case "assigned": {
      const url = `${env.APP_URL}/b/${data.boardId}?card=${data.cardId}`;
      return {
        subject: `You were assigned to "${data.title ?? "a card"}"`,
        html: wrap("New assignment", `<p>You were assigned to <b>${data.title ?? "a card"}</b>.</p><p>${btn(url, "Open card")}</p>`),
        text: `You were assigned to ${data.title}: ${url}`,
      };
    }
    case "invite": {
      const url = `${env.APP_URL}`;
      return {
        subject: "You were invited to a workspace",
        html: wrap("Workspace invite", `<p>You were invited to a workspace.</p><p>${btn(url, "Open Trello Clone")}</p>`),
        text: `You were invited to a workspace: ${url}`,
      };
    }
    case "due_soon": {
      const url = `${env.APP_URL}/b/${data.boardId}?card=${data.cardId}`;
      return {
        subject: `Due soon: "${data.title ?? "a card"}"`,
        html: wrap("Card due soon", `<p><b>${data.title ?? "A card"}</b> is due ${data.dueLabel ?? "soon"}.</p><p>${btn(url, "Open card")}</p>`),
        text: `Due soon: ${data.title} (${data.dueLabel}) ${url}`,
      };
    }
    default:
      return {
        subject: "Notification",
        html: wrap("Notification", `<p>${data.message ?? "You have a new notification."}</p>`),
        text: data.message ?? "You have a new notification.",
      };
  }
}
