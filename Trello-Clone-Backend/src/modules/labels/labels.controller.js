import * as service from "./labels.service.js";
import { z } from "zod";

const createLabelSchema = z.object({
  name: z.string().max(160).optional(),
  color: z.string().min(1).max(64),
});

export const listForBoard = async (req, res) => {
  res.json(await service.listLabels(req.user.id, req.params.id));
};

export const createForBoard = async (req, res) => {
  const input = createLabelSchema.parse(req.body);
  res.status(201).json(await service.createLabel(req.user.id, req.params.id, input));
};

const updateLabelSchema = z
  .object({
    name: z.string().max(160).nullable().optional(),
    color: z.string().min(1).max(64).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

export const update = async (req, res) => {
  const input = updateLabelSchema.parse(req.body);
  res.json(await service.updateLabel(req.user.id, req.params.id, input));
};

export const remove = async (req, res) => {
  await service.deleteLabel(req.user.id, req.params.id);
  res.status(204).end();
};
