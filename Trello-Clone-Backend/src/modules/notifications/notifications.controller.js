import * as svc from "./notifications.service.js";
import { listNotificationsSchema } from "./notifications.schema.js";

export const list = async (req, res) => {
  const q = listNotificationsSchema.parse(req.query);
  res.json(await svc.listNotifications(req.user.id, q));
};

export const unreadCount = async (req, res) => {
  res.json(await svc.unreadCount(req.user.id));
};

export const markRead = async (req, res) => {
  res.json(await svc.markRead(req.user.id, req.params.id));
};

export const markAllRead = async (req, res) => {
  res.json(await svc.markAllRead(req.user.id));
};

export const remove = async (req, res) => {
  await svc.deleteNotification(req.user.id, req.params.id);
  res.status(204).end();
};
