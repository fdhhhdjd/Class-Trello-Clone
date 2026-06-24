import * as service from "./workspaces.service.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addMemberSchema,
  logoUploadSchema,
  createInviteSchema,
} from "./workspaces.schema.js";

export const list = async (req, res) => {
  res.json(await service.listWorkspaces(req.user.id));
};

export const create = async (req, res) => {
  const input = createWorkspaceSchema.parse(req.body);
  res.status(201).json(await service.createWorkspace(req.user.id, input));
};

export const get = async (req, res) => {
  res.json(await service.getWorkspace(req.user.id, req.params.id));
};

export const update = async (req, res) => {
  const input = updateWorkspaceSchema.parse(req.body);
  res.json(await service.updateWorkspace(req.user.id, req.params.id, input));
};

export const remove = async (req, res) => {
  await service.deleteWorkspace(req.user.id, req.params.id);
  res.status(204).end();
};

export const listMembers = async (req, res) => {
  res.json(await service.listMembers(req.user.id, req.params.id));
};

export const addMember = async (req, res) => {
  const input = addMemberSchema.parse(req.body);
  res.status(201).json(await service.addMember(req.user.id, req.params.id, input));
};

export const logoUpload = async (req, res) => {
  const input = logoUploadSchema.parse(req.body);
  res.json(await service.createLogoUpload(req.user.id, req.params.id, input));
};

export const createInvite = async (req, res) => {
  const input = createInviteSchema.parse(req.body ?? {});
  res.status(201).json(await service.createInvite(req.user.id, req.params.id, input));
};

export const listInvites = async (req, res) => {
  res.json(await service.listInvites(req.user.id, req.params.id));
};

export const revokeInvite = async (req, res) => {
  await service.revokeInvite(req.user.id, req.params.id, req.params.token);
  res.status(204).end();
};

export const updateMemberRole = async (req, res) => {
  const role = req.body?.role;
  res.json(await service.updateMemberRole(req.user.id, req.params.id, req.params.userId, role));
};

export const removeMember = async (req, res) => {
  await service.removeMember(req.user.id, req.params.id, req.params.userId);
  res.status(204).end();
};

export const getInvite = async (req, res) => {
  res.json(await service.getInvite(req.params.token));
};

export const acceptInvite = async (req, res) => {
  res.json(await service.acceptInvite(req.user.id, req.params.token));
};
