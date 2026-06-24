export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "AppError";
  }
}

export const Unauthorized = (code = "UNAUTHORIZED", msg = "Unauthorized") =>
  new AppError(401, code, msg);
export const Forbidden = (msg = "Forbidden", code = "FORBIDDEN") =>
  new AppError(403, code, msg);
export const BadRequest = (msg = "Bad request", code = "BAD_REQUEST") =>
  new AppError(400, code, msg);
export const NotFound = (msg = "Not found", code = "NOT_FOUND") =>
  new AppError(404, code, msg);
export const Conflict = (msg = "Conflict", code = "CONFLICT") =>
  new AppError(409, code, msg);
