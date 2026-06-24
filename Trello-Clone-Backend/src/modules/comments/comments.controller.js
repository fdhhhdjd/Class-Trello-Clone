import * as service from "./comments.service.js";
import { updateCommentSchema } from "./comments.schema.js";

export const update = async (req, res) => {
  const input = updateCommentSchema.parse(req.body);
  res.json(await service.updateComment(req.user.id, req.params.id, input));
};

export const remove = async (req, res) => {
  await service.deleteComment(req.user.id, req.params.id);
  res.status(204).end();
};
