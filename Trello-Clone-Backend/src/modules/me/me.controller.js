import * as svc from "./me.service.js";
import * as auth from "../auth/auth.service.js";
import { updateProfileSchema, avatarUploadSchema, updateSettingsSchema } from "./me.schema.js";
import { changePasswordSchema } from "../auth/auth.schema.js";
import { REFRESH_COOKIE_NAME } from "../auth/tokens.js";

export const updateProfile = async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  res.json(await svc.updateProfile(req.user.id, input));
};

export const avatarUpload = async (req, res) => {
  const input = avatarUploadSchema.parse(req.body);
  res.json(await svc.createAvatarUpload(req.user.id, input));
};

export const changePassword = async (req, res) => {
  const input = changePasswordSchema.parse(req.body);
  await auth.changePassword(req.user.id, input.currentPassword, input.newPassword);
  res.status(204).end();
};

export const getSettings = async (req, res) => {
  res.json(await svc.getSettings(req.user.id));
};

export const updateSettings = async (req, res) => {
  const input = updateSettingsSchema.parse(req.body);
  res.json(await svc.updateSettings(req.user.id, input.settings));
};

export const dashboard = async (req, res) => {
  res.json(await svc.getDashboard(req.user.id));
};

export const remove = async (req, res) => {
  await svc.deactivateSelf(req.user.id);
  res.status(204).end();
};

export const listSessions = async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  res.json(await auth.listSessions(req.user.id, raw));
};

export const revokeSession = async (req, res) => {
  await auth.revokeSession(req.user.id, req.params.id);
  res.status(204).end();
};
