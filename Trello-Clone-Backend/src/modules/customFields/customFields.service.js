import { prisma } from "../../config/db.js";
import { NotFound } from "../../lib/errors.js";
import { assertBoardAccess } from "../boards/boards.service.js";
import { assertCardAccess } from "../cards/cards.service.js";
import { endPosition } from "../../lib/position.js";
import { emitToBoard } from "../../realtime/index.js";

const FIELD_SELECT = { id: true, boardId: true, name: true, type: true, options: true, position: true };

export async function listFields(userId, boardId) {
  await assertBoardAccess(userId, boardId);
  return prisma.customField.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: FIELD_SELECT,
  });
}

export async function createField(userId, boardId, input) {
  await assertBoardAccess(userId, boardId, "ws_member");
  const max = await prisma.customField.aggregate({ where: { boardId }, _max: { position: true } });
  const field = await prisma.customField.create({
    data: {
      boardId,
      name: input.name,
      type: input.type ?? "text",
      options: input.options ?? undefined,
      position: endPosition(max._max.position),
    },
    select: FIELD_SELECT,
  });
  emitToBoard(boardId, "field:created", field);
  return field;
}

async function loadField(fieldId) {
  const field = await prisma.customField.findUnique({ where: { id: fieldId }, select: FIELD_SELECT });
  if (!field) throw NotFound("Custom field not found");
  return field;
}

export async function updateField(userId, fieldId, input) {
  const field = await loadField(fieldId);
  await assertBoardAccess(userId, field.boardId, "ws_member");
  const updated = await prisma.customField.update({
    where: { id: fieldId },
    data: input,
    select: FIELD_SELECT,
  });
  emitToBoard(field.boardId, "field:updated", updated);
  return updated;
}

export async function deleteField(userId, fieldId) {
  const field = await loadField(fieldId);
  await assertBoardAccess(userId, field.boardId, "ws_member");
  await prisma.customField.delete({ where: { id: fieldId } });
  emitToBoard(field.boardId, "field:deleted", { id: fieldId });
}

// Set (or clear when value == null) a field value on a card.
export async function setValue(userId, cardId, fieldId, value) {
  const { card } = await assertCardAccess(userId, cardId, "ws_member");
  const field = await loadField(fieldId);
  if (field.boardId !== card.boardId) throw NotFound("Field not found on this board");

  if (value == null) {
    await prisma.customFieldValue.deleteMany({ where: { fieldId, cardId } });
    emitToBoard(card.boardId, "field:value", { cardId, fieldId, value: null });
    return { cardId, fieldId, value: null };
  }
  const row = await prisma.customFieldValue.upsert({
    where: { fieldId_cardId: { fieldId, cardId } },
    create: { fieldId, cardId, value },
    update: { value },
    select: { fieldId: true, cardId: true, value: true },
  });
  emitToBoard(card.boardId, "field:value", row);
  return row;
}

export async function listCardValues(userId, cardId) {
  await assertCardAccess(userId, cardId);
  return prisma.customFieldValue.findMany({
    where: { cardId },
    select: { fieldId: true, cardId: true, value: true },
  });
}
