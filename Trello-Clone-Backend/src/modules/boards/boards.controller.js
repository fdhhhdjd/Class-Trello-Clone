import * as service from "./boards.service.js";
import {
  createBoardSchema, updateBoardSchema, starBoardSchema,
  addBoardMemberSchema, updateBoardMemberSchema,
} from "./boards.schema.js";
import { BadRequest } from "../../lib/errors.js";

export const list = async (req, res) => {
  const workspaceId = req.query.workspaceId;
  if (!workspaceId) throw BadRequest("workspaceId query param required");
  const onlyTemplates = req.query.template === "1" || req.query.template === "true";
  res.json(await service.listBoards(req.user.id, workspaceId, onlyTemplates));
};

export const create = async (req, res) => {
  const input = createBoardSchema.parse(req.body);
  res.status(201).json(await service.createBoard(req.user.id, input));
};

export const get = async (req, res) => {
  res.json(await service.getBoardDetail(req.user.id, req.params.id));
};

export const update = async (req, res) => {
  const input = updateBoardSchema.parse(req.body);
  res.json(await service.updateBoard(req.user.id, req.params.id, input));
};

export const remove = async (req, res) => {
  await service.deleteBoard(req.user.id, req.params.id);
  res.status(204).end();
};

export const copy = async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name : undefined;
  res.status(201).json(await service.copyBoard(req.user.id, req.params.id, name));
};

export const star = async (req, res) => {
  const { starred } = starBoardSchema.parse(req.body);
  res.json(await service.setBoardStar(req.user.id, req.params.id, starred));
};

export const backgroundUpload = async (req, res) => {
  const { filename, contentType } = req.body ?? {};
  if (!filename || !contentType) throw BadRequest("filename and contentType required");
  res.json(await service.createBoardBgUpload(req.user.id, req.params.id, { filename, contentType }));
};

export const listMembers = async (req, res) => {
  res.json(await service.listBoardMembers(req.user.id, req.params.id));
};

export const addMember = async (req, res) => {
  const input = addBoardMemberSchema.parse(req.body);
  res.status(201).json(await service.addBoardMember(req.user.id, req.params.id, input.userId, input.role));
};

export const updateMember = async (req, res) => {
  const { role } = updateBoardMemberSchema.parse(req.body);
  res.json(await service.updateBoardMember(req.user.id, req.params.id, req.params.userId, role));
};

export const removeMember = async (req, res) => {
  await service.removeBoardMember(req.user.id, req.params.id, req.params.userId);
  res.status(204).end();
};
