import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export function signAccessToken(payload) {
  const opts = { expiresIn: env.ACCESS_TOKEN_TTL };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export const REFRESH_COOKIE_NAME = "refresh_token";
export const REFRESH_COOKIE_PATH = "/api/auth";

export function refreshCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
  };
}
