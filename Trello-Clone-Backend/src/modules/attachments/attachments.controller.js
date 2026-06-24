import * as att from "./attachments.service.js";
import { presignSchema, createAttachmentSchema } from "./attachments.schema.js";

export const presign = async (req, res) => {
  const input = presignSchema.parse(req.body);
  res.json(await att.presignUpload(req.user.id, req.params.id, input));
};

export const create = async (req, res) => {
  const input = createAttachmentSchema.parse(req.body);
  res.status(201).json(await att.createAttachment(req.user.id, req.params.id, input));
};

export const list = async (req, res) => {
  res.json(await att.listAttachments(req.user.id, req.params.id));
};

export const download = async (req, res) => {
  const { url } = await att.getDownloadUrl(req.user.id, req.params.id);
  if (req.query.redirect !== undefined) return res.redirect(url);
  res.json({ url });
};

export const remove = async (req, res) => {
  await att.deleteAttachment(req.user.id, req.params.id);
  res.status(204).end();
};
