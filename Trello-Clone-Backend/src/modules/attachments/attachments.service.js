import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../../config/db.js";
import { minio, minioPublic, MINIO_BUCKET, publicUrl } from "../../config/minio.js";
import { NotFound } from "../../lib/errors.js";
import { assertCardAccess } from "../cards/cards.service.js";
import { assertWorkspaceAccess } from "../workspaces/workspaces.service.js";
import { emitToBoard } from "../../realtime/index.js";

const PUT_EXPIRY = 5 * 60; // seconds
const GET_EXPIRY = 5 * 60;

const ATTACHMENT_SELECT = {
  id: true,
  cardId: true,
  uploaderId: true,
  key: true,
  filename: true,
  size: true,
  mime: true,
  createdAt: true,
  uploader: { select: { id: true, name: true, email: true, avatarUrl: true } },
};

function withUrl(a) {
  return { ...a, fileUrl: publicUrl(a.key) };
}

export async function presignUpload(userId, cardId, { filename, contentType }) {
  await assertCardAccess(userId, cardId, "ws_member");
  const ext = path.extname(filename || "").slice(0, 16);
  const key = `attachments/${cardId}/${crypto.randomUUID()}${ext}`;
  const uploadUrl = await minioPublic.presignedPutObject(MINIO_BUCKET, key, PUT_EXPIRY);
  return { uploadUrl, key, fileUrl: publicUrl(key), contentType };
}

export async function createAttachment(userId, cardId, input) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const attachment = await prisma.attachment.create({
    data: {
      cardId,
      uploaderId: userId,
      key: input.key,
      filename: input.filename,
      size: input.size ?? 0,
      mime: input.mime ?? "application/octet-stream",
    },
    select: ATTACHMENT_SELECT,
  });

  await prisma.activity.create({
    data: {
      boardId: card.boardId,
      cardId,
      actorId: userId,
      action: "attachment.added",
      metadata: { filename: attachment.filename },
    },
  });
  const out = withUrl(attachment);
  emitToBoard(card.boardId, "attachment:created", out);
  return out;
}

export async function listAttachments(userId, cardId) {
  await assertCardAccess(userId, cardId);
  const rows = await prisma.attachment.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
    select: ATTACHMENT_SELECT,
  });
  return rows.map(withUrl);
}

async function loadAttachmentWithScope(attachmentId) {
  const att = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      ...ATTACHMENT_SELECT,
      card: { select: { list: { select: { boardId: true, board: { select: { workspaceId: true } } } } } },
    },
  });
  if (!att) throw NotFound("Attachment not found");
  return att;
}

export async function getDownloadUrl(userId, attachmentId) {
  const att = await loadAttachmentWithScope(attachmentId);
  await assertWorkspaceAccess(userId, att.card.list.board.workspaceId);
  const url = await minioPublic.presignedGetObject(MINIO_BUCKET, att.key, GET_EXPIRY);
  return { url };
}

export async function deleteAttachment(userId, attachmentId) {
  const att = await loadAttachmentWithScope(attachmentId);
  await assertWorkspaceAccess(userId, att.card.list.board.workspaceId, "ws_member");
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await minio.removeObject(MINIO_BUCKET, att.key).catch(() => {});
  emitToBoard(att.card.list.boardId, "attachment:deleted", { id: attachmentId, cardId: att.cardId });
}
