import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function oauthClient(s, redirectUri) {
  return new google.auth.OAuth2(s.gdriveClientId, s.gdriveClientSecret, redirectUri);
}

// Step 1 of web flow — consent URL. state ties the callback to the initiator.
export function buildAuthUrl(s, redirectUri, state) {
  const client = oauthClient(s, redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh_token
    scope: SCOPES,
    state,
  });
}

// Step 2 — exchange code for tokens, fetch account email.
export async function exchangeCode(s, redirectUri, code) {
  const client = oauthClient(s, redirectUri);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  let email = "";
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? "";
  } catch {
    // email is best-effort
  }
  return { refreshToken: tokens.refresh_token ?? "", email };
}

function driveFor(s, redirectUri) {
  const client = oauthClient(s, redirectUri);
  client.setCredentials({ refresh_token: s.gdriveRefreshToken });
  return google.drive({ version: "v3", auth: client });
}

async function ensureFolder(drive, name, parentId) {
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${name.replace(/'/g, "\\'")}'`,
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(" and ");
  const found = await drive.files.list({ q, fields: "files(id)", pageSize: 1 });
  if (found.data.files?.length) return found.data.files[0].id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  return created.data.id;
}

// Upload every file in localDir into remoteFolder/<stamp>/ on Drive.
// Returns { remotePath, sizeBytes }.
export async function uploadDir(s, redirectUri, localDir, stamp) {
  const drive = driveFor(s, redirectUri);
  const rootId = await ensureFolder(drive, s.remoteFolder, null);
  const runId = await ensureFolder(drive, stamp, rootId);

  let sizeBytes = 0;
  for (const file of fs.readdirSync(localDir)) {
    const full = path.join(localDir, file);
    if (!fs.statSync(full).isFile()) continue;
    sizeBytes += fs.statSync(full).size;
    await drive.files.create({
      requestBody: { name: file, parents: [runId] },
      media: { body: fs.createReadStream(full) },
      fields: "id",
    });
  }
  return { remotePath: `${s.remoteFolder}/${stamp}`, sizeBytes };
}

// Keep only the newest N dated folders under remoteFolder.
export async function applyRetention(s, redirectUri, keep) {
  if (!keep || keep < 1) return;
  const drive = driveFor(s, redirectUri);
  const rootId = await ensureFolder(drive, s.remoteFolder, null);
  const res = await drive.files.list({
    q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    orderBy: "name desc",
    pageSize: 1000,
  });
  const folders = res.data.files ?? [];
  for (const f of folders.slice(keep)) {
    await drive.files.delete({ fileId: f.id }).catch(() => undefined);
  }
}

// Disconnect — revoke + clear is handled by caller; here just revoke best-effort.
export async function revoke(s, redirectUri) {
  try {
    const client = oauthClient(s, redirectUri);
    client.setCredentials({ refresh_token: s.gdriveRefreshToken });
    await client.revokeCredentials();
  } catch {
    // ignore
  }
}
