import * as service from "./customFields.service.js";
import { createFieldSchema, updateFieldSchema, setValueSchema } from "./customFields.schema.js";

// nested under /boards/:id/custom-fields
export const listForBoard = async (req, res) => {
  res.json(await service.listFields(req.user.id, req.params.id));
};

export const createForBoard = async (req, res) => {
  const input = createFieldSchema.parse(req.body);
  res.status(201).json(await service.createField(req.user.id, req.params.id, input));
};

// /custom-fields/:id
export const update = async (req, res) => {
  const input = updateFieldSchema.parse(req.body);
  res.json(await service.updateField(req.user.id, req.params.id, input));
};

export const remove = async (req, res) => {
  await service.deleteField(req.user.id, req.params.id);
  res.status(204).end();
};

// nested under /cards/:id/fields
export const listCardValues = async (req, res) => {
  res.json(await service.listCardValues(req.user.id, req.params.id));
};

export const setCardValue = async (req, res) => {
  const { value } = setValueSchema.parse(req.body);
  res.json(await service.setValue(req.user.id, req.params.id, req.params.fieldId, value));
};
