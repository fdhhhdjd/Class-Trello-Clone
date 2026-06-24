import * as service from "./checklists.service.js";
import { createItemSchema, updateItemSchema, updateChecklistSchema } from "./checklists.schema.js";

export const createItem = async (req, res) => {
  const input = createItemSchema.parse(req.body);
  res.status(201).json(await service.createItem(req.user.id, req.params.id, input));
};

export const updateChecklist = async (req, res) => {
  const input = updateChecklistSchema.parse(req.body);
  res.json(await service.updateChecklist(req.user.id, req.params.id, input));
};

export const removeChecklist = async (req, res) => {
  await service.deleteChecklist(req.user.id, req.params.id);
  res.status(204).end();
};

export const updateItem = async (req, res) => {
  const input = updateItemSchema.parse(req.body);
  res.json(await service.updateItem(req.user.id, req.params.id, input));
};

export const removeItem = async (req, res) => {
  await service.deleteItem(req.user.id, req.params.id);
  res.status(204).end();
};

export const convertItem = async (req, res) => {
  res.status(201).json(await service.convertItemToCard(req.user.id, req.params.id));
};
