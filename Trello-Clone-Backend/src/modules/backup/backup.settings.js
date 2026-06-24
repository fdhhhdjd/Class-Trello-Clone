import { prisma } from "../../config/db.js";

const KEY = "backup";

export const DEFAULTS = {
  enabled: false,
  cronExpr: "0 2 * * *", // daily 02:00
  retentionCount: 30,
  scopeDb: true,
  scopeUploads: true,
  scopeConfigs: false,
  remoteFolder: "trello-backups",
  gdriveClientId: "",
  gdriveClientSecret: "",
  gdriveRefreshToken: "",
  gdriveAccountEmail: "",
};

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

// Full settings incl. secrets — for internal use (oauth, scheduler, runner).
export async function getRawSettings() {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  return { ...DEFAULTS, ...(isObject(row?.value) ? row.value : {}) };
}

// Public view — secrets stripped, plus a `connected` flag.
export function publicView(s) {
  const { gdriveClientSecret, gdriveRefreshToken, ...rest } = s;
  return { ...rest, connected: Boolean(s.gdriveRefreshToken && s.gdriveAccountEmail) };
}

export async function getSettings() {
  return publicView(await getRawSettings());
}

// Merge a partial patch and persist. Returns the full raw settings.
export async function saveSettings(patch) {
  const current = await getRawSettings();
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: next },
    create: { key: KEY, value: next },
  });
  return next;
}
