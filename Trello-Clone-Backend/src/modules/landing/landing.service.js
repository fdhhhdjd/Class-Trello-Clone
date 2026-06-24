import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../../config/db.js";
import { minioPublic, MINIO_BUCKET, publicUrl } from "../../config/minio.js";

const LANDING_KEY = "landing";
const IMAGE_PUT_EXPIRY = 5 * 60; // seconds

export const LANDING_DEFAULTS = {
  brand: { name: "Trello Clone" },
  chatbot: {
    enabled: true,
    title: "Hỏi đáp nhanh với Trợ lý AI trên Zalo",
    subtitle: "Quét mã QR để chat với bot — hỏi mọi thông tin về sản phẩm, trả lời tức thì 24/7.",
    botName: "Bot Code Web Không Khó",
    qrImage: "",
  },
  hero: {
    eyebrow: "Project management, reimagined",
    title: "Organize anything, together",
    subtitle:
      "Boards, lists, and cards that keep your team in sync. Plan, track, and ship work from one shared space.",
    primaryCtaLabel: "Get started — it's free",
    secondaryCtaLabel: "Watch demo",
    image: "",
  },
  trust: {
    logos: ["Northwind", "Acme Co", "Globex", "Initech", "Umbrella", "Hooli"],
  },
  features: [
    { icon: "LayoutGrid", title: "Boards & lists", desc: "Visualize work as cards moving across columns you control." },
    { icon: "Users", title: "Team collaboration", desc: "Assign members, comment, and stay aligned in real time." },
    { icon: "CheckSquare", title: "Checklists", desc: "Break cards into tasks and track progress at a glance." },
    { icon: "Bell", title: "Notifications", desc: "Never miss a mention, due date, or board update." },
    { icon: "Paperclip", title: "Attachments", desc: "Drop files onto cards so context lives where work happens." },
    { icon: "Search", title: "Powerful search", desc: "Find any card, board, or comment in milliseconds." },
  ],
  steps: [
    { title: "Create a board", desc: "Start with a blank board or a ready-made template." },
    { title: "Add lists & cards", desc: "Map your workflow into lists and fill them with cards." },
    { title: "Invite your team", desc: "Share the board and collaborate from anywhere." },
    { title: "Ship the work", desc: "Move cards to done and celebrate progress." },
  ],
  pricing: [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      features: ["Up to 10 boards", "Unlimited cards", "2 members", "Basic checklists"],
      recommended: false,
      ctaLabel: "Start free",
    },
    {
      name: "Premium",
      price: "$10",
      period: "/user/mo",
      features: ["Unlimited boards", "Advanced checklists", "Custom fields", "Priority support"],
      recommended: true,
      ctaLabel: "Start trial",
    },
    {
      name: "Enterprise",
      price: "$21",
      period: "/user/mo",
      features: ["SSO & SAML", "Admin controls", "Org-wide permissions", "Dedicated support"],
      recommended: false,
      ctaLabel: "Contact sales",
    },
  ],
  faq: [
    { q: "Is there a free plan?", a: "Yes. The Free plan is generous enough for small teams and personal use." },
    { q: "Can I invite my whole team?", a: "Absolutely. Premium and Enterprise plans support unlimited members." },
    { q: "Do you offer SSO?", a: "SSO and SAML are available on the Enterprise plan." },
    { q: "Can I cancel anytime?", a: "Yes, plans are month-to-month with no long-term contract." },
  ],
  footer: {
    tagline: "The flexible way to plan, track, and ship work.",
    copyright: "© Trello Clone. All rights reserved.",
  },
};

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

export async function getLanding() {
  const row = await prisma.setting.findUnique({ where: { key: LANDING_KEY } });
  return deepMerge(LANDING_DEFAULTS, isObject(row?.value) ? row.value : {});
}

export async function saveLanding(content) {
  const current = await getLanding();
  const next = deepMerge(current, content ?? {});
  await prisma.setting.upsert({
    where: { key: LANDING_KEY },
    update: { value: next },
    create: { key: LANDING_KEY, value: next },
  });
  return next;
}

export async function createLandingImageUpload({ filename, contentType }) {
  const ext = path.extname(filename).slice(0, 16);
  const key = `landing/${crypto.randomUUID()}${ext}`;
  const uploadUrl = await minioPublic.presignedPutObject(MINIO_BUCKET, key, IMAGE_PUT_EXPIRY);
  return { uploadUrl, fileUrl: publicUrl(key), key, contentType };
}
