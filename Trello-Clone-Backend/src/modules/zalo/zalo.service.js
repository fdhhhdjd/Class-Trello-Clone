import { env } from "../../config/env.js";

const ZALO_BASE = "https://bot-api.zaloplatforms.com";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// Kiến thức nền về dự án để bot trả lời "thông tin dự án".
const PROJECT_CONTEXT = `Bạn là trợ lý ảo của dự án "Trello Clone" — công cụ quản lý công việc dạng bảng (giống Trello).
Thông tin dự án:
- Sản phẩm: quản lý công việc theo Workspace (công ty) > Board (dự án) > List (cột: Cần làm/Đang làm/Review/Hoàn thành) > Card (đầu việc).
- 2 ứng dụng: App người dùng (tạo bảng, kéo thả thẻ, giao việc, bình luận, đính kèm) và Trang quản trị (quản người dùng, workspace, dung lượng, sao lưu, thống kê).
- Tính năng nổi bật: invite link, card number + share link, status (todo/doing/done/blocked), reaction, checklist, attachment, board/card templates, WIP limit, calendar, dashboard (pie + velocity), backup tự động lên Google Drive, quản lý phiên đăng nhập.
- Công nghệ: Node.js + Express + Prisma (PostgreSQL) + Redis + MinIO + Socket.IO (backend); React + Vite (frontend); Docker + nginx (hạ tầng); deploy Dev -> Prod theo phiên bản.
- Truy cập: app.trello-clone.online (người dùng), admin.trello-clone.online (quản trị), trello-clone.online (giới thiệu).
- Tài khoản demo: an.nguyen@demo.vn ... phuc.ly@demo.vn, mật khẩu Demo@12345.
Hãy trả lời NGẮN GỌN, thân thiện, bằng tiếng Việt. Nếu câu hỏi ngoài phạm vi dự án, vẫn trả lời lịch sự ngắn gọn.`;

function zaloUrl(method) {
  return `${ZALO_BASE}/bot${env.ZALO_BOT_TOKEN}/${method}`;
}

export async function sendMessage(chatId, text) {
  if (!env.ZALO_BOT_TOKEN) throw new Error("ZALO_BOT_TOKEN not set");
  const res = await fetch(zaloUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500) }),
  });
  return res.json().catch(() => ({}));
}

export async function sendChatAction(chatId, action = "typing") {
  if (!env.ZALO_BOT_TOKEN) return {};
  const res = await fetch(zaloUrl("sendChatAction"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
  return res.json().catch(() => ({}));
}

export async function setWebhook(url) {
  const res = await fetch(zaloUrl("setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: env.ZALO_WEBHOOK_SECRET }),
  });
  return res.json().catch(() => ({}));
}

export async function getWebhookInfo() {
  const res = await fetch(zaloUrl("getWebhookInfo"), { method: "POST" });
  return res.json().catch(() => ({}));
}

// Hỏi DeepSeek với ngữ cảnh dự án.
export async function askDeepseek(question) {
  if (!env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not set");
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: PROJECT_CONTEXT },
        { role: "user", content: question },
      ],
      temperature: 0.4,
      max_tokens: 700,
      stream: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content?.trim() || "Xin lỗi, mình chưa trả lời được lúc này.";
}

// Trích event/text/chat_id từ payload webhook.
// Zalo gửi: { ok, result: { event_name, message: { text, from:{id}, chat:{id} } } }
function parseUpdate(update) {
  const r = update?.result ?? update ?? {};
  const msg = r?.message ?? update?.message ?? {};
  const eventName = r?.event_name ?? update?.event_name ?? "";
  const text = msg?.text ?? "";
  const chatId = msg?.chat?.id ?? msg?.from?.id ?? msg?.chat_id ?? env.ZALO_CHAT_ID;
  return {
    eventName,
    text: typeof text === "string" ? text.trim() : "",
    chatId: chatId ? String(chatId) : "",
  };
}

// Xử lý 1 update: hỏi DeepSeek rồi gửi trả lời về Zalo. Không ném lỗi ra ngoài.
export async function handleUpdate(update) {
  try {
    const { eventName, text, chatId } = parseUpdate(update);
    console.log(`[zalo] event="${eventName}" text="${text.slice(0, 60)}" chatId="${chatId}"`);
    if (!chatId) return;
    if (!text) {
      if (eventName === "message.unsupported.received") {
        await sendMessage(chatId, "Mình chỉ trả lời tin nhắn văn bản thôi nhé. Bạn gõ câu hỏi giúp mình.");
      }
      return;
    }
    if (text.startsWith("/start")) {
      await sendMessage(chatId, "Xin chào! Mình là trợ lý dự án Trello Clone. Hỏi mình bất cứ điều gì về dự án nhé.");
      return;
    }
    await sendChatAction(chatId, "typing"); // hiển thị "đang soạn tin"
    const answer = await askDeepseek(text);
    await sendChatAction(chatId, "typing");
    await sendMessage(chatId, answer);
  } catch (e) {
    console.error("zalo handleUpdate error:", e.message);
  }
}
