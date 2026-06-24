import * as service from "./lists.service.js";
import { createListSchema, updateListSchema, sortListSchema, moveListSchema } from "./lists.schema.js";
import { BadRequest } from "../../lib/errors.js";

export const list = async (req, res) => {
  const boardId = req.query.boardId;
  if (!boardId) throw BadRequest("boardId query param required");
  res.json(await service.listLists(req.user.id, boardId));
};

export const create = async (req, res) => {
  const input = createListSchema.parse(req.body);
  res.status(201).json(await service.createList(req.user.id, input));
};

export const get = async (req, res) => {
  res.json(await service.getList(req.user.id, req.params.id));
};

export const update = async (req, res) => {
  const input = updateListSchema.parse(req.body);
  res.json(await service.updateList(req.user.id, req.params.id, input));
};

export const remove = async (req, res) => {
  await service.deleteList(req.user.id, req.params.id);
  res.status(204).end();
};

export const sort = async (req, res) => {
  const { by } = sortListSchema.parse(req.body);
  res.json(await service.sortListCards(req.user.id, req.params.id, by));
};

export const copy = async (req, res) => {
  res.status(201).json(await service.copyList(req.user.id, req.params.id));
};

export const archiveCards = async (req, res) => {
  res.json(await service.archiveListCards(req.user.id, req.params.id));
};

export const move = async (req, res) => {
  const { targetBoardId } = moveListSchema.parse(req.body);
  res.json(await service.moveList(req.user.id, req.params.id, targetBoardId));
};
