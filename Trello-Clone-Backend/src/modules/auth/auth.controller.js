import {
  registerSchema, loginSchema, changePasswordSchema,
  forgotPasswordSchema, resetPasswordSchema, setupSchema,
} from "./auth.schema.js";
import * as service from "./auth.service.js";
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from "./tokens.js";
import { Unauthorized } from "../../lib/errors.js";

function setRefreshCookie(res, token, maxAgeMs) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(maxAgeMs));
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(0));
}

export const registerHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const { tokens } = await service.register(input.email, input.password, input.name);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAgeMs);
  res.status(201).json({ accessToken: tokens.accessToken });
};

export const loginHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const { tokens } = await service.login(input.email, input.password, req.ip, { userAgent: req.headers["user-agent"] });
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAgeMs);
  res.json({ accessToken: tokens.accessToken });
};

export const setupStatusHandler = async (_req, res) => {
  res.json(await service.getSetupStatus());
};

export const setupHandler = async (req, res) => {
  const input = setupSchema.parse(req.body);
  const { tokens } = await service.setupSuperAdmin(input.email, input.password, input.name, req.ip);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAgeMs);
  res.status(201).json({ accessToken: tokens.accessToken });
};

export const renewHandler = async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  const { tokens } = await service.renew(raw, { ipAddress: req.ip, userAgent: req.headers["user-agent"] });
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAgeMs);
  res.json({ accessToken: tokens.accessToken });
};

export const logoutHandler = async (req, res) => {
  const user = req.user;
  if (!user) throw Unauthorized();
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  await service.logout({
    userId: user.id,
    accessJti: user.jti,
    accessExp: user.exp,
    rawRefresh: raw,
  });
  clearRefreshCookie(res);
  res.json({ status: "ok" });
};

export const logoutAllHandler = async (req, res) => {
  const user = req.user;
  if (!user) throw Unauthorized();
  await service.logoutAll(user.id);
  clearRefreshCookie(res);
  res.json({ status: "ok" });
};

export const forgotPasswordHandler = async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  await service.requestPasswordReset(input.email);
  res.json({ status: "ok" });
};

export const resetPasswordHandler = async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await service.resetPassword(input.token, input.newPassword);
  res.json({ status: "ok" });
};

export const changePasswordHandler = async (req, res) => {
  const user = req.user;
  if (!user) throw Unauthorized();
  const input = changePasswordSchema.parse(req.body);
  await service.changePassword(user.id, input.currentPassword, input.newPassword);
  clearRefreshCookie(res);
  res.json({ status: "ok" });
};
